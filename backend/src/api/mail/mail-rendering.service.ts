import { MailSignatureService } from './mail-signature.service';
import { EntityManager } from '@mikro-orm/core';
import { Injectable, NotFoundException } from '@nestjs/common';
import { EmailTemplateItem } from '../../entity/EmailTemplateItem';
import { EntityItem } from '../../entity/EntityItem';
import { PersonItem } from '../../entity/PersonItem';
import { MessageTemplateService } from '../template/message-template.service';
import { MailPreviewDto, MailPreviewResponseDto } from './dto/mail.dto';
import { normalizeEmailAddress } from './mail-delivery.util';
import { renderMarkdownBlocks } from './markdown.util';
import {
  normalizeMailImageEmbeds,
  resolveMailInlineImages,
} from './mail-inline-images.util';

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
    const signature = await new MailSignatureService(em).resolve(
      previewDto,
      currentUser,
    );
    const content = previewDto.bodyMarkdown ?? template?.bodyMarkdown ?? '';
    const bodySource = normalizeMailImageEmbeds(
      signature
        ? [content.trimEnd(), signature.bodyMarkdown.trim()]
            .filter(Boolean)
            .join('\n\n')
        : content,
    );
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
    const bodyMarkdown = normalizeMailImageEmbeds(
      this.messageTemplateService.replacePlaceholders(
        bodySource,
        context,
        renderOptions,
      ),
    );

    const bodyHtml = renderMarkdownBlocks(bodyMarkdown);
    await resolveMailInlineImages(
      em,
      bodyHtml,
      previewDto.entityHandle,
      previewDto.itemHandle,
    );

    return {
      unresolvedPlaceholders: [
        ...new Set(
          [
            subjectSource,
            bodySource,
            ...[previewDto.to, previewDto.cc, previewDto.bcc].flatMap(
              (value) => value ?? [],
            ),
          ]
            .flatMap((source) => source.match(/\{\{\s*([^}]+?)\s*\}\}/g) ?? [])
            .filter(
              (token) =>
                !this.messageTemplateService
                  .replacePlaceholders(token, context, renderOptions)
                  .trim(),
            ),
        ),
      ],
      signatureHandle: signature?.handle,
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
      bodyHtml,
      attachmentHandles: previewDto.attachmentHandles ?? [],
    };
  }
}
