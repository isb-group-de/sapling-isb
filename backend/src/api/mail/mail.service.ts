import { EntityManager } from '@mikro-orm/core';
import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { REDIS_ENABLED } from '../../constants/project.constants';
import { EmailDeliveryItem } from '../../entity/EmailDeliveryItem';
import { EmailDeliveryStatusItem } from '../../entity/EmailDeliveryStatusItem';
import type { EmailSubscriptionItem } from '../../entity/EmailSubscriptionItem';
import { EmailTemplateItem } from '../../entity/EmailTemplateItem';
import { EntityItem } from '../../entity/EntityItem';
import { PersonItem } from '../../entity/PersonItem';
import { PersonSessionItem } from '../../entity/PersonSessionItem';
import { MessageTemplateService } from '../template/message-template.service';
import { TemplateService } from '../template/template.service';
import {
  MailContextCcDto,
  MailContextCcResponseDto,
  MailPreviewDto,
  MailPreviewResponseDto,
  MailSenderListResponseDto,
  MailSendDto,
} from './dto/mail.dto';
import {
  getMailProviderErrorShape,
  normalizeEmailAddress,
  toPersistedObject,
  type SupportedMailProvider,
} from './mail-delivery.util';
import { MailFollowUpService } from './mail-follow-up.service';
import { MailProviderSessionService } from './mail-provider-session.service';
import { MailProviderTransportService } from './mail-provider-transport.service';
import { MailRenderingService } from './mail-rendering.service';
import { CustomerAssociationResolverService } from './customer-association-resolver.service';
import { CustomerCcService } from './customer-cc.service';

/**
 * Stable orchestration facade for mail controllers, processors and inbound
 * synchronization. Rendering, provider sessions, transport and follow-up
 * events live in focused collaborators.
 */
@Injectable()
export class MailService {
  private readonly renderingService: MailRenderingService;
  private readonly followUpService: MailFollowUpService;
  private readonly providerSessionService: MailProviderSessionService;
  private readonly providerTransportService: MailProviderTransportService;
  private readonly customerAssociationResolver: CustomerAssociationResolverService;
  private readonly customerCcService: CustomerCcService;

  constructor(
    private readonly em: EntityManager,
    templateService: TemplateService,
    messageTemplateService: MessageTemplateService,
    @InjectQueue('emails') private readonly emailQueue: Queue,
    @Optional() renderingService?: MailRenderingService,
    @Optional() followUpService?: MailFollowUpService,
    @Optional() providerSessionService?: MailProviderSessionService,
    @Optional() providerTransportService?: MailProviderTransportService,
    @Optional()
    customerAssociationResolver?: CustomerAssociationResolverService,
    @Optional() customerCcService?: CustomerCcService,
  ) {
    this.renderingService =
      renderingService ?? new MailRenderingService(messageTemplateService);
    this.followUpService = followUpService ?? new MailFollowUpService();
    this.providerSessionService =
      providerSessionService ?? new MailProviderSessionService(em);
    this.providerTransportService =
      providerTransportService ??
      new MailProviderTransportService(
        messageTemplateService,
        this.providerSessionService,
      );
    this.customerAssociationResolver =
      customerAssociationResolver ??
      new CustomerAssociationResolverService(templateService);
    this.customerCcService =
      customerCcService ??
      new CustomerCcService(this.customerAssociationResolver);
  }

  async listSenderOptions(
    currentUser: PersonItem,
    entityHandle?: string,
  ): Promise<MailSenderListResponseDto> {
    return this.providerSessionService.listSenderOptions(
      currentUser,
      entityHandle,
    );
  }

  /** Shares the outgoing OAuth session with background inbound mail work. */
  async resolveAuthenticatedMailSession(
    currentUser: PersonItem,
    expectedProvider?: SupportedMailProvider,
    forceRefresh = false,
  ): Promise<{
    person: PersonItem;
    session: PersonSessionItem;
    provider: SupportedMailProvider;
    accessToken: string;
  }> {
    return this.providerSessionService.resolveAuthenticatedSession(
      currentUser,
      expectedProvider,
      forceRefresh,
    );
  }

