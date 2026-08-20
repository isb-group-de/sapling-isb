import { EntityManager } from '@mikro-orm/core';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { Client } from '@microsoft/microsoft-graph-client';
import { google } from 'googleapis';
import {
  AZURE_AD_CLIENT_ID,
  AZURE_AD_CLIENT_SECRET,
  AZURE_AD_SCOPE,
  AZURE_AD_TENNANT_ID,
  GOOGLE_CALLBACK_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} from '../../constants/project.constants';
import { PersonItem } from '../../entity/PersonItem';
import { PersonSessionItem } from '../../entity/PersonSessionItem';
import { SharedMailboxContextItem } from '../../entity/SharedMailboxContextItem';
import { MailSenderListResponseDto } from './dto/mail.dto';
import {
  isAuthenticationProviderError,
  normalizeDisplayName,
  normalizeEmailAddress,
  type JsonRecord,
  type SupportedMailProvider,
} from './mail-delivery.util';
import {
  buildFallbackSenderOptions,
  buildPersonDisplayName,
  buildStandaloneSenderOption,
  extractProviderHandle,
  getAssignedSharedMailboxSenders,
  isSupportedMailProvider,
  mergeSenderOptions,
  parseSupportedProvider,
  pushSenderOption,
  type MailSenderOption,
} from './mail-sender-options.util';

export interface AuthenticatedMailSession {
  person: PersonItem;
  session: PersonSessionItem;
  provider: SupportedMailProvider;
  accessToken: string;
}

@Injectable()
export class MailProviderSessionService {
  private readonly logger = new Logger(MailProviderSessionService.name);

  constructor(private readonly em: EntityManager) {}

  async listSenderOptions(
    currentUser: PersonItem,
    entityHandle?: string,
  ): Promise<MailSenderListResponseDto> {
    const person = await this.loadCurrentMailPerson(currentUser);
    const context = await this.loadContextDefault(entityHandle);
    const defaultTemplateHandle = this.getDefaultTemplateHandle(
      context,
      entityHandle,
    );
    if (!person) {
      return { senders: [], defaultTemplateHandle };
    }
    const provider = extractProviderHandle(person);
    const fallbackSenders = buildFallbackSenderOptions(person, provider);
    if (!isSupportedMailProvider(provider) || !person.session) {
      return {
        provider,
        senders: this.applyContextDefault(fallbackSenders, context),
        defaultTemplateHandle,
      };
    }
    const senders = await this.listAvailableSendersForProvider(
      provider,
      person,
      person.session,
    );
    return {
      provider,
      senders: this.applyContextDefault(
        senders.length > 0 ? senders : fallbackSenders,
        context,
      ),
      defaultTemplateHandle,
    };
  }

  async resolveAuthenticatedSession(
    currentUser: PersonItem,
    expectedProvider?: SupportedMailProvider,
    forceRefresh = false,
  ): Promise<AuthenticatedMailSession> {
    const person = await this.loadCurrentMailPerson(currentUser);
    if (!person || !person.session) {
      throw new BadRequestException('mail.providerSessionRequired');
    }
    const provider = parseSupportedProvider(extractProviderHandle(person));
    if (!provider || (expectedProvider && provider !== expectedProvider)) {
      throw new BadRequestException('mail.providerMismatch');
    }
    const accessToken = forceRefresh
      ? await this.refreshAccessToken(provider, person.session)
      : await this.resolveActiveAccessToken(provider, person.session);
    if (!accessToken) {
      throw new BadRequestException('mail.providerAuthenticationRequired');
    }
    return { person, session: person.session, provider, accessToken };
  }

  async resolveRequestedSender(
    currentUser: PersonItem,
    requestedSenderEmail: string | undefined,
  ): Promise<MailSenderOption | undefined> {
    const normalizedRequested = normalizeEmailAddress(requestedSenderEmail);
    const person = await this.loadCurrentMailPerson(currentUser);
    if (!person) {
      return buildStandaloneSenderOption(
        normalizedRequested ?? normalizeEmailAddress(currentUser.email),
        extractProviderHandle(currentUser) ?? 'sapling',
        buildPersonDisplayName(currentUser),
      );
    }
    const provider = extractProviderHandle(person);
    if (!isSupportedMailProvider(provider) || !person.session) {
      return buildStandaloneSenderOption(
        normalizedRequested ?? normalizeEmailAddress(person.email),
        provider ?? 'sapling',
        buildPersonDisplayName(person),
      );
    }
    const senders = await this.listAvailableSendersForProvider(
      provider,
      person,
      person.session,
    );
    if (senders.length === 0) {
      return buildStandaloneSenderOption(
        normalizedRequested ?? normalizeEmailAddress(person.email),
        provider,
        buildPersonDisplayName(person),
      );
    }
    if (!normalizedRequested) {
      return senders.find((sender) => sender.isDefault) ?? senders[0];
    }
    const matchedSender = senders.find(
      (sender) =>
        sender.email.toLowerCase() === normalizedRequested.toLowerCase(),
    );
    if (!matchedSender) {
      throw new BadRequestException('mail.senderNotAllowed');
    }
    return matchedSender;
  }

