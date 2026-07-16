import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager, wrap } from '@mikro-orm/core';
import { CustomFieldDefinitionItem } from '../../entity/CustomFieldDefinitionItem';
import { CustomFieldValueItem } from '../../entity/CustomFieldValueItem';
import { EntityItem } from '../../entity/EntityItem';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { createCustomFieldTemplate } from './generic-custom-field-template.factory';
import { CustomFieldValueCodec } from './generic-custom-field-value.codec';
import {
  CUSTOM_FIELD_PAYLOAD_KEY,
  CUSTOM_FIELD_TEMPLATE_PREFIX,
  type CustomFieldPayload,
} from './generic-custom-field.types';

export { CUSTOM_FIELD_PAYLOAD_KEY, CUSTOM_FIELD_TEMPLATE_PREFIX };

type SplitPayload<T extends Record<string, unknown>> = {
  data: T;
  customFields: CustomFieldPayload;
};

@Injectable()
export class GenericCustomFieldService {
  private readonly valueCodec = new CustomFieldValueCodec();
  private static readonly customFieldTemplateCache = new Map<
    string,
    Promise<EntityTemplateDto[]>
  >();
  private static readonly hasActiveDefinitionCache = new Map<
    string,
    Promise<boolean>
  >();

  constructor(private readonly em: EntityManager) {}

  async getActiveDefinitions(
    entityHandle: string,
  ): Promise<CustomFieldDefinitionItem[]> {
    const definitions = await this.em.find(
      CustomFieldDefinitionItem,
      { entity: { handle: entityHandle }, isActive: true },
      {
        orderBy: { fieldOrder: 'ASC', fieldKey: 'ASC' },
        populate: ['fieldType'],
      },
    );
    this.rememberHasActiveDefinitions(entityHandle, definitions.length > 0);
    return definitions;
  }

  async appendCustomFieldTemplates(
    entityHandle: string,
    templates: EntityTemplateDto[],
  ): Promise<EntityTemplateDto[]> {
    let cachedTemplates =
      GenericCustomFieldService.customFieldTemplateCache.get(entityHandle);
    if (!cachedTemplates) {
      cachedTemplates = this.getActiveDefinitions(entityHandle).then(
        (definitions) =>
          definitions.map((definition) =>
            createCustomFieldTemplate(definition),
          ),
      );
      GenericCustomFieldService.customFieldTemplateCache.set(
        entityHandle,
        cachedTemplates,
      );
    }

    try {
      return [...templates, ...(await cachedTemplates)];
    } catch (error) {
      if (
        GenericCustomFieldService.customFieldTemplateCache.get(entityHandle) ===
        cachedTemplates
      ) {
        GenericCustomFieldService.customFieldTemplateCache.delete(entityHandle);
      }
      throw error;
    }
  }

  invalidateTemplateCache(entityHandle?: string): void {
    if (entityHandle) {
      GenericCustomFieldService.customFieldTemplateCache.delete(entityHandle);
      GenericCustomFieldService.hasActiveDefinitionCache.delete(entityHandle);
      return;
    }

    GenericCustomFieldService.customFieldTemplateCache.clear();
    GenericCustomFieldService.hasActiveDefinitionCache.clear();
  }

  splitPayload<T extends Record<string, unknown>>(payload: T): SplitPayload<T> {
    const data = { ...payload };
    const customFields = this.valueCodec.normalizePayloadRecord(
      data[CUSTOM_FIELD_PAYLOAD_KEY],
    );

    delete data[CUSTOM_FIELD_PAYLOAD_KEY];

    for (const key of Object.keys(data)) {
      if (!key.startsWith(CUSTOM_FIELD_TEMPLATE_PREFIX)) {
        continue;
      }

      const fieldKey = key.slice(CUSTOM_FIELD_TEMPLATE_PREFIX.length);
      if (fieldKey) {
        customFields[fieldKey] = data[key];
      }
      delete data[key];
    }

    return { data, customFields };
  }

  collectCustomFieldsFromFlatPayload(
    payload: Record<string, unknown>,
  ): CustomFieldPayload {
    const customFields = this.valueCodec.normalizePayloadRecord(
      payload[CUSTOM_FIELD_PAYLOAD_KEY],
    );

    for (const key of Object.keys(payload)) {
      if (!key.startsWith(CUSTOM_FIELD_TEMPLATE_PREFIX)) {
        continue;
      }

      const fieldKey = key.slice(CUSTOM_FIELD_TEMPLATE_PREFIX.length);
      if (fieldKey) {
        customFields[fieldKey] = payload[key];
      }
      delete payload[key];
    }

    if (Object.keys(customFields).length > 0) {
      payload[CUSTOM_FIELD_PAYLOAD_KEY] = customFields;
    }

    return customFields;
  }