  async previewEmail(
    previewDto: MailPreviewDto,
    currentUser: PersonItem,
  ): Promise<MailPreviewResponseDto> {
    return this.renderingService.previewEmail(this.em, previewDto, currentUser);
  }

  async resolveContextCc(
    contextDto: MailContextCcDto,
  ): Promise<MailContextCcResponseDto> {
    return {
      additionalCc: await this.customerCcService.resolveAdditionalCc(
        this.em,
        contextDto,
      ),
    };
  }

  async sendEmail(
    sendDto: MailSendDto,
    currentUser: PersonItem,
    automation?: {
      subscription: EmailSubscriptionItem;
      deduplicationKey?: string;
    },
  ): Promise<EmailDeliveryItem> {
    const customerAssociation = await this.customerAssociationResolver.resolve(
      this.em,
      sendDto.entityHandle,
      sendDto.itemHandle,
      sendDto.draftValues,
    );
    const additionalCc = automation
      ? await this.customerCcService.resolveAdditionalCcForCompany(
          this.em,
          customerAssociation.company,
          sendDto,
        )
      : [];
    const effectiveSendDto =
      additionalCc.length > 0
        ? {
            ...sendDto,
            cc: [...(sendDto.cc ?? []), ...additionalCc],
          }
        : sendDto;
    const preview = await this.previewEmail(effectiveSendDto, currentUser);
    if (preview.to.length === 0) {
      throw new BadRequestException('mail.toRequired');
    }
    const entity = await this.em.findOne(EntityItem, {
      handle: sendDto.entityHandle,
    });
    if (!entity) {
      throw new NotFoundException('global.entityNotFound');
    }
    const resolvedSender =
      await this.providerSessionService.resolveRequestedSender(
        currentUser,
        sendDto.senderEmail,
      );
    const delivery = new EmailDeliveryItem();
    delivery.status = await this.ensureStatus(this.em, 'pending');
    delivery.entity = entity;
    delivery.createdBy = currentUser;
    delivery.subscription = automation?.subscription;
    delivery.automationDeduplicationKey = automation?.deduplicationKey;
    delivery.template = sendDto.templateHandle
      ? ((await this.em.findOne(EmailTemplateItem, {
          handle: sendDto.templateHandle,
        })) ?? undefined)
      : undefined;
    delivery.referenceHandle =
      sendDto.itemHandle !== undefined ? String(sendDto.itemHandle) : undefined;
    delivery.customerCompany = customerAssociation.company;
    delivery.customerPerson = customerAssociation.person;
    delivery.provider = currentUser.type?.handle ?? 'sapling';
    delivery.toRecipients = preview.to;
    delivery.ccRecipients = preview.cc;
    delivery.bccRecipients = preview.bcc;
    delivery.subject = preview.subject;
    delivery.bodyMarkdown = preview.bodyMarkdown;
    delivery.bodyHtml = preview.bodyHtml;
    delivery.attachmentHandles = preview.attachmentHandles ?? [];
    delivery.requestPayload = {
      from: resolvedSender?.email,
      requestedFrom: normalizeEmailAddress(sendDto.senderEmail),
      senderDisplayName: resolvedSender?.displayName,
      senderProvider: resolvedSender?.provider,
      senderSource: resolvedSender?.source,
      usesConfiguredSharedMailbox: resolvedSender?.source === 'configured',
      to: preview.to,
      cc: preview.cc,
      bcc: preview.bcc,
      subject: preview.subject,
      attachmentHandles: preview.attachmentHandles ?? [],
    };
    delivery.attemptCount = 0;
    await this.em.persist(delivery).flush();

    if (REDIS_ENABLED) {
      await this.emailQueue.add('deliver-email', {
        deliveryId: delivery.handle,
      });
    } else if (delivery.handle) {
      await this.dispatchDelivery(delivery.handle);
    }
    return this.em.findOneOrFail(EmailDeliveryItem, {
      handle: delivery.handle,
    });
  }

