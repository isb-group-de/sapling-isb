import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import axios from 'axios';
import { google } from 'googleapis';
import { EventDeliveryItem } from '../entity/EventDeliveryItem';
import { EventDeliveryStatusItem } from '../entity/EventDeliveryStatusItem';
import { PersonSessionItem } from '../entity/PersonSessionItem';
import { GoogleCalendarService } from './google/google.calendar.service';
import { AzureCalendarService } from './azure/azure.calendar.service';
import {
  AZURE_AD_CLIENT_ID,
  AZURE_AD_CLIENT_SECRET,
  AZURE_AD_SCOPE,
  AZURE_AD_TENNANT_ID,
  GOOGLE_CALLBACK_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} from '../constants/project.constants';
import { getErrorMessage } from '../common/error.utils';

type CalendarProvider = 'google' | 'azure';

type CalendarDeliveryPayload = {
  provider: CalendarProvider;
  operation?: 'remove-recurrence' | 'detach-occurrence';
  occurrenceStart?: string;
  changedFields?: string[];
  sessionHandle?: number;
  session?: {
    accessToken?: string;
    refreshToken?: string;
  };
};

type ResolvedCalendarSession = {
  accessToken?: string;
  refreshToken?: string;
  personHandle?: number;
  session?: PersonSessionItem | null;
};

type HttpResponseLike = {
  status?: number;
  data?: unknown;
  headers?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCalendarDeliveryPayload(
  payload: unknown,
): payload is CalendarDeliveryPayload {
  return (
    isRecord(payload) &&
    (payload.provider === 'google' || payload.provider === 'azure') &&
    (payload.operation === undefined ||
      payload.operation === 'remove-recurrence' ||
      payload.operation === 'detach-occurrence') &&
    (payload.occurrenceStart === undefined ||
      (typeof payload.occurrenceStart === 'string' &&
        !Number.isNaN(new Date(payload.occurrenceStart).getTime()))) &&
    (payload.operation !== 'detach-occurrence' ||
      typeof payload.occurrenceStart === 'string') &&
    (payload.changedFields === undefined ||
      (Array.isArray(payload.changedFields) &&
        payload.changedFields.every((field) => typeof field === 'string'))) &&
    ((typeof payload.sessionHandle === 'number' && payload.sessionHandle > 0) ||
      (isRecord(payload.session) &&
        ((typeof payload.session.accessToken === 'string' &&
          payload.session.accessToken.length > 0) ||
          (typeof payload.session.refreshToken === 'string' &&
            payload.session.refreshToken.length > 0))))
  );
}

async function resolveSessionTokens(
  em: EntityManager,
  payload: CalendarDeliveryPayload,
): Promise<ResolvedCalendarSession> {
  if (typeof payload.sessionHandle === 'number') {
    const session = await em.findOne(
      PersonSessionItem,
      { handle: payload.sessionHandle },
      { populate: ['person'] },
    );

    if (!session) {
      throw new Error('calendar.sessionNotFound');
    }

    return {
      session,
      personHandle: session.person?.handle,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    };
  }

  if (payload.session?.accessToken || payload.session?.refreshToken) {
    return {
      accessToken: payload.session.accessToken,
      refreshToken: payload.session.refreshToken,
    };
  }

  throw new Error('calendar.sessionNotFound');
}

function toHttpResponseLike(value: unknown): HttpResponseLike | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    status: typeof value.status === 'number' ? value.status : undefined,
    data: value.data,
    headers: value.headers,
  };
}

function getErrorResponse(error: unknown): HttpResponseLike | null {
  if (!isRecord(error)) {
    return null;
  }

  if (isRecord(error.response)) {
    return toHttpResponseLike(error.response);
  }

  if (typeof error.statusCode === 'number') {
    return {
      status: error.statusCode,
      data: error.body,
      headers: error.headers,
    };
  }

  return null;
}

function toPersistedObject(value: unknown): object | undefined {
  return isRecord(value) ? value : undefined;
}

function getCalendarDeliveryErrorMessage(error: unknown): string {
  return isRecord(error) && typeof error.message === 'string'
    ? error.message
    : getErrorMessage(error);
}

@Injectable()
export class CalendarDeliveryExecutor {
  private readonly logger = new Logger(CalendarDeliveryExecutor.name);

