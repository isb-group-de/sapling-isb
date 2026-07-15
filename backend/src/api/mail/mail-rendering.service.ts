import { EntityManager } from '@mikro-orm/core';
import { Injectable, NotFoundException } from '@nestjs/common';
import { EmailTemplateItem } from '../../entity/EmailTemplateItem';
import { EntityItem } from '../../entity/EntityItem';
import { PersonItem } from '../../entity/PersonItem';
import { MessageTemplateService } from '../template/message-template.service';
import { MailPreviewDto, MailPreviewResponseDto } from './dto/mail.dto';
import { normalizeEmailAddress } from './mail-delivery.util';
import { renderMarkdownBlocks } from './markdown.util';

@Injectable()
export class MailRenderingService {
  constructor(
    private readonly messageTemplateService: MessageTemplateService,
  ) {}

  async previewEmail(
    em: EntityManager,
    previewDto: MailPreviewDto,
    currentUser: PersonItem,
  ): Promise<MailPreviewResponseDto> {
    const entity = await em.findOne(EntityItem, {
      handle: previewDto.entityHandle,
    });

    if (!entity) {
      throw new NotFoundException('global.entityNotFound');
    }

    const template = previewDto.templateHandle
      ? await em.findOne(EmailTemplateItem, {
          handle: previewDto.templateHandle,
        })
      : null;
    const context = await this.messageTemplateService.buildContext({
      entityHandle: previewDto.entityHandle,
      itemHandle: previewDto.itemHandle,
      currentUser,
      draftValues: previewDto.draftValues,
    });
    const subjectSource = previewDto.subject ?? template?.subjectTemplate ?? '';
    const bodySource = previewDto.bodyMarkdown ?? template?.bodyMarkdown ?? '';
    const renderOptions = {
      entityHandle: previewDto.entityHandle,
      locale: previewDto.clientLocale,
      timeZone: previewDto.clientTimeZone,
      currentUser,
    };
    const subject = this.messageTemplateService.replacePlaceholders(
      subjectSource,
      context,
      renderOptions,
    );
    const bodyMarkdown = this.messageTemplateService.replacePlaceholders(
      bodySource,
      context,
      renderOptions,
    );

    return {
      entityHandle: previewDto.entityHandle,
      itemHandle: previewDto.itemHandle,
      templateHandle: previewDto.templateHandle,
      senderEmail:
        normalizeEmailAddress(previewDto.senderEmail) ??
        normalizeEmailAddress(currentUser.email) ??
        '',
      to: this.messageTemplateService.replaceRecipients(previewDto.to, context),
      cc: this.messageTemplateService.replaceRecipients(previewDto.cc, context),
      bcc: this.messageTemplateService.replaceRecipients(
        previewDto.bcc,
        context,
      ),
      subject,
      bodyMarkdown,
      bodyHtml: renderMarkdownBlocks(bodyMarkdown),
      attachmentHandles: previewDto.attachmentHandles ?? [],
    };
  }
}