  async assertRequiredFields(
    entityHandle: string,
    customFields: CustomFieldPayload,
  ): Promise<void> {
    const missingFieldNames = await this.getMissingRequiredFieldNames(
      entityHandle,
      customFields,
    );

    if (missingFieldNames.length > 0) {
      throw new BadRequestException(
        'import.requiredFieldMissing',
        missingFieldNames[0],
      );
    }
  }

  async getMissingRequiredFieldNames(
    entityHandle: string,
    customFields: CustomFieldPayload,
  ): Promise<string[]> {
    const definitions = await this.getActiveDefinitions(entityHandle);
    return definitions
      .filter((definition) => {
        const fieldType = this.valueCodec.getDefinitionFieldType(definition);
        return (
          fieldType !== 'boolean' &&
          !definition.isReadOnly &&
          definition.isRequired &&
          !this.valueCodec.hasCustomFieldValue(
            this.valueCodec.normalizeValue(
              definition,
              customFields[definition.fieldKey],
            ),
          )
        );
      })
      .map(
        (definition) => `${CUSTOM_FIELD_TEMPLATE_PREFIX}${definition.fieldKey}`,
      );
  }

  async upsertCustomFieldValues(
    entityHandle: string,
    recordReference: string | number | null,
    customFields: CustomFieldPayload,
  ): Promise<void> {
    if (recordReference == null || Object.keys(customFields).length === 0) {
      return;
    }

    const reference = String(recordReference);
    const definitions = await this.getActiveDefinitions(entityHandle);
    const definitionsByKey = new Map(
      definitions.map((definition) => [definition.fieldKey, definition]),
    );

    for (const [fieldKey, rawValue] of Object.entries(customFields)) {
      const definition = definitionsByKey.get(fieldKey);
      if (!definition) {
        throw new BadRequestException(
          'exception.badRequest',
          `Unknown custom field "${fieldKey}"`,
        );
      }
      if (definition.isReadOnly) {
        continue;
      }

      const normalized = this.valueCodec.normalizeValue(definition, rawValue);
      let value = await this.em.findOne(CustomFieldValueItem, {
        entity: { handle: entityHandle },
        definition: { handle: definition.handle },
        recordReference: reference,
      });

      if (!this.valueCodec.hasCustomFieldValue(normalized)) {
        if (value) {
          this.em.remove(value);
        }
        continue;
      }

      if (!value) {
        value = new CustomFieldValueItem();
        value.entity = { handle: entityHandle } as EntityItem;
        value.definition = definition;
        value.recordReference = reference;
        this.em.persist(value);
      }

      this.valueCodec.assignValue(
        value,
        this.valueCodec.getDefinitionFieldType(definition),
        normalized,
      );
    }

    await this.em.flush();
  }

  async hydrateRecords<T>(entityHandle: string, input: T): Promise<T> {
    const records: unknown[] = Array.isArray(input) ? input : [input];
    const plainRecords = records.filter(
      (record): record is Record<string, unknown> =>
        !!record && typeof record === 'object' && !Array.isArray(record),
    );

    if (plainRecords.length === 0) {
      return input;
    }

    const references = plainRecords
      .map((record) => record.handle)
      .filter(
        (handle): handle is string | number =>
          typeof handle === 'string' || typeof handle === 'number',
      )
      .map((handle) => String(handle));

    if (references.length === 0) {
      return input;
    }

    if (!(await this.hasActiveDefinitions(entityHandle))) {
      plainRecords.forEach((record) => {
        record[CUSTOM_FIELD_PAYLOAD_KEY] = {};
      });
      return input;
    }

    const values = await this.em.find(
      CustomFieldValueItem,
      {
        entity: { handle: entityHandle },
        recordReference: { $in: references },
      },
      { populate: ['definition'] },
    );
    const valuesByReference = new Map<string, Record<string, unknown>>();

    for (const value of values) {
      const definition = value.definition as CustomFieldDefinitionItem;
      const fieldValue = this.valueCodec.extractValue(
        value,
        this.valueCodec.getDefinitionFieldType(definition),
      );
      const fields = valuesByReference.get(value.recordReference) ?? {};
      fields[definition.fieldKey] = fieldValue;
      valuesByReference.set(value.recordReference, fields);
    }

    plainRecords.forEach((record) => {
      const reference = this.valueCodec.normalizeRecordReference(record.handle);
      const customFields = valuesByReference.get(reference) ?? {};
      record[CUSTOM_FIELD_PAYLOAD_KEY] = customFields;

      for (const [fieldKey, value] of Object.entries(customFields)) {
        record[`${CUSTOM_FIELD_TEMPLATE_PREFIX}${fieldKey}`] = value;
      }
    });

    return input;
  }

