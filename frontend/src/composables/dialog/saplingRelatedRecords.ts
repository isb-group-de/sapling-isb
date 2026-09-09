import type { EntityTemplate } from '@/entity/structure'

/** Keep indirect records in a separate, read-only tab; never reassign them. */
export function expandRelatedRecordTabs(
  templates: EntityTemplate[],
  persisted: boolean,
): EntityTemplate[] {
  return templates.flatMap((template) => {
    if (!persisted || !template.relatedRecords?.paths.length) return [template]
    return [
      template,
      {
        ...template,
        name: `${template.name}Related`,
        key: `${template.name}Related`,
        options: [...(template.options ?? []), 'isReadOnly'],
        relatedRecordPaths: template.relatedRecords.paths,
      },
    ]
  })
}

export function getRelationRecordFilter(
  template: EntityTemplate,
  handle: string | number,
): Record<string, unknown> {
  if (template.relatedRecordPaths?.length) {
    return {
      $or: template.relatedRecordPaths.map((path) =>
        path
          .split('.')
          .reverse()
          .reduce<Record<string, unknown>>(
            (filter, field, index) => ({ [field]: index === 0 ? handle : filter }),
            {},
          ),
      ),
    }
  }
  const key = template.mappedBy ?? template.inversedBy
  return key ? { [key]: handle } : { handle: { $in: [] } }
}
