import { Injectable } from '@nestjs/common';
import { PersonItem } from '../../entity/PersonItem';
import { normalizeImportRow } from '../generic/generic-import.util';
import type { EntityTemplateDto } from '../template/dto/entity-template.dto';
import type { ImportFieldDefaultDto } from './import.types';

const REQUIRED_FIELDS_MISSING_MESSAGE_PREFIX = 'import.requiredFieldsMissing';
const INVALID_BOOLEAN_VALUES_MESSAGE_PREFIX = 'import.invalidBooleanValues';

@Injectable()
export class ImportFieldValidationService {
  applyDefaults(
    template: EntityTemplateDto[],
    payload: Record<string, unknown>,
    defaults: ImportFieldDefaultDto[],
    currentUser: PersonItem,
  ): void {
    for (const fieldDefault of defaults) {
      const targetField = this.normalizeOptionalString(
        fieldDefault.targetField,
      );
      const field = template.find((entry) => entry.name === targetField);
      if (!targetField || !field) {
        continue;
      }

      const currentValue = payload[targetField];
      if (currentValue != null && this.normalizeScalarString(currentValue)) {
        continue;
      }
      payload[targetField] = this.normalizeFieldDefaultValue(
        field,
        fieldDefault.value,
      );
    }

    this.applyCurrentPersonDefaults(template, payload, currentUser);
  }

  validatePrimitiveValues(
    template: EntityTemplateDto[],
    payload: Record<string, unknown>,
  ): void {
    this.validateDateValues(template, payload);
    this.validateBooleanValues(template, payload);
  }

  validateDateValues(
    template: EntityTemplateDto[],
    payload: Record<string, unknown>,
  ): void {
    const invalidDateFields = template
      .filter((field) => this.isDateField(field))
      .filter((field) => this.isInvalidDateValue(payload[field.name]))
      .map((field) => field.name);
    if (invalidDateFields.length > 0) {
      throw new Error(
        `import.invalidDateValues:${Array.from(new Set(invalidDateFields)).join(',')}`,
      );
    }
  }

  validateBooleanValues(
    template: EntityTemplateDto[],
    payload: Record<string, unknown>,
  ): void {
    const invalidBooleanFields = template
      .filter((field) => field.type === 'boolean')
      .filter(
        (field) =>
          payload[field.name] != null &&
          typeof payload[field.name] !== 'boolean',
      )
      .map((field) => field.name);
    if (invalidBooleanFields.length > 0) {
      throw new Error(
        `${INVALID_BOOLEAN_VALUES_MESSAGE_PREFIX}:${Array.from(new Set(invalidBooleanFields)).join(',')}`,
      );
    }
  }

  getMissingRequiredFieldNames(
    template: EntityTemplateDto[],
    payload: Record<string, unknown>,
    action: string | null,
  ): string[] {
    if (action === 'updated') {
      return [];
    }

    return template
      .filter((field) => {
        if (!field.isRequired || field.name === 'handle') {
          return false;
        }
        if (field.name.startsWith('customFields.') || field.customField) {
          return false;
        }
        const value = payload[field.name];
        return value == null || this.normalizeScalarString(value).length === 0;
      })
      .map((field) => field.name);
  }

  createRequiredFieldsMissingMessage(fieldNames: string[]): string {
    const normalizedFieldNames = Array.from(
      new Set(fieldNames.map((fieldName) => fieldName.trim()).filter(Boolean)),
    );
    return `${REQUIRED_FIELDS_MISSING_MESSAGE_PREFIX}:${normalizedFieldNames.join(',')}`;
  }

  private normalizeFieldDefaultValue(
    field: EntityTemplateDto,
    value: unknown,
  ): unknown {
    const normalizedValue =
      field.isReference && value && typeof value === 'object'
        ? ((value as Record<string, unknown>).handle ?? value)
        : value;
    return normalizeImportRow([field], {
      [field.name]: normalizedValue,
    })[field.name];
  }

  private applyCurrentPersonDefaults(
    template: EntityTemplateDto[],
    payload: Record<string, unknown>,
    currentUser: PersonItem,
  ): void {
    if (currentUser.handle == null) {
      return;
    }

    template
      .filter(
        (field) =>
          field.options?.includes('isCurrentPerson') &&
          field.referenceName === 'person',
      )
      .forEach((field) => {
        if (
          payload[field.name] == null ||
          String(payload[field.name]).trim() === ''
        ) {
          payload[field.name] = currentUser.handle;
        }
      });
  }

  private isDateField(field: EntityTemplateDto): boolean {
    return ['date', 'datetime', 'DateType'].includes(field.type);
  }

  private isInvalidDateValue(value: unknown): boolean {
    if (value == null || value instanceof Date || typeof value !== 'string') {
      return false;
    }
    const normalizedValue = value.trim();
    if (!normalizedValue) {
      return false;
    }
    return (
      normalizedValue.toLowerCase() === 'null' ||
      Number.isNaN(Date.parse(normalizedValue))
    );
  }

  private normalizeOptionalString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private normalizeScalarString(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }
    return typeof value === 'number' || typeof value === 'boolean'
      ? value.toString().trim()
      : '';
  }
}
