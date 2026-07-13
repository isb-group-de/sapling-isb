import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { google } from 'googleapis';
import { PersonItem } from '../../entity/PersonItem';
import { SharedMailboxItem } from '../../entity/SharedMailboxItem';
import {
  GOOGLE_CALLBACK_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} from '../../constants/project.constants';
import { MailService } from './mail.service';
import type { SupportedMailProvider } from './mail-delivery.util';
import {
  emailAddressesEqual,
  normalizeEmailAddress,
} from './mail-delivery.util';

export type ProviderInboundEmail = {
  provider: SupportedMailProvider;
  providerMessageId: string;
  internetMessageId?: string | null;
  conversationId?: string | null;
  inReplyTo?: string | null;
  references?: string[] | null;
  subject: string;
  fromAddress: string;
  fromName?: string | null;
  toRecipients: string[];
  ccRecipients: string[];
  bodyText?: string | null;
  bodyHtml?: string | null;
  headers: Record<string, string | string[]>;
  receivedAt: Date;
  raw: Buffer;
};

type GraphAddress = {
  emailAddress?: { address?: string | null; name?: string | null } | null;
};

type GraphMessage = {
  id?: string;
  internetMessageId?: string | null;
  conversationId?: string | null;
  subject?: string | null;
  from?: GraphAddress | null;
  toRecipients?: GraphAddress[] | null;
  ccRecipients?: GraphAddress[] | null;
  receivedDateTime?: string | null;
  body?: { contentType?: string | null; content?: string | null } | null;
  bodyPreview?: string | null;
  internetMessageHeaders?: Array<{
    name?: string | null;
    value?: string | null;
  }> | null;
};

@Injectable()
export class EmailInboxProviderService {
  constructor(private readonly mailService: MailService) {}

  async fetchMessages(
    mailbox: SharedMailboxItem,
    processingPerson: PersonItem,
    since: Date,
  ): Promise<ProviderInboundEmail[]> {
    const provider = this.getMailboxProvider(mailbox);
    return this.withAuthenticatedSession(
      processingPerson,
      provider,
      async (accessToken) =>
        provider === 'azure'
          ? this.fetchAzureMessages(
              mailbox,
              processingPerson,
              accessToken,
              since,
            )
          : this.fetchGoogleMessages(mailbox, accessToken, since),
    );
  }

  private async withAuthenticatedSession<T>(
    person: PersonItem,
    provider: SupportedMailProvider,
    callback: (accessToken: string) => Promise<T>,
  ): Promise<T> {
    const initial = await this.mailService.resolveAuthenticatedMailSession(
      person,
      provider,
    );

    try {
      return await callback(initial.accessToken);
    } catch (error) {
      if (!isAuthenticationError(error)) {
        throw error;
      }

      const refreshed = await this.mailService.resolveAuthenticatedMailSession(
        person,
        provider,
        true,
      );
      return callback(refreshed.accessToken);
    }
  }

