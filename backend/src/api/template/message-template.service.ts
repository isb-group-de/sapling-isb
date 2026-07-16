import { EntityManager, type EntityName } from '@mikro-orm/core';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PersonItem } from '../../entity/PersonItem';
import { ENTITY_MAP } from '../../entity/global/entity.registry';
import {
  messageHtmlToPlainText,
  renderMessageMarkdown,
} from './message-template-markdown';
import { MessageTemplateMetadata } from './message-template-metadata';
import { MessageTemplateRenderer } from './message-template-renderer';
import type {
  JsonRecord,
  MessageContextOptions,
  MessageTemplateRenderOptions,
} from './message-template.types';
import { TemplateService } from './template.service';

@Injectable()
export class MessageTemplateService {
  private readonly metadata: MessageTemplateMetadata;
  private readonly renderer: MessageTemplateRenderer;

  constructor(
    private readonly em: EntityManager,
    private readonly templateService: TemplateService,
  ) {
    this.metadata = new MessageTemplateMetadata(templateService);
    this.renderer = new MessageTemplateRenderer(this.metadata);
  }

  async buildContext(options: MessageContextOptions): Promise<JsonRecord> {
    const base = options.itemHandle
      ? await this.loadEntityContext(
          options.entityHandle,
          options.itemHandle,
          options.relations,
        )
      : {};

    return {
      ...(options.currentUser ? { currentUser: options.currentUser } : {}),
      ...base,
      ...(options.draftValues ?? {}),
    };
  }

  async loadEntityContext(
    entityHandle: string,
    itemHandle: string | number,
    relationExpressions: string[] = [],
  ): Promise<JsonRecord> {
    const entityClass = ENTITY_MAP[entityHandle] as
      | EntityName<object>
      | undefined;
    if (!entityClass) {
      throw new NotFoundException('global.entityNotFound');
    }

    const template = this.templateService.getEntityTemplate(entityHandle);
    const populate = [
      ...new Set([
        ...template
          .filter((entry) => entry.isReference)
          .map((entry) => entry.name),
        ...this.metadata.collectPopulateRelations(
          entityHandle,
          relationExpressions,
        ),
      ]),
    ];
    const item = await this.em.findOne(
      entityClass,
      { handle: this.normalizeHandleValue(itemHandle) },
      { populate: populate as never[] },
    );

    if (!item) {
      throw new NotFoundException('global.entryNotFound');
    }
    return item;
  }

  replaceRecipients(
    input: string[] | string | undefined,
    context: JsonRecord,
  ): string[] {
    return this.renderer.replaceRecipients(input, context);
  }

  replacePlaceholders(
    template: string,
    context: JsonRecord,
    renderOptions: MessageTemplateRenderOptions = {},
  ): string {
    return this.renderer.replacePlaceholders(template, context, renderOptions);
  }

  renderMarkdown(markdown: string): string {
    return renderMessageMarkdown(markdown ?? '');
  }

  stripMarkdown(markdown: string): string {
    return messageHtmlToPlainText(this.renderMarkdown(markdown));
  }

  getContextValue(context: JsonRecord, expression: string): unknown {
    return this.renderer.getContextValue(context, expression);
  }

  private normalizeHandleValue(value: string | number): string | number {
    if (typeof value === 'number') {
      return value;
    }
    return /^\d+$/.test(value) ? Number(value) : value;
  }
}