  async resolveActiveAccessToken(
    provider: SupportedMailProvider,
    session: PersonSessionItem,
    em: EntityManager = this.em,
  ): Promise<string | null> {
    return (
      session.accessToken?.trim() ||
      this.refreshAccessToken(provider, session, em)
    );
  }

  async refreshAccessToken(
    provider: SupportedMailProvider,
    session: PersonSessionItem,
    em: EntityManager = this.em,
  ): Promise<string | null> {
    const refreshToken = session.refreshToken?.trim();
    if (!refreshToken) {
      return null;
    }
    try {
      const nextAccessToken =
        provider === 'google'
          ? await this.refreshGoogleToken(refreshToken)
          : await this.refreshAzureToken(refreshToken);
      if (nextAccessToken) {
        session.accessToken = nextAccessToken;
        await em.flush();
      }
      return nextAccessToken;
    } catch (error) {
      this.logger.warn(
        `Refreshing ${provider} access token failed: ${String(error)}`,
      );
      return null;
    }
  }

  private async loadCurrentMailPerson(
    currentUser: PersonItem,
  ): Promise<PersonItem | null> {
    if (currentUser.handle == null) {
      return null;
    }
    return this.em.findOne(
      PersonItem,
      { handle: currentUser.handle },
      {
        populate: [
          'session',
          'type',
          'sharedMailboxGroups',
          'sharedMailboxGroups.items',
          'sharedMailboxGroups.items.provider',
        ],
      },
    );
  }

  private async loadContextDefault(
    entityHandle?: string,
  ): Promise<SharedMailboxContextItem | null> {
    const normalizedEntityHandle = entityHandle?.trim();
    if (!normalizedEntityHandle) {
      return null;
    }

    return this.em.findOne(
      SharedMailboxContextItem,
      {
        entity: { handle: normalizedEntityHandle },
        isActive: true,
      },
      { populate: ['mailbox', 'template', 'template.entity'] },
    );
  }

  private getDefaultTemplateHandle(
    context: SharedMailboxContextItem | null,
    entityHandle?: string,
  ): number | undefined {
    const normalizedEntityHandle = entityHandle?.trim();
    const template = context?.template;

    if (
      !normalizedEntityHandle ||
      template?.handle == null ||
      template.isActive === false ||
      template.entity?.handle !== normalizedEntityHandle
    ) {
      return undefined;
    }

    return template.handle;
  }

  private applyContextDefault(
    senders: MailSenderOption[],
    context: SharedMailboxContextItem | null,
  ): MailSenderOption[] {
    if (senders.length === 0) {
      return senders;
    }
    const defaultEmail = normalizeEmailAddress(context?.mailbox?.email);
    const normalizedDefaultEmail = defaultEmail?.toLowerCase();
    const isAllowedConfiguredMailbox = senders.some(
      (sender) =>
        sender.source === 'configured' &&
        sender.email.toLowerCase() === normalizedDefaultEmail,
    );

    if (!normalizedDefaultEmail || !isAllowedConfiguredMailbox) {
      return senders;
    }

    return senders.map((sender) => ({
      ...sender,
      isDefault: sender.email.toLowerCase() === normalizedDefaultEmail,
    }));
  }

  private async listAvailableSendersForProvider(
    provider: SupportedMailProvider,
    person: PersonItem,
    session: PersonSessionItem,
  ): Promise<MailSenderOption[]> {
    const assignedSharedMailboxes = getAssignedSharedMailboxSenders(
      person,
      provider,
    );
    const discover = () =>
      provider === 'azure'
        ? this.listAzureSenderOptions(person, session)
        : this.listGoogleSenderOptions(person, session);
    const initialAccessToken = session.accessToken?.trim();
    try {
      return mergeSenderOptions(await discover(), assignedSharedMailboxes);
    } catch (error) {
      if (!isAuthenticationProviderError(error)) {
        throw error;
      }
      const refreshedToken = await this.refreshAccessToken(provider, session);
      if (refreshedToken && refreshedToken !== initialAccessToken) {
        try {
          return mergeSenderOptions(await discover(), assignedSharedMailboxes);
        } catch (retryError) {
          if (!isAuthenticationProviderError(retryError)) {
            throw retryError;
          }
        }
      }
      this.logger.warn(
        `Refreshing ${provider} access token for sender lookup failed, using fallback sender options.`,
      );
      return assignedSharedMailboxes;
    }
  }