  private async fetchAzureMessages(
    mailbox: SharedMailboxItem,
    processingPerson: PersonItem,
    accessToken: string,
    since: Date,
  ): Promise<ProviderInboundEmail[]> {
    const mailboxPath = this.isOwnMailbox(mailbox, processingPerson)
      ? 'me'
      : `users/${encodeURIComponent(mailbox.email)}`;
    const baseUrl = `https://graph.microsoft.com/v1.0/${mailboxPath}`;
    let nextUrl = `${baseUrl}/mailFolders/inbox/messages`;
    const messages: ProviderInboundEmail[] = [];
    const visitedUrls = new Set<string>();

    while (nextUrl && !visitedUrls.has(nextUrl)) {
      visitedUrls.add(nextUrl);
      const response = await axios.get<{
        value?: GraphMessage[];
        '@odata.nextLink'?: string;
      }>(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params:
          visitedUrls.size === 1
            ? {
                $select:
                  'id,internetMessageId,conversationId,subject,from,toRecipients,ccRecipients,receivedDateTime,body,bodyPreview,internetMessageHeaders',
                $filter: `receivedDateTime ge ${since.toISOString()}`,
                $orderby: 'receivedDateTime asc',
                $top: 50,
              }
            : undefined,
      });

      for (const message of response.data.value ?? []) {
        if (!message.id) {
          continue;
        }

        const rawResponse = await axios.get<ArrayBuffer>(
          `${baseUrl}/messages/${encodeURIComponent(message.id)}/$value`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'message/rfc822',
            },
            responseType: 'arraybuffer',
          },
        );
        messages.push(
          this.mapGraphMessage(message, Buffer.from(rawResponse.data)),
        );
      }

      nextUrl = response.data['@odata.nextLink'] ?? '';
    }

    return messages;
  }

  private async fetchGoogleMessages(
    mailbox: SharedMailboxItem,
    accessToken: string,
    since: Date,
  ): Promise<ProviderInboundEmail[]> {
    const auth = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID || undefined,
      GOOGLE_CLIENT_SECRET || undefined,
      GOOGLE_CALLBACK_URL || undefined,
    );
    auth.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth });
    // Delegated Google OAuth addresses the signed-in mailbox as "me". Aliases
    // and group-delivered messages are narrowed with Gmail search instead of
    // pretending the user token can impersonate another account.
    const userId = 'me';
    const messages: ProviderInboundEmail[] = [];
    let pageToken: string | undefined;
    const visitedPageTokens = new Set<string>();

    do {
      const list = await gmail.users.messages.list({
        userId,
        labelIds: ['INBOX'],
        q: `deliveredto:${mailbox.email} after:${Math.floor(since.getTime() / 1000)}`,
        maxResults: 50,
        pageToken,
      });

      for (const listed of list.data.messages ?? []) {
        if (!listed.id) {
          continue;
        }

        const [full, raw] = await Promise.all([
          gmail.users.messages.get({
            userId,
            id: listed.id,
            format: 'full',
          }),
          gmail.users.messages.get({
            userId,
            id: listed.id,
            format: 'raw',
          }),
        ]);
        messages.push(
          mapGoogleMessage(
            listed.id,
            full.data,
            decodeBase64Url(raw.data.raw ?? ''),
          ),
        );
      }

      const nextPageToken = list.data.nextPageToken ?? undefined;
      if (nextPageToken && visitedPageTokens.has(nextPageToken)) {
        pageToken = undefined;
      } else {
        pageToken = nextPageToken;
        if (pageToken) {
          visitedPageTokens.add(pageToken);
        }
      }
    } while (pageToken);

    return messages;
  }

  private mapGraphMessage(
    message: GraphMessage,
    raw: Buffer,
  ): ProviderInboundEmail {
    const headers = Object.fromEntries(
      (message.internetMessageHeaders ?? [])
        .filter((header) => header.name && header.value != null)
        .map((header) => [header.name!.toLowerCase(), header.value!]),
    );
    const content = message.body?.content ?? '';
    const isHtml = message.body?.contentType?.toLowerCase() === 'html';

    return {
      provider: 'azure',
      providerMessageId: message.id!,
      internetMessageId: message.internetMessageId ?? null,
      conversationId: message.conversationId ?? null,
      inReplyTo: headerString(headers, 'in-reply-to'),
      references: splitMessageReferences(headerString(headers, 'references')),
      subject: message.subject?.trim() || '(No subject)',
      fromAddress:
        normalizeEmailAddress(message.from?.emailAddress?.address) ?? '',
      fromName: message.from?.emailAddress?.name?.trim() || null,
      toRecipients: mapGraphAddresses(message.toRecipients),
      ccRecipients: mapGraphAddresses(message.ccRecipients),
      bodyText: isHtml ? htmlToText(content) : content || message.bodyPreview,
      bodyHtml: isHtml ? content : null,
      headers,
      receivedAt: parseReceivedAt(message.receivedDateTime),
      raw,
    };
  }

  private getMailboxProvider(
    mailbox: SharedMailboxItem,
  ): SupportedMailProvider {
    const provider =
      typeof mailbox.provider === 'string'
        ? mailbox.provider
        : mailbox.provider?.handle;
    if (provider !== 'azure' && provider !== 'google') {
      throw new Error('emailInboxSubscription.providerNotSupported');
    }
    return provider;
  }

  private isOwnMailbox(
    mailbox: SharedMailboxItem,
    person: PersonItem,
  ): boolean {
    // Provider APIs accept "me" for a personal mailbox. Shared mailboxes are
    // addressed explicitly; the caller's group authorization is checked by the
    // synchronization service before this provider adapter is entered.
    return (
      mailbox.email.trim().toLowerCase() === 'me' ||
      emailAddressesEqual(mailbox.email, person.email)
    );
  }
}

