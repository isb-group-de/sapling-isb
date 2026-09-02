import { EntityManager } from '@mikro-orm/core';
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { Client } from '@microsoft/microsoft-graph-client';
import {
  AZURE_AD_CLIENT_ID,
  AZURE_AD_CLIENT_SECRET,
  AZURE_AD_SCOPE,
  AZURE_AD_TENNANT_ID,
} from '../../constants/project.constants';
import { PersonItem } from '../../entity/PersonItem';
import { PersonSessionItem } from '../../entity/PersonSessionItem';
import { TeamsDeliveryItem } from '../../entity/TeamsDeliveryItem';
import { TeamsDeliveryStatusItem } from '../../entity/TeamsDeliveryStatusItem';

type JsonRecord = Record<string, unknown>;
type GraphChat = { id?: string };
type GraphMessage = { id?: string };
type GraphErrorShape = {
  statusCode?: number;
  body?: unknown;
  message?: string;
};
type TeamsSendResult = { chatId: string; messageId?: string };
type TeamsRetryResult = {
  delivery: TeamsDeliveryItem | null;
  finalError?: unknown;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function toPersistedObject(value: unknown): object | undefined {
  return isRecord(value) ? value : undefined;
}

function getGraphErrorShape(error: unknown): GraphErrorShape {
  if (isRecord(error)) {
    return {
      statusCode:
        typeof error.statusCode === 'number' ? error.statusCode : undefined,
      body: error.body,
      message: typeof error.message === 'string' ? error.message : undefined,
    };
  }
  return { message: error instanceof Error ? error.message : 'Unknown error' };
}

function extractGraphErrorCode(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined;
  const directCode =
    typeof body.code === 'string' ? body.code.trim() : undefined;
  if (directCode) return directCode;
  if (isRecord(body.error) && typeof body.error.code === 'string') {
    const nestedCode = body.error.code.trim();
    return nestedCode.length > 0 ? nestedCode : undefined;
  }
  return undefined;
}

function isGraphAuthenticationError(error: unknown): boolean {
  const graphError = getGraphErrorShape(error);
  if (graphError.statusCode === 401 || graphError.statusCode === 403)
    return true;
  const errorCode = extractGraphErrorCode(graphError.body)?.toLowerCase();
  return Boolean(
    errorCode &&
    (errorCode.includes('token') ||
      errorCode.includes('auth') ||
      errorCode.includes('unauthorized') ||
      errorCode.includes('forbidden')),
  );
}

export class TeamsGraphDeliveryService {
  private readonly logger = new Logger(TeamsGraphDeliveryService.name);

  constructor(private readonly em: EntityManager) {}

  async dispatchDelivery(deliveryId: number): Promise<TeamsDeliveryItem> {
    const em = this.em.fork();
    const delivery = await em.findOne(
      TeamsDeliveryItem,
      { handle: deliveryId },
      {
        populate: [
          'status',
          'subscription',
          'template',
          'entity',
          'createdBy',
          'createdBy.type',
          'createdBy.session',
          'recipientPerson',
          'recipientPerson.type',
        ],
      },
    );

    if (!delivery) {
      throw new NotFoundException('teams.deliveryNotFound');
    }

    delivery.attemptCount = (delivery.attemptCount ?? 0) + 1;

    const senderLoginName = delivery.createdBy.loginName?.trim();
    const recipientLoginName = delivery.recipientPerson?.loginName?.trim();

    if (!senderLoginName || delivery.createdBy.type?.handle !== 'azure') {
      throw new BadRequestException('teams.senderAzureRequired');
    }

    if (
      !recipientLoginName ||
      delivery.recipientPerson?.type?.handle !== 'azure'
    ) {
      throw new BadRequestException('teams.recipientAzureRequired');
    }

    try {
      const accessToken = await this.resolveAzureAccessToken(
        em,
        delivery.createdBy.session,
      );
      if (!accessToken) {
        throw new BadRequestException('teams.sessionNotFound');
      }

      const result = await this.sendTeamsMessage(
        accessToken,
        delivery,
        senderLoginName,
        recipientLoginName,
      );

      const success = await this.ensureStatus(em, 'success');
      delivery.status = success;
      delivery.responseStatusCode = 201;
      delivery.responseBody = {
        chatId: result.chatId,
        messageId: result.messageId,
      };
      delivery.providerMessageId = result.messageId;
      delivery.completedAt = new Date();
      await em.flush();

      return delivery;
    } catch (error) {
      const retryResult = await this.retryWithRefreshedAccessToken(
        em,
        delivery,
        senderLoginName,
        recipientLoginName,
        error,
      );
      if (retryResult.delivery) {
        return retryResult.delivery;
      }

      const finalError = retryResult.finalError ?? error;
      const failed = await this.ensureStatus(em, 'failed');
      const graphError = getGraphErrorShape(finalError);

      delivery.status = failed;
      delivery.responseStatusCode = graphError.statusCode ?? 500;
      delivery.responseBody = {
        message: graphError.message ?? 'Unknown error',
        providerError: toPersistedObject(graphError.body),
      };
      delivery.completedAt = new Date();
      await em.flush();
      throw finalError;
    }
  }

  private async sendTeamsMessage(
    accessToken: string,
    delivery: TeamsDeliveryItem,
    senderLoginName: string,
    recipientLoginName: string,
  ): Promise<TeamsSendResult> {
    const client = Client.init({
      authProvider: (done) => done(null, accessToken),
    });

    let chatId: string;

    // Self-Chat vs. 1:1 Chat Behandlung
    if (this.isSamePerson(delivery.createdBy, delivery.recipientPerson)) {
      chatId = '48:notes';
    } else {
      const chat = (await client.api('/chats').post({
        chatType: 'oneOnOne',
        members: [
          {
            '@odata.type': '#microsoft.graph.aadUserConversationMember',
            roles: ['owner'],
            'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${senderLoginName}')`,
          },
          {
            '@odata.type': '#microsoft.graph.aadUserConversationMember',
            roles: ['owner'],
            'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${recipientLoginName}')`,
          },
        ],
      })) as GraphChat;

      if (!chat.id) {
        throw new BadRequestException('teams.chatCreateFailed');
      }
      chatId = chat.id;
    }

    const message = (await client.api(`/chats/${chatId}/messages`).post({
      body: {
        contentType: 'html',
        content: delivery.bodyHtml,
      },
    })) as GraphMessage;

    return {
      chatId,
      messageId: message.id,
    };
  }

  private isSamePerson(
    left?: PersonItem | null,
    right?: PersonItem | null,
  ): boolean {
    if (!left || !right) {
      return false;
    }

    if (left.handle && right.handle) {
      return left.handle === right.handle;
    }

    const leftLoginName = left.loginName?.trim().toLowerCase();
    const rightLoginName = right.loginName?.trim().toLowerCase();

    return Boolean(
      leftLoginName && rightLoginName && leftLoginName === rightLoginName,
    );
  }

  async ensureStatus(
    em: EntityManager,
    handle: string,
  ): Promise<TeamsDeliveryStatusItem> {
    const existing = await em.findOne(TeamsDeliveryStatusItem, { handle });
    if (existing) {
      return existing;
    }

    const created = new TeamsDeliveryStatusItem();
    created.handle = handle;

    switch (handle) {
      case 'success':
        created.description = 'Success';
        created.icon = 'mdi-microsoft-teams';
        created.color = '#4CAF50';
        created.isOpen = false;
        created.sortOrder = 30;
        break;
      case 'failed':
        created.description = 'Failed';
        created.icon = 'mdi-microsoft-teams';
        created.color = '#F44336';
        created.isOpen = false;
        created.sortOrder = 10;
        break;
      default:
        created.description = 'Pending';
        created.icon = 'mdi-microsoft-teams';
        created.color = '#FF9800';
        created.isOpen = true;
        created.sortOrder = 20;
        break;
    }

    await em.persist(created).flush();
    return created;
  }

  private async resolveAzureAccessToken(
    em: EntityManager,
    session?: PersonSessionItem,
  ): Promise<string | null> {
    const directToken = session?.accessToken?.trim();
    if (directToken) {
      return directToken;
    }

    const refreshToken = session?.refreshToken?.trim();
    if (!refreshToken) {
      return null;
    }

    return this.refreshAzureAccessToken(em, session);
  }

  private async refreshAzureAccessToken(
    em: EntityManager,
    session?: PersonSessionItem,
  ): Promise<string | null> {
    const refreshToken = session?.refreshToken?.trim();
    if (!refreshToken) {
      return null;
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

    const accessToken = response.data.access_token?.trim() ?? null;
    if (!accessToken || !session) {
      return accessToken;
    }

    session.accessToken = accessToken;
    await em.flush();
    this.logger.debug('Refreshed Azure access token for Teams delivery');
    return accessToken;
  }

  private async retryWithRefreshedAccessToken(
    em: EntityManager,
    delivery: TeamsDeliveryItem,
    senderLoginName: string,
    recipientLoginName: string,
    error: unknown,
  ): Promise<TeamsRetryResult> {
    if (!isGraphAuthenticationError(error)) {
      return { delivery: null };
    }

    const refreshedToken = await this.refreshAzureAccessToken(
      em,
      delivery.createdBy.session,
    );
    if (!refreshedToken) {
      return { delivery: null };
    }

    try {
      const result = await this.sendTeamsMessage(
        refreshedToken,
        delivery,
        senderLoginName,
        recipientLoginName,
      );
      const success = await this.ensureStatus(em, 'success');
      delivery.status = success;
      delivery.responseStatusCode = 201;
      delivery.responseBody = {
        chatId: result.chatId,
        messageId: result.messageId,
      };
      delivery.providerMessageId = result.messageId;
      delivery.completedAt = new Date();
      await em.flush();
      this.logger.debug(
        `Teams delivery #${delivery.handle ?? 'unknown'} succeeded after token refresh.`,
      );
      return { delivery };
    } catch (retryError) {
      this.logger.warn(
        `Teams delivery #${delivery.handle ?? 'unknown'} token refresh retry failed: ${
          retryError instanceof Error ? retryError.message : String(retryError)
        }`,
      );
      return {
        delivery: null,
        finalError: retryError,
      };
    }
  }
}
