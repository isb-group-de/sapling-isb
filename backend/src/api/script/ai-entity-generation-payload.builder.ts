import { BadRequestException } from '@nestjs/common';
import { wrap } from '@mikro-orm/core';
import { AiEntityGenerationTemplateItem } from '../../entity/AiEntityGenerationTemplateItem';
import { PersonItem } from '../../entity/PersonItem';

const MAX_SOURCE_JSON_CHARS = 24000;

export class AiEntityGenerationPayloadBuilder {
  build(
    template: AiEntityGenerationTemplateItem,
    generatedFields: Record<string, unknown>,
    sourceRecord: object,
    sourceHandle: string | number,
    user: PersonItem,
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      ...(this.normalizeRecord(template.targetDefaults) ?? {}),
    };
    const fieldMapping = this.normalizeFieldMapping(template.fieldMapping);

    if (Object.keys(fieldMapping).length > 0) {
      for (const [generatedField, targetField] of Object.entries(
        fieldMapping,
      )) {
        if (!this.hasOwn(generatedFields, generatedField)) {
          continue;
        }

        const generatedValue = this.normalizeGeneratedValue(
          generatedFields[generatedField],
        );
        if (typeof generatedValue !== 'undefined') {
          payload[targetField] = generatedValue;
        }
      }
    } else {
      for (const [field, value] of Object.entries(generatedFields)) {
        const generatedValue = this.normalizeGeneratedValue(value);
        if (typeof generatedValue !== 'undefined') {
          payload[field] = generatedValue;
        }
      }
    }

    this.applySourceFieldMapping(
      payload,
      sourceRecord,
      template.sourceFieldMapping,
    );

    if (template.sourceReferenceField?.trim()) {
      payload[template.sourceReferenceField.trim()] = sourceHandle;
    }

    if (template.userReferenceField?.trim() && user.handle != null) {
      payload[template.userReferenceField.trim()] = user.handle;
    }

    return payload;
  }

  buildSystemPrompt(
    template: AiEntityGenerationTemplateItem,
    targetEntityHandle: string,
  ): string {
    const responseFields = Object.keys(
      this.normalizeFieldMapping(template.fieldMapping),
    );

    return [
      'You create structured Sapling CRM records from existing entity data.',
      'Return exactly one valid JSON object and no markdown fences.',
      'Do not invent facts that are missing from the source record.',
      'Remove secrets, credentials, and unnecessary customer-identifying details.',
      `Target entity: ${targetEntityHandle}.`,
      responseFields.length > 0
        ? `The JSON object must use these keys: ${responseFields.join(', ')}.`
        : 'The JSON object must use target entity field names as keys.',
      'Keep markdown only inside markdown fields.',
    ].join('\n');
  }

  buildUserPrompt(
    template: AiEntityGenerationTemplateItem,
    sourceEntityHandle: string,
    targetEntityHandle: string,
    sourceRecord: object,
  ): string {
    return [
      `Template: ${template.title} (${template.handle})`,
      `Source entity: ${sourceEntityHandle}`,
      `Target entity: ${targetEntityHandle}`,
      '',
      'Template instructions:',
      template.promptMarkdown,
      '',
      'Source record JSON:',
      this.stringifySourceRecord(sourceRecord),
    ].join('\n');
  }

  parseJsonObject(rawText: string): Record<string, unknown> {
    const text = rawText
      .trim()
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/i, '');
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');

    if (jsonStart < 0 || jsonEnd <= jsonStart) {
      throw new BadRequestException('aiEntityGeneration.invalidJsonResponse');
    }

    try {
      const parsed: unknown = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Expected JSON object');
      }

      return parsed as Record<string, unknown>;
    } catch {
      throw new BadRequestException('aiEntityGeneration.invalidJsonResponse');
    }
  }

  toPlainRecord(value: object): Record<string, unknown> {
    try {
      return wrap(value).toObject() as Record<string, unknown>;
    } catch {
      return { ...(value as Record<string, unknown>) };
    }
  }

  private stringifySourceRecord(sourceRecord: object): string {
    const json = JSON.stringify(
      this.pruneSensitiveValues(this.toPlainRecord(sourceRecord)),
      null,
      2,
    );

    return json.length <= MAX_SOURCE_JSON_CHARS
      ? json
      : `${json.slice(0, MAX_SOURCE_JSON_CHARS)}\n... truncated ...`;
  }

  private normalizeRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private normalizeFieldMapping(value: unknown): Record<string, string> {
    const record = this.normalizeRecord(value);

    if (!record) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(record)
        .map(([key, targetField]) => [
          key.trim(),
          typeof targetField === 'string' ? targetField.trim() : '',
        ])
        .filter(
          (entry): entry is [string, string] =>
            entry[0].length > 0 && entry[1].length > 0,
        ),
    );
  }

  private applySourceFieldMapping(
    payload: Record<string, unknown>,
    sourceRecord: object,
    sourceFieldMapping: unknown,
  ): void {
    const fieldMapping = this.normalizeFieldMapping(sourceFieldMapping);

    if (Object.keys(fieldMapping).length === 0) {
      return;
    }

    const sourcePlain = this.toPlainRecord(sourceRecord);

    for (const [sourcePath, targetField] of Object.entries(fieldMapping)) {
      const copiedValue = this.normalizeCopiedSourceValue(
        this.readSourcePath(sourcePlain, sourcePath),
      );

      if (typeof copiedValue !== 'undefined') {
        payload[targetField] = copiedValue;
      }
    }
  }

  private normalizeGeneratedValue(value: unknown): unknown {
    if (typeof value === 'undefined') {
      return undefined;
    }
    if (value == null) {
      return null;
    }
    if (Array.isArray(value)) {
      return value
        .map((entry) =>
          typeof entry === 'string' || typeof entry === 'number'
            ? String(entry).trim()
            : '',
        )
        .filter(Boolean)
        .join(', ');
    }
    return typeof value === 'object' ? JSON.stringify(value) : value;
  }

  private readSourcePath(sourceRecord: unknown, sourcePath: string): unknown {
    return sourcePath
      .split('.')
      .filter(Boolean)
      .reduce<unknown>((currentValue, pathSegment) => {
        if (currentValue == null) {
          return undefined;
        }
        if (Array.isArray(currentValue)) {
          const pathIndex = Number.parseInt(pathSegment, 10);
          return Number.isInteger(pathIndex) &&
            String(pathIndex) === pathSegment
            ? currentValue[pathIndex]
            : undefined;
        }
        return typeof currentValue === 'object'
          ? (currentValue as Record<string, unknown>)[pathSegment]
          : undefined;
      }, sourceRecord);
  }

  private normalizeCopiedSourceValue(value: unknown): unknown {
    if (typeof value === 'undefined') {
      return undefined;
    }
    if (value == null) {
      return null;
    }
    if (Array.isArray(value)) {
      return value
        .map((entry) => this.normalizeCopiedSourceValue(entry))
        .filter((entry) => typeof entry !== 'undefined');
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return this.hasOwn(record, 'handle') ? record.handle : record;
    }
    return value;
  }

  private pruneSensitiveValues(value: unknown): unknown {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (Array.isArray(value)) {
      return value.map((entry) => this.pruneSensitiveValues(entry));
    }
    if (!value || typeof value !== 'object') {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(
          ([key]) =>
            !/password|secret|token|credential|apiKey|privateKey/i.test(key),
        )
        .map(([key, entry]) => [key, this.pruneSensitiveValues(entry)]),
    );
  }

  private hasOwn(record: object, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(record, key) === true;
  }
}
