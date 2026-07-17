import type { AccumulatedPermission, EntityTemplate } from '@/entity/structure'
import type { FilterQuery } from '@/services/api.generic.service'

const UNSUPPORTED_RELATION_KINDS = new Set(['1:m', 'm:n', 'n:m', '1:1'])

export type SaplingBulkUpdateOperation = 'set' | 'clear'

export interface SaplingBulkUpdateDraftChange {
  fieldName: string
  operation: SaplingBulkUpdateOperation
  value: unknown
  displayValue: string
}

export function isBulkUpdateTemplateEligible(
  template: EntityTemplate,
  permissions?: AccumulatedPermission[],
): boolean {
  if (
    !template.name ||
    template.isPrimaryKey ||
    template.isAutoIncrement ||
    template.isUnique ||
    template.isPersistent === false ||
    template.inlineCollection ||
    template.genericReference ||
    template.fieldAccess?.allowUpdate === false ||
    template.formConfig?.readonly === true ||
    template.options?.some((option) =>
      ['isReadOnly', 'isSystem', 'isSecurity', 'isAutoKey'].includes(option),
    ) ||
    UNSUPPORTED_RELATION_KINDS.has(template.kind ?? '')
  ) {
    return false
  }

  if (!template.isReference) {
    return true
  }

  if (template.kind !== 'm:1' || !template.referenceName) {
    return false
  }

  return (
    permissions === undefined ||
    permissions.some(
      (permission) => permission.entityHandle === template.referenceName && permission.allowRead,
    )
  )
}

export function canClearBulkUpdateTemplate(template: EntityTemplate): boolean {
  const configuredRequired = template.formConfig?.required
  const isRequired =
    configuredRequired === true ||
    (configuredRequired !== false && (template.isRequired === true || template.nullable === false))

  return !isRequired && template.nullable !== false
}

export function hasBulkUpdateValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false
  }

  return typeof value !== 'string' || value.trim().length > 0
}

export function isBulkUpdateDependencyBlocked(
  template: EntityTemplate,
  changes: SaplingBulkUpdateDraftChange[],
): boolean {
  const dependency = template.referenceDependency
  if (!dependency?.parentField) {
    return false
  }

  const parentChange = changes.find((change) => change.fieldName === dependency.parentField)
  return (
    !parentChange || parentChange.operation !== 'set' || !hasBulkUpdateValue(parentChange.value)
  )
}

export function buildBulkUpdateReferenceParentFilter(
  template: EntityTemplate,
  changes: SaplingBulkUpdateDraftChange[],
): FilterQuery {
  const dependency = template.referenceDependency
  if (!dependency?.parentField || !dependency.targetField) {
    return {}
  }

  const parentChange = changes.find((change) => change.fieldName === dependency.parentField)
  if (
    !parentChange ||
    parentChange.operation !== 'set' ||
    !hasBulkUpdateValue(parentChange.value)
  ) {
    return dependency.requireParent ? { [dependency.targetField]: { $in: [] } } : {}
  }

  const value = parentChange.value
  return {
    [dependency.targetField]:
      value && typeof value === 'object' && !Array.isArray(value) ? value : { $eq: value },
  }
}

export function buildBulkUpdatePayload(
  changes: SaplingBulkUpdateDraftChange[],
): Record<string, unknown> {
  return Object.fromEntries(
    changes.map((change) => [change.fieldName, change.operation === 'clear' ? null : change.value]),
  )
}
