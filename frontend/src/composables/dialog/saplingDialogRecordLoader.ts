import type { EntityTemplate } from '@/entity/structure'

/**
 * Relations required to hydrate a complete edit form.
 * Collection relations remain lazy relation tabs, except inline collections
 * which are part of the form payload itself.
 */
export function getDialogRecordRelations(templates: EntityTemplate[]): string[] {
  return [
    'm:1',
    ...templates
      .filter(
        (template) => template.isReference && template.kind === '1:1' && Boolean(template.name),
      )
      .map((template) => template.name),
    ...templates
      .filter((template) => template.inlineCollection && template.name)
      .map((template) => template.name),
  ].filter((relation, index, relations) => relations.indexOf(relation) === index)
}

/**
 * Copy drafts additionally hydrate owning many-to-many collections. Reusing
 * those links creates independent join rows and never reassigns the related
 * records themselves.
 */
export function getDialogRecordCopyRelations(templates: EntityTemplate[]): string[] {
  return [
    ...getDialogRecordRelations(templates),
    ...templates
      .filter((template) => ['m:n', 'n:m'].includes(template.kind ?? '') && Boolean(template.name))
      .map((template) => template.name),
  ].filter((relation, index, relations) => relations.indexOf(relation) === index)
}
