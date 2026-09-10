import type { EntityMetadata } from '@mikro-orm/core';
import { isSeedRecord, type SeedRecord } from './seed-catalog';

const NATURAL_KEYS: Record<string, string[][]> = {
  translation: [['entity', 'property', 'language']],
  permission: [['entity', 'role']],
  entityRoute: [['entity', 'route', 'group']],
  dashboardTemplate: [['name', 'person']],
  aiPromptVersion: [['template', 'version']],
};

export function validateSeedKey(
  entity: string,
  meta: EntityMetadata,
  value: unknown,
): SeedRecord {
  if (!isSeedRecord(value))
    throw new Error(`Expected key object for ${entity}`);
  const names = Object.keys(value).sort();
  const uniqueKeys = meta.uniques.map((unique) =>
    [unique.properties].flat().map(String),
  );
  const uniqueProperties = meta.props
    .filter((prop) => prop.unique)
    .map((prop) => [prop.name]);
  const allowed = [
    meta.primaryKeys,
    ...uniqueKeys,
    ...uniqueProperties,
    ...(NATURAL_KEYS[entity] || []),
  ];
  if (
    !names.length ||
    !allowed.some((keys) => [...keys].sort().join('|') === names.join('|'))
  ) {
    throw new Error(`Unsupported seed key for ${entity}: ${names.join(', ')}`);
  }
  for (const [name, item] of Object.entries(value)) {
    if (
      (typeof item !== 'string' && typeof item !== 'number' && item !== null) ||
      (typeof item === 'string' && !item.trim()) ||
      (typeof item === 'number' && !Number.isFinite(item)) ||
      (item === null && !meta.properties[name]?.nullable)
    ) {
      throw new Error(`Invalid seed key value: ${entity}.${name}`);
    }
  }
  return value;
}

export function insertSeedKey(
  entity: string,
  meta: EntityMetadata,
  row: SeedRecord,
): SeedRecord | undefined {
  const candidates = [
    meta.primaryKeys,
    ...(NATURAL_KEYS[entity] || []),
    ...meta.uniques.map((unique) => [unique.properties].flat().map(String)),
    ...meta.props.filter((prop) => prop.unique).map((prop) => [prop.name]),
  ];
  for (const fields of candidates) {
    if (fields.length && fields.every((field) => row[field] !== undefined)) {
      return validateSeedKey(
        entity,
        meta,
        Object.fromEntries(fields.map((field) => [field, row[field]])),
      );
    }
  }
  return undefined;
}

export function seedIdentity(key: SeedRecord): string {
  return JSON.stringify(
    Object.entries(key).sort(([a], [b]) => a.localeCompare(b)),
  );
}
