import {
  ReferenceKind,
  type EntityManager,
  type EntityMetadata,
  type EntityName,
} from '@mikro-orm/core';
import { getSaplingOptions } from '../../entity/global/entity.decorator';
import { formatSaplingPhoneNumber } from '../../api/common/sapling-phone.util';
import { validatePrompt } from '../../api/ai/prompts/ai-prompt-context';
import { isSeedRecord, type SeedRecord } from './seed-catalog';

export function prepareSeedValues(
  em: EntityManager,
  meta: EntityMetadata,
  input: SeedRecord,
  updating: boolean,
): SeedRecord {
  const result: SeedRecord = {};
  for (const [name, value] of Object.entries(input)) {
    const prop = meta.properties[name];
    if (!prop || prop.persist === false || (updating && prop.primary)) {
      throw new Error(`Unsupported seed field: ${meta.className}.${name}`);
    }
    if (value === undefined || (value === null && !prop.nullable)) {
      throw new Error(`Invalid null seed value: ${meta.className}.${name}`);
    }
    if (
      prop.kind === ReferenceKind.MANY_TO_MANY ||
      prop.kind === ReferenceKind.MANY_TO_ONE ||
      prop.kind === ReferenceKind.ONE_TO_ONE
    ) {
      if (!prop.owner)
        throw new Error(
          `Use the owning relation for ${meta.className}.${name}`,
        );
      const reference = (key: unknown) => {
        if (typeof key !== 'string' && typeof key !== 'number')
          throw new Error(`Relation seeds require a primary key: ${name}`);
        if (!prop.targetMeta)
          throw new Error(`Missing relation metadata: ${name}`);
        return em.getReference<object>(
          prop.targetMeta.class as EntityName<object>,
          key,
        );
      };
      result[name] =
        prop.kind === ReferenceKind.MANY_TO_MANY
          ? Array.isArray(value)
            ? value.map(reference)
            : (() => {
                throw new Error(`Expected relation array: ${name}`);
              })()
          : value === null
            ? null
            : reference(value);
    } else if (prop.kind !== ReferenceKind.SCALAR) {
      throw new Error(`Unsupported seed relation: ${meta.className}.${name}`);
    } else if (
      typeof value === 'string' &&
      getSaplingOptions(meta.class.prototype as object, name).includes(
        'isPhone',
      )
    ) {
      result[name] = formatSaplingPhoneNumber(value);
    } else if (
      value !== null &&
      (prop.type === 'datetime' ||
        prop.type === 'Date' ||
        prop.runtimeType === 'Date')
    ) {
      const date = new Date(value as string);
      if (Number.isNaN(date.getTime()))
        throw new Error(`Invalid seed date: ${name}`);
      result[name] = date;
    } else {
      result[name] = value;
    }
  }
  return result;
}

export function validateSeedPrompt(meta: EntityMetadata, row: object): void {
  if (!isSeedRecord(row)) return;
  if (meta.className === 'AiPromptTemplateItem') {
    validatePrompt(row.draft as string, row.variables as string[]);
  } else if (meta.className === 'AiPromptVersionItem') {
    validatePrompt(row.content as string, row.variables as string[]);
  }
}