  async applyCustomFieldFilters(
    entityHandle: string,
    criteria: object,
  ): Promise<object> {
    if (!this.valueCodec.isPlainRecord(criteria)) {
      return criteria;
    }

    return this.resolveCriteria(entityHandle, criteria);
  }

  private async resolveCriteria(
    entityHandle: string,
    criteria: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const next: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(criteria)) {
      if ((key === '$and' || key === '$or') && Array.isArray(value)) {
        next[key] = await Promise.all(
          (value as unknown[]).map((entry) =>
            this.valueCodec.isPlainRecord(entry)
              ? this.resolveCriteria(entityHandle, entry)
              : entry,
          ),
        );
        continue;
      }

      if (
        key === CUSTOM_FIELD_PAYLOAD_KEY &&
        this.valueCodec.isPlainRecord(value)
      ) {
        const handleFilter = await this.buildCustomFieldHandleFilter(
          entityHandle,
          value,
        );
        this.mergeHandleFilter(next, handleFilter);
        continue;
      }

      if (key.startsWith(CUSTOM_FIELD_TEMPLATE_PREFIX)) {
        const fieldKey = key.slice(CUSTOM_FIELD_TEMPLATE_PREFIX.length);
        const handleFilter = await this.buildCustomFieldHandleFilter(
          entityHandle,
          { [fieldKey]: value },
        );
        this.mergeHandleFilter(next, handleFilter);
        continue;
      }

      next[key] = value;
    }

    return next;
  }

  private async buildCustomFieldHandleFilter(
    entityHandle: string,
    criteria: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const definitions = await this.getActiveDefinitions(entityHandle);
    const definitionsByKey = new Map(
      definitions.map((definition) => [definition.fieldKey, definition]),
    );
    let matchingReferences: Set<string> | null = null;

    for (const [fieldKey, condition] of Object.entries(criteria)) {
      const definition = definitionsByKey.get(fieldKey);
      if (!definition) {
        throw new BadRequestException(
          'exception.badRequest',
          `Unknown custom field "${fieldKey}"`,
        );
      }

      const values = await this.em.find(CustomFieldValueItem, {
        entity: { handle: entityHandle },
        definition: { handle: definition.handle },
        ...this.buildValueCriteria(definition, condition),
      });
      const references = new Set(values.map((value) => value.recordReference));
      matchingReferences =
        matchingReferences == null
          ? references
          : new Set(
              [...matchingReferences].filter((reference: string) =>
                references.has(reference),
              ),
            );
    }

    return { handle: { $in: [...(matchingReferences ?? new Set<string>())] } };
  }

  private buildValueCriteria(
    definition: CustomFieldDefinitionItem,
    condition: unknown,
  ): Record<string, unknown> {
    const column = this.valueCodec.getValueColumn(
      this.valueCodec.getDefinitionFieldType(definition),
    );
    if (this.valueCodec.isPlainRecord(condition)) {
      return {
        [column]: this.normalizeOperatorCriteria(definition, condition),
      };
    }

    return {
      [column]: this.valueCodec.normalizeValue(definition, condition),
    };
  }

  private normalizeOperatorCriteria(
    definition: CustomFieldDefinitionItem,
    condition: Record<string, unknown>,
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(condition).map(([operator, value]) => [
        operator,
        Array.isArray(value)
          ? value.map((entry) =>
              this.valueCodec.normalizeValue(definition, entry),
            )
          : this.valueCodec.normalizeValue(definition, value),
      ]),
    );
  }

  private mergeHandleFilter(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): void {
    if (!target.handle) {
      target.handle = source.handle;
      return;
    }

    const existingConditions = Array.isArray(target.$and)
      ? (target.$and as unknown[])
      : [];
    target.$and = [...existingConditions, { handle: target.handle }, source];
    delete target.handle;
  }

  private async hasActiveDefinitions(entityHandle: string): Promise<boolean> {
    let cached =
      GenericCustomFieldService.hasActiveDefinitionCache.get(entityHandle);

    if (!cached) {
      cached = this.em
        .count(CustomFieldDefinitionItem, {
          entity: { handle: entityHandle },
          isActive: true,
        })
        .then((count) => count > 0);
      GenericCustomFieldService.hasActiveDefinitionCache.set(
        entityHandle,
        cached,
      );
    }

    try {
      return await cached;
    } catch (error) {
      if (
        GenericCustomFieldService.hasActiveDefinitionCache.get(entityHandle) ===
        cached
      ) {
        GenericCustomFieldService.hasActiveDefinitionCache.delete(entityHandle);
      }
      throw error;
    }
  }

  private rememberHasActiveDefinitions(
    entityHandle: string,
    hasDefinitions: boolean,
  ): void {
    GenericCustomFieldService.hasActiveDefinitionCache.set(
      entityHandle,
      Promise.resolve(hasDefinitions),
    );
  }
}