function mapGraphAddresses(addresses?: GraphAddress[] | null): string[] {
  return (addresses ?? [])
    .map((address) => normalizeEmailAddress(address.emailAddress?.address))
    .filter((address): address is string => !!address);
}

function mapGoogleMessage(
  providerMessageId: string,
  message: {
    threadId?: string | null;
    internalDate?: string | null;
    payload?: {
      mimeType?: string | null;
      headers?: Array<{ name?: string | null; value?: string | null }> | null;
      body?: { data?: string | null } | null;
      parts?: GooglePayload[] | null;
    } | null;
  },
  raw: Buffer,
): ProviderInboundEmail {
  const payload = message.payload ?? {};
  const headers = Object.fromEntries(
    (payload.headers ?? [])
      .filter((header) => header.name && header.value != null)
      .map((header) => [header.name!.toLowerCase(), header.value!]),
  );
  const bodies = extractGoogleBodies(payload);
  const from = parseAddress(headerString(headers, 'from'));

  return {
    provider: 'google',
    providerMessageId,
    internetMessageId: headerString(headers, 'message-id'),
    conversationId: message.threadId ?? null,
    inReplyTo: headerString(headers, 'in-reply-to'),
    references: splitMessageReferences(headerString(headers, 'references')),
    subject: headerString(headers, 'subject')?.trim() || '(No subject)',
    fromAddress: from.address,
    fromName: from.name,
    toRecipients: parseAddressList(headerString(headers, 'to')),
    ccRecipients: parseAddressList(headerString(headers, 'cc')),
    bodyText: bodies.text || (bodies.html ? htmlToText(bodies.html) : null),
    bodyHtml: bodies.html || null,
    headers,
    receivedAt: message.internalDate
      ? new Date(Number(message.internalDate))
      : parseReceivedAt(headerString(headers, 'date')),
    raw,
  };
}

type GooglePayload = {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: GooglePayload[] | null;
};

function extractGoogleBodies(payload: GooglePayload): {
  text: string;
  html: string;
} {
  let text = '';
  let html = '';

  const visit = (part: GooglePayload): void => {
    const content = part.body?.data
      ? decodeBase64Url(part.body.data).toString('utf8')
      : '';
    if (part.mimeType === 'text/plain' && content) {
      text += `${content}\n`;
    } else if (part.mimeType === 'text/html' && content) {
      html += `${content}\n`;
    }
    for (const child of part.parts ?? []) {
      visit(child);
    }
  };

  visit(payload);
  return { text: text.trim(), html: html.trim() };
}

function parseAddress(value?: string | null): {
  address: string;
  name: string | null;
} {
  const source = value?.trim() ?? '';
  const match = source.match(/^(.*?)<([^>]+)>$/);
  const address = normalizeEmailAddress(match?.[2] ?? source) ?? '';
  const name = match?.[1]?.replace(/^['\"]|['\"]$/g, '').trim() || null;
  return { address, name };
}

function parseAddressList(value?: string | null): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => parseAddress(entry).address)
    .filter(Boolean);
}

function splitMessageReferences(value?: string | null): string[] | null {
  const matches = value?.match(/<[^>]+>/g) ?? [];
  return matches.length > 0 ? matches : null;
}

function headerString(
  headers: Record<string, string | string[]>,
  name: string,
): string | null {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function htmlToText(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
}

function parseReceivedAt(value?: string | null): Date {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function isAuthenticationError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    const status = (error as { response?: { status?: number } })?.response
      ?.status;
    return status === 401;
  }
  return error.response?.status === 401;
}