  private async listAzureSenderOptions(
    person: PersonItem,
    session: PersonSessionItem,
  ): Promise<MailSenderOption[]> {
    const accessToken = await this.resolveActiveAccessToken('azure', session);
    if (!accessToken) {
      return buildFallbackSenderOptions(person, 'azure');
    }
    const client = Client.init({
      authProvider: (done) => done(null, accessToken),
    });
    const profile = (await client
      .api('/me')
      .select('displayName,mail,userPrincipalName,otherMails,proxyAddresses')
      .get()) as JsonRecord;
    const personDisplayName =
      `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || undefined;
    const displayName =
      normalizeDisplayName(String(profile.displayName)) ?? personDisplayName;
    const primaryEmail =
      normalizeEmailAddress(String(profile.mail)) ??
      normalizeEmailAddress(String(profile.userPrincipalName)) ??
      normalizeEmailAddress(person.email);
    const senders: MailSenderOption[] = [];
    pushSenderOption(
      senders,
      primaryEmail,
      displayName,
      'azure',
      'primary',
      true,
    );
    pushSenderOption(
      senders,
      normalizeEmailAddress(person.email),
      displayName,
      'azure',
      'profile',
    );
    return senders;
  }

  private async listGoogleSenderOptions(
    person: PersonItem,
    session: PersonSessionItem,
  ): Promise<MailSenderOption[]> {
    const auth = await this.createGoogleAuthClient(session);
    const gmail = google.gmail({ version: 'v1', auth });
    const senders: MailSenderOption[] = [];
    const profileResponse = await gmail.users.getProfile({ userId: 'me' });
    const primaryEmail =
      normalizeEmailAddress(profileResponse.data.emailAddress) ??
      normalizeEmailAddress(person.email);
    const displayName =
      `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() ||
      primaryEmail ||
      undefined;
    pushSenderOption(
      senders,
      primaryEmail,
      displayName,
      'google',
      'primary',
      true,
    );
    try {
      const response = await gmail.users.settings.sendAs.list({ userId: 'me' });
      for (const sendAs of response.data.sendAs ?? []) {
        pushSenderOption(
          senders,
          normalizeEmailAddress(sendAs.sendAsEmail),
          sendAs.displayName || displayName,
          'google',
          'alias',
          !!sendAs.isPrimary,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Google sender alias lookup failed, falling back to the primary account: ${String(error)}`,
      );
    }
    pushSenderOption(
      senders,
      normalizeEmailAddress(person.email),
      displayName,
      'google',
      'profile',
    );
    return senders;
  }

  private async refreshGoogleToken(
    refreshToken: string,
  ): Promise<string | null> {
    const auth = this.createOAuthClient();
    auth.setCredentials({ refresh_token: refreshToken });
    const refreshed = await auth.refreshAccessToken();
    return refreshed.credentials.access_token ?? null;
  }

  private async refreshAzureToken(
    refreshToken: string,
  ): Promise<string | null> {
    const endpoint = `https://login.microsoftonline.com/${AZURE_AD_TENNANT_ID || 'common'}/oauth2/v2.0/token`;
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
      endpoint,
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    return response.data.access_token ?? null;
  }

  private async createGoogleAuthClient(
    session: PersonSessionItem,
  ): Promise<InstanceType<typeof google.auth.OAuth2>> {
    const accessToken = await this.resolveActiveAccessToken('google', session);
    const auth = this.createOAuthClient();
    auth.setCredentials({
      access_token: accessToken ?? undefined,
      refresh_token: session.refreshToken || undefined,
    });
    return auth;
  }

  private createOAuthClient(): InstanceType<typeof google.auth.OAuth2> {
    return new google.auth.OAuth2(
      GOOGLE_CLIENT_ID || undefined,
      GOOGLE_CLIENT_SECRET || undefined,
      GOOGLE_CALLBACK_URL || undefined,
    );
  }
}
