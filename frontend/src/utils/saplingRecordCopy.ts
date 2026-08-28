import type { SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'

const NON_COPYABLE_OPTIONS = new Set(['isHideAsReference', 'isReadOnly', 'isSecurity', 'isSystem'])

/** Creates a writable record draft without identity or internal values. */
export function createSaplingRecordCopy(
  item: SaplingGenericItem,
  templates: EntityTemplate[],
): SaplingGenericItem {
  const copiedItem = { ...item }

  templates
    .filter((template) => ['m:n', 'n:m'].includes(template.kind ?? ''))
    .forEach((template) => {
      const value = copiedItem[template.name]
      if (Array.isArray(value)) {
        copiedItem[template.name] = value.map((entry) =>
          entry && typeof entry === 'object' ? { ...entry } : entry,
        )
      }
    })

  templates
    .filter(
      (template) =>
        template.name === 'handle' ||
        template.isUnique ||
        ['1:m', '1:1'].includes(template.kind ?? '') ||
        template.options?.some((option) => NON_COPYABLE_OPTIONS.has(option)),
    )
    .forEach((template) => {
      delete copiedItem[template.name]
    })

  return copiedItem
}
