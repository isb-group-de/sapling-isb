import { Injectable } from '@nestjs/common';
import type { EntityTemplateDto } from '../template/dto/entity-template.dto';
import type {
  SaplingFormConfigValidationIssueDto,
  SaplingFormConfigValidationResultDto,
} from './dto/form-config.dto';
import {
  SAPLING_FORM_CONFIG_SCHEMA,
  type NormalizedSaplingFormConfig,
  type SaplingFormFieldConfig,
  type SaplingFormGroupConfig,
  type SaplingFormFieldWidth,
  type SaplingFormRenderer,
} from './form-config.types';

const FIELD_RENDERERS = new Set<SaplingFormRenderer>([
  'auto',
  'shortText',
  'longText',
  'number',
  'boolean',
  'date',
  'dateTime',
  'time',
  'markdown',
  'json',
  'phone',
  'mail',
  'link',
  'password',
  'money',
  'percent',
  'color',
  'icon',
  'select',
  'multiSelect',
]);

export type SaplingFormConfigValidationResult =
  SaplingFormConfigValidationResultDto & {
    normalizedConfig: NormalizedSaplingFormConfig;
  };

@Injectable()
export class FormConfigValidationService {
  validateConfig(
    entityHandle: string,
    config: unknown,
    templates: EntityTemplateDto[],
  ): SaplingFormConfigValidationResult {
    const errors: SaplingFormConfigValidationIssueDto[] = [];
    const warnings: SaplingFormConfigValidationIssueDto[] = [];
    const templateNames = new Set(templates.map((template) => template.name));
    const normalizedConfig = this.normalizeConfig(entityHandle, config, errors);

    if (normalizedConfig.entityHandle !== entityHandle) {
      errors.push({
        path: 'entityHandle',
        message: 'exception.formConfigEntityMismatch',
      });
    }

    for (const fieldName of Object.keys(normalizedConfig.fields)) {
      if (!templateNames.has(fieldName)) {
        warnings.push({
          path: `fields.${fieldName}`,
          message: 'exception.formConfigUnknownField',
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      normalizedConfig,
    };
  }

  normalizeConfig(
    entityHandle: string,
    config: unknown,
    errors: SaplingFormConfigValidationIssueDto[] = [],
  ): NormalizedSaplingFormConfig {
    const record =
      config && typeof config === 'object' && !Array.isArray(config)
        ? (config as Record<string, unknown>)
        : {};

    if (Object.keys(record).length === 0) {
      errors.push({
        path: '',
        message: 'exception.formConfigInvalidJson',
      });
    }

    const configEntityHandle =
      typeof record.entityHandle === 'string' && record.entityHandle.trim()
        ? record.entityHandle.trim()
        : entityHandle;

    return {
      schema: SAPLING_FORM_CONFIG_SCHEMA,
      entityHandle: configEntityHandle,
      fields: this.normalizeFields(record.fields),
      groups: this.normalizeGroups(record.groups),
      layout: this.normalizeRecord(record.layout),
      metadata: this.normalizeRecord(record.metadata),
    };
  }

  private normalizeFields(
    value: unknown,
  ): Record<string, SaplingFormFieldConfig> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    const fields: Record<string, SaplingFormFieldConfig> = {};

    for (const [fieldName, fieldValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      const normalizedFieldName = fieldName.trim();
      if (!normalizedFieldName) {
        continue;
      }

      fields[normalizedFieldName] = this.normalizeFieldConfig(fieldValue);
    }

    return fields;
  }

  private normalizeGroups(
    value: unknown,
  ): Record<string, SaplingFormGroupConfig> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    const groups: Record<string, SaplingFormGroupConfig> = {};
    for (const [groupKey, groupValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      const normalizedKey = groupKey.trim();
      if (!normalizedKey) {
        continue;
      }

      groups[normalizedKey] = this.normalizeGroupConfig(groupValue);
    }

    return groups;
  }

  private normalizeGroupConfig(value: unknown): SaplingFormGroupConfig {
    if (!this.isPlainRecord(value)) {
      return {};
    }

    const groupConfig: SaplingFormGroupConfig = {};
    if (typeof value.visible === 'boolean') {
      groupConfig.visible = value.visible;
    }
    if (Object.prototype.hasOwnProperty.call(value, 'order')) {
      groupConfig.order =
        typeof value.order === 'number' && Number.isFinite(value.order)
          ? Math.trunc(value.order)
          : null;
    }
    if (Object.prototype.hasOwnProperty.call(value, 'label')) {
      groupConfig.label =
        typeof value.label === 'string' && value.label.trim()
          ? value.label.trim()
          : null;
    }
    if (this.isPlainRecord(value.metadata) || value.metadata === null) {
      groupConfig.metadata = value.metadata;
    }

    return groupConfig;
  }

  private normalizeFieldConfig(value: unknown): SaplingFormFieldConfig {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    const record = value as Record<string, unknown>;
    const fieldConfig: SaplingFormFieldConfig = {};

    this.setBoolean(record, fieldConfig, 'visible');
    this.setBoolean(record, fieldConfig, 'required');
    this.setBoolean(record, fieldConfig, 'readonly');
    this.setBoolean(record, fieldConfig, 'tableVisible');
    this.setBoolean(record, fieldConfig, 'mobileVisible');
    this.setNullableString(record, fieldConfig, 'group');
    this.setNullableString(record, fieldConfig, 'label');
    this.setNullableString(record, fieldConfig, 'helpText');
    this.setNullableString(record, fieldConfig, 'placeholder');
    this.setNullableNumber(record, fieldConfig, 'groupOrder');
    this.setNullableNumber(record, fieldConfig, 'order');
    this.setNullableNumber(record, fieldConfig, 'tableOrder');
    this.setNullableNumber(record, fieldConfig, 'mobileOrder');
    this.setNullableWidth(record, fieldConfig, 'width');
    this.setRenderer(record, fieldConfig);

    if (Object.prototype.hasOwnProperty.call(record, 'defaultValue')) {
      fieldConfig.defaultValue = record.defaultValue;
    }
    if (Array.isArray(record.validation)) {
      fieldConfig.validation = record.validation;
    }
    if (this.isPlainRecord(record.condition) || record.condition === null) {
      fieldConfig.condition = record.condition;
    }
    if (
      this.isPlainRecord(record.referenceFilter) ||
      record.referenceFilter === null
    ) {
      fieldConfig.referenceFilter = record.referenceFilter;
    }
    if (this.isPlainRecord(record.metadata) || record.metadata === null) {
      fieldConfig.metadata = record.metadata;
    }

    return fieldConfig;
  }

  private setBoolean(
    source: Record<string, unknown>,
    target: SaplingFormFieldConfig,
    key: 'visible' | 'required' | 'readonly' | 'tableVisible' | 'mobileVisible',
  ): void {
    if (typeof source[key] === 'boolean') {
      target[key] = source[key];
    }
  }

  private setNullableString(
    source: Record<string, unknown>,
    target: SaplingFormFieldConfig,
    key: 'group' | 'label' | 'helpText' | 'placeholder',
  ): void {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      return;
    }

    target[key] =
      typeof source[key] === 'string' && source[key].trim()
        ? source[key].trim()
        : null;
  }

  private setNullableNumber(
    source: Record<string, unknown>,
    target: SaplingFormFieldConfig,
    key: 'groupOrder' | 'order' | 'tableOrder' | 'mobileOrder',
  ): void {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      return;
    }

    target[key] =
      typeof source[key] === 'number' && Number.isFinite(source[key])
        ? Math.trunc(source[key])
        : null;
  }

  private setNullableWidth(
    source: Record<string, unknown>,
    target: SaplingFormFieldConfig,
    key: 'width',
  ): void {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      return;
    }

    target[key] =
      typeof source[key] === 'number' && Number.isFinite(source[key])
        ? (Math.max(
            1,
            Math.min(4, Math.trunc(source[key])),
          ) as SaplingFormFieldWidth)
        : null;
  }

  private setRenderer(
    source: Record<string, unknown>,
    target: SaplingFormFieldConfig,
  ): void {
    if (!Object.prototype.hasOwnProperty.call(source, 'renderer')) {
      return;
    }

    if (typeof source.renderer !== 'string') {
      target.renderer = null;
      return;
    }

    const renderer = source.renderer.trim() as SaplingFormRenderer;
    target.renderer = FIELD_RENDERERS.has(renderer) ? renderer : null;
  }

  private normalizeRecord(value: unknown): Record<string, unknown> {
    return this.isPlainRecord(value) ? { ...value } : {};
  }

  private isPlainRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }
}
