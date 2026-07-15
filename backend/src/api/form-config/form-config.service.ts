import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { EntityItem } from '../../entity/EntityItem';
import { PersonItem } from '../../entity/PersonItem';
import {
  SaplingFormConfigItem,
  type SaplingFormConfigScope,
} from '../../entity/SaplingFormConfigItem';
import type { EntityTemplateDto } from '../template/dto/entity-template.dto';
import {
  type NormalizedSaplingFormConfig,
  type SaplingFormFieldConfig,
  type SaplingFormGroupConfig,
} from './form-config.types';
import type { SaveSaplingFormConfigDto } from './dto/form-config.dto';
import {
  FormConfigValidationService,
  type SaplingFormConfigValidationResult,
} from './form-config-validation.service';

const CONFIG_SCOPE_ORDER: Record<SaplingFormConfigScope, number> = {
  global: 0,
  role: 1,
  person: 2,
};

type PreparedSaplingFormConfigSave = {
  entityHandle: string;
  name: string;
  scope: SaplingFormConfigScope;
  scopeHandle?: string;
  isActive: boolean;
  isDefault: boolean;
  version: number;
  config: NormalizedSaplingFormConfig;
  personHandle: number | null;
};

@Injectable()
export class FormConfigService {
  constructor(
    private readonly em: EntityManager,
    private readonly validationService: FormConfigValidationService = new FormConfigValidationService(),
  ) {}

  async listConfigs(entityHandle: string): Promise<SaplingFormConfigItem[]> {
    return this.em.find(
      SaplingFormConfigItem,
      { entity: { handle: entityHandle } },
      { orderBy: { scope: 'ASC', name: 'ASC', handle: 'ASC' } },
    );
  }

  async getConfig(
    entityHandle: string,
    handle: number,
  ): Promise<SaplingFormConfigItem> {
    const config = await this.em.findOne(
      SaplingFormConfigItem,
      {
        handle,
        entity: { handle: entityHandle },
      },
      { populate: ['entity', 'person'] },
    );

    if (!config) {
      throw new NotFoundException('global.notFound');
    }

    return config;
  }

  async saveConfig(
    entityHandle: string,
    payload: SaveSaplingFormConfigDto,
    templates: EntityTemplateDto[],
    existingHandle?: number,
  ): Promise<SaplingFormConfigItem> {
    const preparedPayload = this.prepareSavePayload(
      entityHandle,
      payload,
      templates,
    );

    const entity = await this.em.findOne(EntityItem, {
      handle: preparedPayload.entityHandle,
    });
    if (!entity) {
      throw new NotFoundException('global.entityNotFound');
    }

    let configItem =
      typeof existingHandle === 'number'
        ? await this.getConfig(entityHandle, existingHandle)
        : null;

    if (!configItem) {
      configItem = new SaplingFormConfigItem();
    }

    configItem.name = preparedPayload.name;
    configItem.entity = entity;
    configItem.scope = preparedPayload.scope;
    configItem.scopeHandle = preparedPayload.scopeHandle;
    configItem.isActive = preparedPayload.isActive;
    configItem.isDefault = preparedPayload.isDefault;
    configItem.version = preparedPayload.version;
    configItem.config = preparedPayload.config;

    configItem.person =
      preparedPayload.personHandle != null
        ? ((await this.em.findOne(PersonItem, {
            handle: preparedPayload.personHandle,
          })) ?? undefined)
        : undefined;

    this.em.persist(configItem);
    await this.em.flush();

    return configItem;
  }

