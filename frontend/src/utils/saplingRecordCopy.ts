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
    .filter(
      (template) =>
        template.name === 'handle' ||
        template.isUnique ||
        (template.kind === '1:1' && template.mappedBy != null) ||
        template.options?.some((option) => NON_COPYABLE_OPTIONS.has(option)),
    )
    .forEach((template) => {
      delete copiedItem[template.name]
    })

  return copiedItem
}
