import { BadRequestException } from '@nestjs/common';
import { wrap } from '@mikro-orm/core';
import { CustomFieldDefinitionItem } from '../../entity/CustomFieldDefinitionItem';
import { CustomFieldValueItem } from '../../entity/CustomFieldValueItem';
import {
  CustomFieldTypeItem,
  type CustomFieldType,
} from '../../entity/CustomFieldTypeItem';

import type { CustomFieldPayload } from './generic-custom-field.types';

export class CustomFieldValueCodec {
  normalizePayloadRecord(value: unknown): CustomFieldPayload {
    return this.isPlainRecord(value) ? { ...value } : {};
  }

  normalizeValue(
    definition: CustomFieldDefinitionItem,
    value: unknown,
  ): unknown {
    if (value == null || value === '') {
      return null;
    }

    switch (this.getDefinitionFieldType(definition)) {
      case 'number': {
        const numberValue = Number(value);
        return Number.isFinite(numberValue) ? numberValue : null;
      }
      case 'boolean':
        return this.normalizeBoolean(value);
      case 'date':
      case 'dateTime':
        return this.normalizeDate(value);
      case 'multiSelect':
        return this.normalizeMultiSelect(definition, value);
      case 'select':
        return this.normalizeSelect(definition, value);
      case 'longText':
      case 'text':
      default:
        return this.normalizeText(value);
    }
  }

  private normalizeBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 'ja'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'off', 'nein'].includes(normalized)) {
      return false;
    }

    return null;
  }

  private normalizeDate(value: unknown): Date | null {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value !== 'string' && typeof value !== 'number') {
      return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private normalizeSelect(
    definition: CustomFieldDefinitionItem,
    value: unknown,
  ): string | null {
    const normalized = this.normalizeText(value);
    if (!normalized) {
      return null;
    }

    const allowed = this.getAllowedSelectValues(definition);
    return allowed.size === 0 || allowed.has(normalized) ? normalized : null;
  }

  private normalizeText(value: unknown): string | null {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value).trim();
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    return null;
  }

  normalizeRecordReference(value: unknown): string {
    return typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : '';
  }

  private normalizeMultiSelect(
    definition: CustomFieldDefinitionItem,
    value: unknown,
  ): string[] {
    const values = Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value.split(',').map((entry) => entry.trim())
        : [];
    const allowed = this.getAllowedSelectValues(definition);

    return values
      .map((entry) => String(entry ?? '').trim())
      .filter((entry) => entry && (allowed.size === 0 || allowed.has(entry)));
  }

  private getAllowedSelectValues(
    definition: CustomFieldDefinitionItem,
  ): Set<string> {
    return new Set(
      (definition.selectOptions ?? [])
        .map((option) => option.value?.trim())
        .filter((value): value is string => Boolean(value)),
    );
  }

  assignValue(
    item: CustomFieldValueItem,
    fieldType: CustomFieldType,
    value: unknown,
  ): void {
    item.valueString = null;
    item.valueNumber = null;
    item.valueBoolean = null;
    item.valueDate = null;
    item.valueDateTime = null;
    item.valueJson = null;

    switch (fieldType) {
      case 'number':
        item.valueNumber = value as number;
        break;
      case 'boolean':
        item.valueBoolean = value as boolean;
        break;
      case 'date':
        item.valueDate = value as Date;
        break;
      case 'dateTime':
        item.valueDateTime = value as Date;
        break;
      case 'multiSelect':
        item.valueJson = value;
        break;
      case 'select':
      case 'longText':
      case 'text':
      default:
        item.valueString = String(value);
        break;
    }
  }

  extractValue(
    item: CustomFieldValueItem,
    fieldType: CustomFieldType,
  ): unknown {
    switch (fieldType) {
      case 'number':
        return item.valueNumber ?? null;
      case 'boolean':
        return item.valueBoolean ?? null;
      case 'date':
        return item.valueDate ?? null;
      case 'dateTime':
        return item.valueDateTime ?? null;
      case 'multiSelect':
        return item.valueJson ?? [];
      case 'select':
      case 'longText':
      case 'text':
      default:
        return item.valueString ?? null;
    }
  }

  getValueColumn(fieldType: CustomFieldType): keyof CustomFieldValueItem {
    switch (fieldType) {
      case 'number':
        return 'valueNumber';
      case 'boolean':
        return 'valueBoolean';
      case 'date':
        return 'valueDate';
      case 'dateTime':
        return 'valueDateTime';
      case 'multiSelect':
        return 'valueJson';
      case 'select':
      case 'longText':
      case 'text':
      default:
        return 'valueString';
    }
  }

  getDefinitionFieldType(
    definition: CustomFieldDefinitionItem,
  ): CustomFieldType {
    const value = definition.fieldType as unknown;
    const handle =
      typeof value === 'string'
        ? value
        : this.isPlainRecord(value)
          ? String((value as Partial<CustomFieldTypeItem>).handle ?? '')
          : '';

    if (this.isCustomFieldType(handle)) {
      return handle;
    }

    throw new BadRequestException(
      'exception.badRequest',
      `Invalid custom field type "${handle}"`,
    );
  }

  private isCustomFieldType(value: string): value is CustomFieldType {
    return [
      'text',
      'longText',
      'number',
      'boolean',
      'date',
      'dateTime',
      'select',
      'multiSelect',
    ].includes(value);
  }

  hasCustomFieldValue(value: unknown): boolean {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return value !== null && typeof value !== 'undefined' && value !== '';
  }

  isPlainRecord(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }

    try {
      const object = wrap(value).toObject();
      return !!object && typeof object === 'object' && !Array.isArray(object);
    } catch {
      return true;
    }
  }
}