  prepareSavePayload(
    entityHandle: string,
    payload: SaveSaplingFormConfigDto,
    templates: EntityTemplateDto[],
  ): PreparedSaplingFormConfigSave {
    const validation = this.validateConfig(
      entityHandle,
      payload.config,
      templates,
    );
    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'formConfig.validationFailed',
        error: 'Bad Request',
        details: {
          summary: validation.errors
            .map((issue) => `${issue.path}: ${issue.message}`)
            .join(', '),
          errors: validation.errors,
          warnings: validation.warnings,
        },
      });
    }

    const normalizedScope = this.normalizeScope(payload.scope);
    const normalizedScopeHandle = this.normalizeOptionalString(
      payload.scopeHandle,
    );
    const normalizedName = this.normalizeRequiredString(payload.name, 'name');
    const personHandle =
      normalizedScope === 'person' && normalizedScopeHandle
        ? Number(normalizedScopeHandle)
        : null;

    return {
      entityHandle,
      name: normalizedName,
      scope: normalizedScope,
      scopeHandle:
        normalizedScope === 'global' ? undefined : normalizedScopeHandle,
      isActive: payload.isActive !== false,
      isDefault: payload.isDefault === true,
      version: 1,
      config: validation.normalizedConfig,
      personHandle:
        personHandle != null && Number.isFinite(personHandle)
          ? personHandle
          : null,
    };
  }

  validateConfig(
    entityHandle: string,
    config: unknown,
    templates: EntityTemplateDto[],
  ): SaplingFormConfigValidationResult {
    return this.validationService.validateConfig(
      entityHandle,
      config,
      templates,
    );
  }

  async getEffectiveTemplate(
    entityHandle: string,
    templates: EntityTemplateDto[],
    person?: PersonItem | null,
  ): Promise<EntityTemplateDto[]> {
    const configs = await this.findApplicableConfigs(entityHandle, person);
    const mergedFields = this.mergeFieldConfigs(configs);
    const mergedGroups = this.mergeGroupConfigs(configs);

    return templates.map((template) => {
      const fieldConfig = mergedFields[template.name];
      const fieldTemplate = fieldConfig
        ? this.applyFieldConfig(template, fieldConfig)
        : template;
      const groupKey = fieldTemplate.formGroup?.trim();
      const groupConfig = groupKey ? mergedGroups[groupKey] : undefined;

      return groupConfig
        ? this.applyGroupConfig(fieldTemplate, groupConfig)
        : fieldTemplate;
    });
  }

  private async findApplicableConfigs(
    entityHandle: string,
    person?: PersonItem | null,
  ): Promise<NormalizedSaplingFormConfig[]> {
    const roleHandles = this.getPersonRoleHandles(person);
    const personHandle = person?.handle != null ? String(person.handle) : null;
    const items = await this.em.find(
      SaplingFormConfigItem,
      {
        entity: { handle: entityHandle },
        isActive: true,
      },
      {
        orderBy: { scope: 'ASC', isDefault: 'DESC', handle: 'ASC' },
      },
    );

    return items
      .filter((item) =>
        this.isConfigApplicable(item, roleHandles, personHandle),
      )
      .sort((left, right) => {
        const leftOrder = CONFIG_SCOPE_ORDER[left.scope] ?? 0;
        const rightOrder = CONFIG_SCOPE_ORDER[right.scope] ?? 0;
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        return (left.handle ?? 0) - (right.handle ?? 0);
      })
      .map((item) =>
        this.validationService.normalizeConfig(entityHandle, item.config),
      );
  }

  private isConfigApplicable(
    item: SaplingFormConfigItem,
    roleHandles: Set<string>,
    personHandle: string | null,
  ): boolean {
    if (item.scope === 'global') {
      return true;
    }

    const scopeHandle = item.scopeHandle?.trim();
    if (!scopeHandle) {
      return false;
    }

    if (item.scope === 'role') {
      return roleHandles.has(scopeHandle);
    }

    return personHandle === scopeHandle;
  }

  private getPersonRoleHandles(person?: PersonItem | null): Set<string> {
    const roles = person?.roles;
    if (!roles) {
      return new Set<string>();
    }

    const values =
      typeof (roles as { getItems?: () => unknown }).getItems === 'function'
        ? (roles as { getItems: () => unknown }).getItems()
        : roles;

    if (!Array.isArray(values)) {
      return new Set<string>();
    }

    return new Set(
      values.map((role) => this.extractRoleHandle(role)).filter(Boolean),
    );
  }

  private mergeFieldConfigs(
    configs: NormalizedSaplingFormConfig[],
  ): Record<string, SaplingFormFieldConfig> {
    const merged: Record<string, SaplingFormFieldConfig> = {};

    for (const config of configs) {
      for (const [fieldName, fieldConfig] of Object.entries(config.fields)) {
        merged[fieldName] = {
          ...(merged[fieldName] ?? {}),
          ...fieldConfig,
        };
      }
    }

    return merged;
  }

  private mergeGroupConfigs(
    configs: NormalizedSaplingFormConfig[],
  ): Record<string, SaplingFormGroupConfig> {
    const merged: Record<string, SaplingFormGroupConfig> = {};

    for (const config of configs) {
      for (const [groupKey, groupConfig] of Object.entries(config.groups)) {
        merged[groupKey] = {
          ...(merged[groupKey] ?? {}),
          ...groupConfig,
        };
      }
    }

    return merged;
  }

  private applyGroupConfig(
    template: EntityTemplateDto,
    groupConfig: SaplingFormGroupConfig,
  ): EntityTemplateDto {
    const nextTemplate: EntityTemplateDto = {
      ...template,
      formGroupConfig: {
        ...(template.formGroupConfig ?? {}),
        ...groupConfig,
      },
    };

    if (Object.prototype.hasOwnProperty.call(groupConfig, 'order')) {
      nextTemplate.formGroupOrder = groupConfig.order ?? null;
    }
    if (groupConfig.visible === false) {
      nextTemplate.formVisible = false;
    }

    return nextTemplate;
  }

  private applyFieldConfig(
    template: EntityTemplateDto,
    fieldConfig: SaplingFormFieldConfig,
  ): EntityTemplateDto {
    const mergedFormConfig: SaplingFormFieldConfig = {
      ...(template.formConfig ?? {}),
      ...fieldConfig,
    };
    const isBooleanTemplate =
      template.type === 'boolean' ||
      template.formConfig?.renderer === 'boolean' ||
      fieldConfig.renderer === 'boolean';

    if (fieldConfig.label == null && template.formConfig?.label) {
      mergedFormConfig.label = template.formConfig.label;
    }
    if (isBooleanTemplate) {
      mergedFormConfig.required = false;
    }

    const nextTemplate = {
      ...template,
      formConfig: mergedFormConfig,
    };

    if (Object.prototype.hasOwnProperty.call(fieldConfig, 'group')) {
      nextTemplate.formGroup = fieldConfig.group ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(fieldConfig, 'groupOrder')) {
      nextTemplate.formGroupOrder = fieldConfig.groupOrder ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(fieldConfig, 'order')) {
      nextTemplate.formOrder = fieldConfig.order ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(fieldConfig, 'width')) {
      nextTemplate.formWidth = fieldConfig.width ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(fieldConfig, 'visible')) {
      nextTemplate.formVisible = fieldConfig.visible ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(fieldConfig, 'tableOrder')) {
      nextTemplate.tableOrder = fieldConfig.tableOrder ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(fieldConfig, 'tableVisible')) {
      nextTemplate.tableVisible = fieldConfig.tableVisible ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(fieldConfig, 'mobileOrder')) {
      nextTemplate.mobileOrder = fieldConfig.mobileOrder ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(fieldConfig, 'mobileVisible')) {
      nextTemplate.mobileVisible = fieldConfig.mobileVisible ?? null;
    }
    if (isBooleanTemplate) {
      nextTemplate.isRequired = false;
      return nextTemplate;
    }
    if (fieldConfig.required === true) {
      nextTemplate.isRequired = true;
    }
    if (fieldConfig.required === false && template.nullable !== false) {
      nextTemplate.isRequired = false;
    }

    return nextTemplate;
  }

  private normalizeScope(scope: unknown): SaplingFormConfigScope {
    return scope === 'role' || scope === 'person' ? scope : 'global';
  }

  private normalizeRequiredString(value: unknown, path: string): string {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    throw new BadRequestException(`${path}: exception.badRequest`);
  }

  private normalizeOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private extractRoleHandle(role: unknown): string {
    if (!role || typeof role !== 'object' || !('handle' in role)) {
      return '';
    }

    const handle = (role as { handle?: unknown }).handle;
    return typeof handle === 'string' || typeof handle === 'number'
      ? String(handle)
      : '';
  }
}
