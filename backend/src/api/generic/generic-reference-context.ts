import { BadRequestException } from '@nestjs/common';
import type { EntityTemplateDto } from '../template/dto/entity-template.dto';

function identifier(value: unknown): string | number | null {
  if (value && typeof value === 'object')
    return identifier((value as { handle?: unknown }).handle);
  return typeof value === 'number' ||
    (typeof value === 'string' && value.trim())
    ? value
    : null;
}

/** Validate context through optional intermediate links without persisting derived fields. */
export async function validateReferenceContext(options: {
  entityHandle: string;
  data: Record<string, unknown>;
  templates: EntityTemplateDto[];
  getTemplates: (entity: string) => EntityTemplateDto[];
  load: (
    entity: string,
    handle: string | number,
  ) => Promise<Record<string, unknown> | null>;
}): Promise<void> {
  const cache = new Map<string, Promise<Record<string, unknown> | null>>();
  async function load(entity: string, value: unknown) {
    const handle = identifier(value);
    if (handle == null) return null;
    const key = `${entity}:${handle}`;
    if (!cache.has(key)) cache.set(key, options.load(entity, handle));
    const record = await cache.get(key);
    if (!record) throw new BadRequestException('global.referenceNotFound');
    return record;
  }

  async function resolve(
    entity: string,
    record: Record<string, unknown>,
    fieldName: string,
    visited: Set<string>,
  ): Promise<Array<string | number>> {
    const key = `${entity}:${identifier(record.handle)}:${fieldName}`;
    if (visited.has(key)) return [];
    const path = new Set(visited).add(key);
    const own = identifier(record[fieldName]);
    const values: Array<string | number> = own == null ? [] : [own];
    for (const template of options.getTemplates(entity)) {
      if (!template.referenceName) continue;
      for (const mapping of template.referenceTemplate?.mappings ?? []) {
        if (!mapping.validate || mapping.targetField !== fieldName) continue;
        const source = await load(
          template.referenceName,
          record[template.name],
        );
        if (source)
          values.push(
            ...(await resolve(
              template.referenceName,
              source,
              mapping.sourceField,
              path,
            )),
          );
      }
    }
    return values;
  }

  const contexts = new Map<string, string>();
  for (const field of options.templates) {
    if (!field.referenceName) continue;
    const mappings =
      field.referenceTemplate?.mappings.filter((mapping) => mapping.validate) ??
      [];
    if (!mappings.length) continue;
    const source = await load(field.referenceName, options.data[field.name]);
    if (!source) continue;
    for (const mapping of mappings) {
      const own = identifier(options.data[mapping.targetField]);
      const values = await resolve(
        field.referenceName,
        source,
        mapping.sourceField,
        new Set(),
      );
      if (own != null) values.unshift(own);
      for (const value of values) {
        const previous = contexts.get(mapping.targetField);
        if (previous != null && previous !== String(value)) {
          const summaryKey = 'exception.referenceDependencyMismatch';
          throw new BadRequestException({
            message: 'exception.badRequest',
            error: summaryKey,
            details: {
              summaryKey,
              summary: summaryKey,
              entityHandle: options.entityHandle,
              summaryParams: {
                entityHandle: options.entityHandle,
                fieldName: field.name,
                parentFieldName: mapping.targetField,
              },
            },
          });
        }
        contexts.set(mapping.targetField, String(value));
      }
    }
  }
}
