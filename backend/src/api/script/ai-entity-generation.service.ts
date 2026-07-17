import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, type EntityName } from '@mikro-orm/core';
import { AiEntityGenerationTemplateItem } from '../../entity/AiEntityGenerationTemplateItem';
import { EntityItem } from '../../entity/EntityItem';
import { PersonItem } from '../../entity/PersonItem';
import { PermissionItem } from '../../entity/PermissionItem';
import { RoleItem } from '../../entity/RoleItem';
import { ENTITY_MAP } from '../../entity/global/entity.registry';
import { AiProviderRegistryService } from '../ai/ai-provider-registry.service';
import { createGeminiClient } from '../ai/gemini-ai.runtime';
import { createOpenAiClient } from '../ai/openai-ai.runtime';
import {
  extractModelHandle,
  extractProviderHandle,
} from '../ai/ai-response.utils';
import { GenericPermissionService } from '../generic/generic-permission.service';
import { AiEntityGenerationPayloadBuilder } from './ai-entity-generation-payload.builder';

type AiEntityGenerationParameter = {
  template?: string;
  templateHandle?: string;
};

type AiEntityGenerationOptions = {
  items: object[];
  sourceEntity: EntityItem;
  user: PersonItem;
  actionName: string;
  parameter?: unknown;
};

export type AiEntityGenerationResult = {
  templateHandle: string;
  targetEntityHandle: string;
  createdItem: Record<string, unknown>;
  payload: Record<string, unknown>;
};

@Injectable()
export class AiEntityGenerationService {
  private readonly payloadBuilder = new AiEntityGenerationPayloadBuilder();

  constructor(
    private readonly em: EntityManager,
    private readonly providerRegistry: AiProviderRegistryService,
    private readonly genericPermissionService: GenericPermissionService,
  ) {}

  async generateFromScriptButton(
    options: AiEntityGenerationOptions,
  ): Promise<AiEntityGenerationResult> {
    if (options.items.length !== 1) {
      throw new BadRequestException(
        'aiEntityGeneration.singleSelectionRequired',
      );
    }

    const permissionUser = await this.loadPermissionUser(options.user);
    const sourceEntityHandle = this.requireEntityHandle(options.sourceEntity);
    const sourceHandle = this.requireSourceHandle(options.items[0]);
    const template = await this.loadTemplate(
      sourceEntityHandle,
      options.actionName,
      options.parameter,
    );
    const targetEntityHandle = this.requireEntityHandle(template.targetEntity);

    this.assertPermission(permissionUser, sourceEntityHandle, 'allowRead');
    this.assertPermission(permissionUser, targetEntityHandle, 'allowInsert');

    const sourceRecord = await this.loadSourceRecord(
      sourceEntityHandle,
      sourceHandle,
      template,
    );
    const generatedFields = await this.generateFields(
      template,
      sourceEntityHandle,
      targetEntityHandle,
      sourceRecord,
    );
    const payload = this.payloadBuilder.build(
      template,
      generatedFields,
      sourceRecord,
      sourceHandle,
      permissionUser,
    );
    this.genericPermissionService.checkTopLevelPermission(
      targetEntityHandle,
      payload,
      permissionUser,
      'allowInsertStage',
    );
    const createdItem = await this.createTargetRecord(
      targetEntityHandle,
      payload,
    );

    return {
      templateHandle: template.handle,
      targetEntityHandle,
      createdItem,
      payload,
    };
  }

  private async loadTemplate(
    sourceEntityHandle: string,
    actionName: string,
    parameter?: unknown,
  ): Promise<AiEntityGenerationTemplateItem> {
    const templateHandle = this.extractTemplateHandle(parameter);
    const template = await this.em.findOne(
      AiEntityGenerationTemplateItem,
      {
        isActive: true,
        actionName,
        sourceEntity: { handle: sourceEntityHandle },
        ...(templateHandle ? { handle: templateHandle } : {}),
      },
      {
        populate: ['sourceEntity', 'targetEntity', 'provider', 'model'],
        orderBy: { sortOrder: 'ASC', title: 'ASC' },
      },
    );

    if (!template) {
      throw new NotFoundException('aiEntityGeneration.templateNotFound');
    }

    return template;
  }

  private async loadSourceRecord(
    sourceEntityHandle: string,
    sourceHandle: string | number,
    template: AiEntityGenerationTemplateItem,
  ): Promise<object> {
    const sourceEntityClass = this.getEntityClass(sourceEntityHandle);

    const sourceRecord = await this.em.findOne(
      sourceEntityClass,
      { handle: sourceHandle },
      {
        populate: this.normalizeRelations(template.sourceRelations) as never[],
      },
    );

    if (!sourceRecord) {
      throw new NotFoundException('global.notFound');
    }

    return sourceRecord;
  }