  constructor(
    private readonly em: EntityManager,
    @Inject(forwardRef(() => GoogleCalendarService))
    private readonly googleCalendarService: GoogleCalendarService,
    @Inject(forwardRef(() => AzureCalendarService))
    private readonly azureCalendarService: AzureCalendarService,
  ) {}

  async execute(deliveryId: number, attemptCount: number): Promise<void> {
    const em = this.em.fork();
    this.logger.debug(
      `Processing calendar delivery #${deliveryId} (Attempt ${attemptCount})`,
    );

    const delivery = await em.findOne(
      EventDeliveryItem,
      { handle: deliveryId },
      {
        populate: [
          'event',
          'status',
          'event.participants',
          'event.creatorPerson',
        ],
      },
    );
    if (!delivery) {
      this.logger.error(`Delivery #${deliveryId} not found in DB`);
      return;
    }

    delivery.attemptCount = attemptCount;

    if (!isCalendarDeliveryPayload(delivery.payload)) {
      throw new Error('calendar.invalidPayload');
    }

    const { provider } = delivery.payload;
    const sessionContext = await resolveSessionTokens(em, delivery.payload);
    const eventHandle = delivery.event.handle;

    if (typeof eventHandle !== 'number') {
      throw new Error('calendar.eventNotFound');
    }

    const accessToken = await this.resolveAccessToken(provider, sessionContext);
    if (!accessToken) {
      const reason =
        'Es konnte kein gueltiger Access-Token fuer die Kalendersynchronisation ermittelt werden.';
      this.logger.warn(
        `Calendar delivery #${deliveryId} failed because no access token is available.`,
      );
      await this.persistFailure(em, delivery, new Error(reason));
      return;
    }

    try {
      const providerResponse = await this.executeProviderDelivery(
        provider,
        eventHandle,
        accessToken,
        sessionContext.personHandle,
        delivery.payload.operation,
        delivery.payload.changedFields,
        delivery.payload.occurrenceStart,
      );

      if (await this.persistSuccess(em, delivery, providerResponse)) {
        this.logger.log(`Calendar delivery #${deliveryId} sent successfully.`);
      }
    } catch (error: unknown) {
      const retried = await this.retryWithRefreshedToken(
        em,
        delivery,
        provider,
        sessionContext,
        eventHandle,
        deliveryId,
        delivery.payload.operation,
        delivery.payload.changedFields,
        delivery.payload.occurrenceStart,
      );
      if (retried) {
        return;
      }

      await this.persistFailure(em, delivery, error);
      this.logger.error(`Calendar delivery #${deliveryId} failed.`, error);
    }
  }

  private async refreshAccessToken(
    provider: CalendarProvider,
    refreshToken: string | undefined,
  ): Promise<string | null> {
    if (!refreshToken) {
      return null;
    }

    if (provider === 'google') {
      const auth = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID || undefined,
        GOOGLE_CLIENT_SECRET || undefined,
        GOOGLE_CALLBACK_URL || undefined,
      );

      auth.setCredentials({ refresh_token: refreshToken });
      const refreshed = await auth.refreshAccessToken();
      return refreshed.credentials.access_token ?? null;
    }

