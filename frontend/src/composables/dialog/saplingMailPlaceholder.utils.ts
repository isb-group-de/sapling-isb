import type { EntityTemplate } from '@/entity/structure'

export function isScalarPlaceholderTemplate(template: EntityTemplate): boolean {
  return !template.isReference && template.isPersistent !== false
}

export function isSupportedPlaceholderRelation(template: EntityTemplate): boolean {
  return !!template.isReference && !!template.referenceName && template.kind !== '1:m'
}
