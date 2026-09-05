import { createHash } from 'node:crypto';
import type { EntityMetadata } from '@mikro-orm/core';
import type { EntityTemplateDto } from '../../template/dto/entity-template.dto';

export type MergeRecord = Record<string, unknown> & {
  handle: string | number;
  customFields?: Record<string, unknown>;
};

export function mergeHandle(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (!value || typeof value !== 'object') return null;
  const reference = value as { handle?: unknown; unwrap?: () => unknown };
  return typeof reference.unwrap === 'function'
    ? mergeHandle(reference.unwrap())
    : mergeHandle(reference.handle);
}

export function isEmptyMergeValue(value: unknown): boolean {
  return (
    value == null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function mergeFieldValue(
  record: Record<string, unknown>,
  field: EntityTemplateDto,
): unknown {
  if (field.name.startsWith('customFields.')) {
    const values = record.customFields as Record<string, unknown> | undefined;
    return values?.[field.name.slice('customFields.'.length)] ?? null;
  }
  return record[field.name] ?? null;
}

export function isMergeValueField(field: EntityTemplateDto): boolean {
  return (
    !['handle', 'createdAt', 'updatedAt'].includes(field.name) &&
    !['1:m', 'm:n', 'n:m'].includes(field.kind ?? '') &&
    !(field.kind === '1:1' && field.mappedBy) &&
    (field.isPersistent !== false || field.name.startsWith('customFields.')) &&
    !field.options?.includes('isSecurity')
  );
}

export function mergeSnapshotToken(
  entityHandle: string,
  metadata: EntityMetadata,
  loser: MergeRecord,
  winner: MergeRecord,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify(
        stableMergeValue([
          entityHandle,
          mergeRecordSnapshot(metadata, loser),
          mergeRecordSnapshot(metadata, winner),
        ]),
      ),
    )
    .digest('hex');
}

/** A comparison never recursively serializes the record's relationship graph. */
export function mergeRecordSnapshot(
  metadata: EntityMetadata,
  record: MergeRecord,
): Record<string, unknown> {
  return {
    ...Object.fromEntries(
      metadata.props
        .filter(
          (property) =>
            property.persist !== false &&
            !['1:m', 'm:n'].includes(property.kind),
        )
        .map((property) => [
          property.name,
          property.targetMeta
            ? mergeHandle(record[property.name])
            : record[property.name],
        ]),
    ),
    customFields: record.customFields,
  };
}

function stableMergeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stableMergeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stableMergeValue(item)]),
    );
  }
  return value;
}
