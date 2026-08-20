import type { SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'

/** Creates a writable record draft without identity or other unique values. */
export function createSaplingRecordCopy(
  item: SaplingGenericItem,
  templates: EntityTemplate[],
): SaplingGenericItem {
  const copiedItem = { ...item }

  templates
    .filter((template) => template.name === 'handle' || template.isUnique)
    .forEach((template) => {
      delete copiedItem[template.name]
    })

  return copiedItem
}