  async dispatchDelivery(deliveryId: number): Promise<EmailDeliveryItem> {
    const em = this.em.fork();
    const delivery = await em.findOne(
      EmailDeliveryItem,
      { handle: deliveryId },
      {
        populate: [
          'status',
          'template',
          'entity',
          'createdBy',
          'createdBy.type',
          'createdBy.session',
          'customerCompany',
          'customerPerson',
          'customerPerson.company',
        ],
      },
    );
    if (!delivery) {
      throw new NotFoundException('mail.deliveryNotFound');
    }
    delivery.attemptCount = (delivery.attemptCount ?? 0) + 1;

    try {
      const attachments = await this.providerTransportService.loadAttachments(
        em,
        delivery.attachmentHandles ?? [],
      );
      const result = await this.providerTransportService.send(
        delivery,
        attachments,
        em,
      );
      delivery.status = await this.ensureStatus(em, 'success');
      delivery.responseStatusCode = result.responseStatusCode;
      delivery.responseBody = result.responseBody;
      delivery.responseHeaders = result.responseHeaders;
      delivery.providerMessageId = result.providerMessageId;
      delivery.completedAt = new Date();
      await em.flush();
      await this.followUpService.createForDelivery(em, delivery);
      return delivery;
    } catch (error) {
      const providerError = getMailProviderErrorShape(error);
      delivery.status = await this.ensureStatus(em, 'failed');
      delivery.responseStatusCode = providerError.statusCode ?? 500;
      delivery.responseBody = {
        message: providerError.message ?? 'Unknown error',
        senderEmail:
          this.providerTransportService.getRequestedSenderEmail(delivery),
        senderSource:
          this.providerTransportService.getRequestedSenderSource(delivery),
        providerError: toPersistedObject(providerError.body),
      };
      delivery.responseHeaders = toPersistedObject(providerError.headers);
      delivery.completedAt = new Date();
      await em.flush();
      throw error;
    }
  }

  async retryDelivery(handle: number): Promise<EmailDeliveryItem> {
    const delivery = await this.em.findOne(EmailDeliveryItem, { handle });
    if (!delivery) {
      throw new NotFoundException('mail.deliveryNotFound');
    }
    delivery.status = await this.ensureStatus(this.em, 'pending');
    delivery.nextRetryAt = undefined;
    delivery.completedAt = undefined;
    delivery.responseStatusCode = undefined;
    delivery.responseBody = undefined;
    delivery.responseHeaders = undefined;
    delivery.providerMessageId = undefined;
    await this.em.flush();

    if (REDIS_ENABLED) {
      await this.emailQueue.add('deliver-email', {
        deliveryId: delivery.handle,
      });
    } else if (delivery.handle) {
      await this.dispatchDelivery(delivery.handle);
    }
    return this.em.findOneOrFail(EmailDeliveryItem, {
      handle: delivery.handle,
    });
  }

  private async ensureStatus(
    em: EntityManager,
    handle: string,
  ): Promise<EmailDeliveryStatusItem> {
    const existing = await em.findOne(EmailDeliveryStatusItem, { handle });
    if (existing) {
      return existing;
    }
    const created = new EmailDeliveryStatusItem();
    created.handle = handle;
    if (handle === 'success') {
      created.description = 'Success';
      created.icon = 'mdi-email-check-outline';
      created.color = '#4CAF50';
    } else if (handle === 'failed') {
      created.description = 'Failed';
      created.icon = 'mdi-email-remove-outline';
      created.color = '#F44336';
    } else {
      created.description = 'Pending';
      created.icon = 'mdi-email-fast-outline';
      created.color = '#FF9800';
    }
    await em.persist(created).flush();
    return created;
  }
}