  private async generateFields(
    template: AiEntityGenerationTemplateItem,
    sourceEntityHandle: string,
    targetEntityHandle: string,
    sourceRecord: object,
  ): Promise<Record<string, unknown>> {
    const providerHandle = extractProviderHandle(template.provider);
    const modelHandle = extractModelHandle(template.model);
    const runtimeTarget = await this.providerRegistry.resolveRuntimeTarget(
      providerHandle,
      modelHandle,
    );
    const systemPrompt = this.payloadBuilder.buildSystemPrompt(
      template,
      targetEntityHandle,
    );
    const userPrompt = this.payloadBuilder.buildUserPrompt(
      template,
      sourceEntityHandle,
      targetEntityHandle,
      sourceRecord,
    );
    const rawText =
      runtimeTarget.providerKind === 'gemini'
        ? await this.generateGeminiText(
            runtimeTarget.provider,
            runtimeTarget.model.providerModel,
            systemPrompt,
            userPrompt,
          )
        : await this.generateOpenAiText(
            runtimeTarget.provider,
            runtimeTarget.model.providerModel,
            systemPrompt,
            userPrompt,
          );

    return this.payloadBuilder.parseJsonObject(rawText);
  }

  private async generateOpenAiText(
    provider: Parameters<typeof createOpenAiClient>[0],
    model: string,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    const response = await createOpenAiClient(provider).chat.completions.create(
      {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      },
    );

    return response.choices[0]?.message?.content ?? '';
  }

  private async generateGeminiText(
    provider: Parameters<typeof createGeminiClient>[0],
    modelName: string,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    const model = createGeminiClient(provider).getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContent(userPrompt);

    return result.response.text();
  }

  private async createTargetRecord(
    targetEntityHandle: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const targetEntityClass = this.getEntityClass(targetEntityHandle);

    const entity = this.em.create(targetEntityClass, payload as never);
    await this.em.persist(entity).flush();

    return this.payloadBuilder.toPlainRecord(entity);
  }

  private async loadPermissionUser(user: PersonItem): Promise<PersonItem> {
    if (!user?.handle) {
      throw new ForbiddenException('global.permissionDenied');
    }

    const loadedUser = await this.em.findOne(
      PersonItem,
      { handle: user.handle },
      { populate: ['roles.permissions.entity', 'company'] },
    );

    return loadedUser ?? user;
  }

  private assertPermission(
    user: PersonItem,
    entityHandle: string,
    permissionKey: 'allowRead' | 'allowInsert',
  ): void {
    for (const role of this.toArray<RoleItem>(user.roles)) {
      for (const permission of this.toArray<PermissionItem>(role.permissions)) {
        const permissionEntityHandle = this.extractPermissionEntityHandle(
          permission.entity,
        );

        if (
          permissionEntityHandle === entityHandle &&
          permission[permissionKey] === true
        ) {
          return;
        }
      }
    }

    throw new ForbiddenException('global.permissionDenied');
  }

  private extractPermissionEntityHandle(entity: unknown): string | null {
    if (typeof entity === 'string') {
      return entity;
    }

    if (entity && typeof entity === 'object' && 'handle' in entity) {
      const handle = (entity as { handle?: unknown }).handle;
      return typeof handle === 'string' ? handle : null;
    }

    return null;
  }

  private requireEntityHandle(entity: EntityItem | string): string {
    const handle = typeof entity === 'string' ? entity : entity?.handle;

    if (!handle || typeof handle !== 'string') {
      throw new BadRequestException('global.entityNotFound');
    }

    return handle;
  }

  private getEntityClass(entityHandle: string): EntityName<object> {
    const entityClass = ENTITY_MAP[entityHandle] as
      EntityName<object> | undefined;

    if (!entityClass) {
      throw new NotFoundException('global.entityNotFound');
    }

    return entityClass;
  }

  private requireSourceHandle(item: object): string | number {
    const handle = (item as { handle?: unknown }).handle;

    if (typeof handle === 'string' || typeof handle === 'number') {
      return handle;
    }

    throw new BadRequestException('global.invalidPayload');
  }

  private extractTemplateHandle(parameter?: unknown): string | undefined {
    const normalized = this.normalizeRecord(
      parameter,
    ) as AiEntityGenerationParameter | null;
    const template = normalized?.template ?? normalized?.templateHandle;

    return typeof template === 'string' && template.trim()
      ? template.trim()
      : undefined;
  }

  private normalizeRelations(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(
      (relation): relation is string =>
        typeof relation === 'string' && relation.trim().length > 0,
    );
  }

  private normalizeRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private toArray<T>(value: unknown): T[] {
    if (Array.isArray(value)) {
      return value as T[];
    }

    if (value && typeof value === 'object') {
      const collection = value as {
        getItems?: () => T[];
        toArray?: () => T[];
        [Symbol.iterator]?: () => Iterator<T>;
      };

      if (typeof collection.getItems === 'function') {
        return collection.getItems();
      }

      if (typeof collection.toArray === 'function') {
        return collection.toArray();
      }

      if (typeof collection[Symbol.iterator] === 'function') {
        return Array.from(collection as Iterable<T>);
      }
    }

    return [];
  }
}