    const tokenEndpoint = `https://login.microsoftonline.com/${AZURE_AD_TENNANT_ID || 'common'}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      client_id: AZURE_AD_CLIENT_ID,
      client_secret: AZURE_AD_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    if (AZURE_AD_SCOPE.length > 0) {
      params.set('scope', AZURE_AD_SCOPE.join(' '));
    }

    const response = await axios.post<{ access_token?: string }>(
      tokenEndpoint,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    return response.data.access_token ?? null;
  }

  private async resolveAccessToken(
    provider: CalendarProvider,
    sessionContext: ResolvedCalendarSession,
  ): Promise<string | null> {
    const directToken = sessionContext.accessToken?.trim();
    if (directToken) {
      return directToken;
    }

    const refreshedToken = await this.refreshAccessToken(
      provider,
      sessionContext.refreshToken,
    );
    if (refreshedToken) {
      if (sessionContext.session) {
        sessionContext.session.accessToken = refreshedToken;
      }
      sessionContext.accessToken = refreshedToken;
      return refreshedToken;
    }

    return null;
  }

  private async executeProviderDelivery(
    provider: CalendarProvider,
    eventHandle: number,
    accessToken: string,
    personHandle?: number,
    operation?: 'remove-recurrence' | 'detach-occurrence',
    changedFields?: string[],
    occurrenceStart?: string,
  ): Promise<unknown> {
    if (occurrenceStart) {
      return provider === 'google'
        ? this.googleCalendarService.setEvent(
            eventHandle,
            accessToken,
            personHandle,
            operation,
            changedFields,
            occurrenceStart,
          )
        : this.azureCalendarService.setEvent(
            eventHandle,
            accessToken,
            personHandle,
            operation,
            changedFields,
            occurrenceStart,
          );
    }

    if (provider === 'google') {
      if (changedFields) {
        return this.googleCalendarService.setEvent(
          eventHandle,
          accessToken,
          personHandle,
          operation,
          changedFields,
        );
      }
      return operation
        ? this.googleCalendarService.setEvent(
            eventHandle,
            accessToken,
            personHandle,
            operation,
          )
        : this.googleCalendarService.setEvent(
            eventHandle,
            accessToken,
            personHandle,
          );
    }

    if (changedFields) {
      return this.azureCalendarService.setEvent(
        eventHandle,
        accessToken,
        personHandle,
        operation,
        changedFields,
      );
    }
    return operation
      ? this.azureCalendarService.setEvent(
          eventHandle,
          accessToken,
          personHandle,
          operation,
        )
      : this.azureCalendarService.setEvent(
          eventHandle,
          accessToken,
          personHandle,
        );
  }

  private async persistFailure(
    em: EntityManager,
    delivery: EventDeliveryItem,
    error: unknown,
  ): Promise<void> {
    const failed = await em.findOne(EventDeliveryStatusItem, {
      handle: 'failed',
    });

    if (!failed) {
      return;
    }

    delivery.status = failed;
    delivery.completedAt = new Date();

    const errorResponse = getErrorResponse(error);
    delivery.responseStatusCode = errorResponse?.status ?? 500;
    delivery.responseBody = {
      providerError: {
        ...(errorResponse?.status ? { status: errorResponse.status } : {}),
        message: getCalendarDeliveryErrorMessage(error),
        ...(toPersistedObject(errorResponse?.data)
          ? { body: toPersistedObject(errorResponse?.data) }
          : {}),
      },
    };
    delivery.responseHeaders = toPersistedObject(errorResponse?.headers);

    await em.flush();
  }

  private async persistSuccess(
    em: EntityManager,
    delivery: EventDeliveryItem,
    providerResponse: unknown,
  ): Promise<boolean> {
    const success = await em.findOne(EventDeliveryStatusItem, {
      handle: 'success',
    });

    if (!success) {
      return false;
    }

    const response = toHttpResponseLike(providerResponse);
    delivery.status = success;
    delivery.responseStatusCode = response?.status || 200;
    delivery.responseBody =
      toPersistedObject(response?.data) ||
      (isRecord(providerResponse)
        ? providerResponse
        : { result: providerResponse });
    delivery.responseHeaders = toPersistedObject(response?.headers);
    delivery.completedAt = new Date();
    await em.flush();
    return true;
  }

  private async retryWithRefreshedToken(
    em: EntityManager,
    delivery: EventDeliveryItem,
    provider: CalendarProvider,
    sessionContext: ResolvedCalendarSession,
    eventHandle: number,
    deliveryId: number,
    operation?: 'remove-recurrence' | 'detach-occurrence',
    changedFields?: string[],
    occurrenceStart?: string,
  ): Promise<boolean> {
    if (!sessionContext.refreshToken) {
      return false;
    }

    try {
      const refreshedToken = await this.refreshAccessToken(
        provider,
        sessionContext.refreshToken,
      );

      if (!refreshedToken) {
        return false;
      }

      if (sessionContext.session) {
        sessionContext.session.accessToken = refreshedToken;
      }
      sessionContext.accessToken = refreshedToken;

      const providerResponse = await this.executeProviderDelivery(
        provider,
        eventHandle,
        refreshedToken,
        sessionContext.personHandle,
        operation,
        changedFields,
        occurrenceStart,
      );

      const persisted = await this.persistSuccess(
        em,
        delivery,
        providerResponse,
      );
      if (persisted) {
        this.logger.log(
          `Calendar delivery #${deliveryId} sent successfully after token refresh.`,
        );
      }
      return persisted;
    } catch (refreshError) {
      this.logger.warn(
        `Calendar delivery #${deliveryId} token refresh failed: ${getErrorMessage(refreshError)}`,
      );
      return false;
    }
  }
}
