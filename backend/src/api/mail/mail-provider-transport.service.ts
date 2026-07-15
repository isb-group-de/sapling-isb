import { EntityManager } from '@mikro-orm/core';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Client } from '@microsoft/microsoft-graph-client';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import {
  GOOGLE_CALLBACK_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} from '../../constants/project.constants';
import { DocumentItem } from '../../entity/DocumentItem';
import { EmailDeliveryItem } from '../../entity/EmailDeliveryItem';
import { PersonSessionItem } from '../../entity/PersonSessionItem';
import { MessageTemplateService } from '../template/message-template.service';
import {
  isAuthenticationProviderError,
  isRecord,
  normalizeEmailAddress,
  toPersistedObject,
  type MailAttachment,
  type SendResult,
  type SupportedMailProvider,
} from './mail-delivery.util';
import { buildMimeMessage } from './mail-mime.util';
import { parseSupportedProvider } from './mail-sender-options.util';
import { MailProviderSessionService } from './mail-provider-session.service';

@Injectable()
export class MailProviderTransportService {
  constructor(
    private readonly messageTemplateService: MessageTemplateService,
    private readonly sessionService: MailProviderSessionService,
  ) {}

  async loadAttachments(
    em: EntityManager,
    handles: number[],
  ): Promise<MailAttachment[]> {
    if (handles.length === 0) {
      return [];
    }
    const documents = await em.find(
      DocumentItem,
      { handle: { $in: handles } },
      { populate: ['entity'] },
    );
    return documents.map((document) => ({
      handle: document.handle ?? 0,
      filename: document.filename,
      mimetype: document.mimetype,
      filePath: path.join(
        __dirname,
        '../../../storage',
        document.entity.handle,
        document.path,
      ),
    }));
  }

  async send(
    delivery: EmailDeliveryItem,
    attachments: MailAttachment[],
    em: EntityManager,
  ): Promise<SendResult> {
    const session = delivery.createdBy.session;
    if (!session) {
      throw new BadRequestException('mail.sessionNotFound');
    }
    const provider = parseSupportedProvider(delivery.provider);
    if (!provider) {
      throw new BadRequestException('mail.providerNotSupported');
    }
    const senderEmail = this.getRequestedSenderEmail(delivery);
    const initialAccessToken =
      session.accessToken?.trim() ||
      (await this.sessionService.refreshAccessToken(provider, session, em));
    if (!initialAccessToken) {
      throw new BadRequestException('mail.sessionNotFound');
    }

    try {
      return await this.sendWithAccessToken(
        provider,
        delivery,
        session,
        initialAccessToken,
        attachments,
        senderEmail,
      );
    } catch (error) {
      if (!isAuthenticationProviderError(error)) {
        throw error;
      }
      const refreshedToken = await this.sessionService.refreshAccessToken(
        provider,
        session,
        em,
      );
      if (!refreshedToken || refreshedToken === initialAccessToken) {
        throw error;
      }
      return this.sendWithAccessToken(
        provider,
        delivery,
        session,
        refreshedToken,
        attachments,
        senderEmail,
      );
    }
  }

  getRequestedSenderEmail(delivery: EmailDeliveryItem): string | undefined {
    if (!isRecord(delivery.requestPayload)) {
      return undefined;
    }
    return normalizeEmailAddress(
      typeof delivery.requestPayload.from === 'string'
        ? delivery.requestPayload.from
        : undefined,
    );
  }

  getRequestedSenderSource(delivery: EmailDeliveryItem): string | undefined {
    if (!isRecord(delivery.requestPayload)) {
      return undefined;
    }
    return typeof delivery.requestPayload.senderSource === 'string'
      ? delivery.requestPayload.senderSource
      : undefined;
  }

  private async sendWithAccessToken(
    provider: SupportedMailProvider,
    delivery: EmailDeliveryItem,
    session: PersonSessionItem,
    accessToken: string,
    attachments: MailAttachment[],
    senderEmail?: string,
  ): Promise<SendResult> {
    return provider === 'azure'
      ? this.sendAzureMessage(delivery, accessToken, attachments, senderEmail)
      : this.sendGoogleMessage(
          delivery,
          session,
          attachments,
          accessToken,
          senderEmail,
        );
  }

  private async sendAzureMessage(
    delivery: EmailDeliveryItem,
    accessToken: string,
    attachments: MailAttachment[],
    senderEmail?: string,
  ): Promise<SendResult> {
    const client = Client.init({
      authProvider: (done) => done(null, accessToken),
    });
    await client.api('/me/sendMail').post({
      message: {
        ...(senderEmail
          ? { from: { emailAddress: { address: senderEmail } } }
          : {}),
        subject: delivery.subject,
        body: { contentType: 'HTML', content: delivery.bodyHtml },
        toRecipients: delivery.toRecipients.map((address) => ({
          emailAddress: { address },
        })),
        ccRecipients: (delivery.ccRecipients ?? []).map((address) => ({
          emailAddress: { address },
        })),
        bccRecipients: (delivery.bccRecipients ?? []).map((address) => ({
          emailAddress: { address },
        })),
        attachments: attachments.map((attachment) => ({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: attachment.filename,
          contentType: attachment.mimetype,
          contentBytes: fs.readFileSync(attachment.filePath).toString('base64'),
        })),
      },
      saveToSentItems: true,
    });
    return {
      responseStatusCode: 202,
      responseBody: {
        provider: 'azure',
        senderEmail,
        saveToSentItems: true,
        recipientCount:
          delivery.toRecipients.length +
          (delivery.ccRecipients?.length ?? 0) +
          (delivery.bccRecipients?.length ?? 0),
      },
    };
  }

  private async sendGoogleMessage(
    delivery: EmailDeliveryItem,
    session: PersonSessionItem,
    attachments: MailAttachment[],
    accessToken: string,
    senderEmail?: string,
  ): Promise<SendResult> {
    const auth = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID || undefined,
      GOOGLE_CLIENT_SECRET || undefined,
      GOOGLE_CALLBACK_URL || undefined,
    );
    auth.setCredentials({
      access_token: accessToken,
      refresh_token: session.refreshToken || undefined,
    });
    const gmail = google.gmail({ version: 'v1', auth });
    const rawMessage = buildMimeMessage(
      delivery,
      attachments,
      this.messageTemplateService.stripMarkdown(delivery.bodyMarkdown),
      senderEmail,
    );
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: Buffer.from(rawMessage, 'utf8')
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/g, ''),
      },
    });
    return {
      responseStatusCode: 200,
      responseBody: toPersistedObject(result.data) ?? { provider: 'google' },
      responseHeaders: toPersistedObject(
        isRecord(result) ? result.headers : undefined,
      ),
      providerMessageId: result.data.id ?? undefined,
    };
  }
}
