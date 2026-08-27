import type {
  EntityTemplate,
  SaplingFormConfigPayload,
  SaplingFormFieldConfig,
} from '@/entity/structure'
import { getDialogTemplateWidth } from '@/utils/saplingDialogLayoutUtil'
import type { FieldDraft, GroupDraft } from './formConfigAdmin.types'

const UNSUPPORTED_RELATION_KINDS = ['1:m', 'm:n', 'n:m', '1:1']

export function buildFormConfigDraftRows(
  templates: EntityTemplate[],
  configFields: SaplingFormConfigPayload['fields'],
  configGroups: SaplingFormConfigPayload['groups'] = {},
  getDefaultLabel: (template: EntityTemplate) => string,
): { fields: FieldDraft[]; groups: GroupDraft[] } {
  const fields: FieldDraft[] = []
  const observedGroups = new Map<string, { order: number; label: string; visible: boolean }>()

  Object.entries(configGroups ?? {}).forEach(([groupKey, groupConfig], index) => {
    const normalizedKey = groupKey.trim()
    if (!normalizedKey) return
    observedGroups.set(normalizedKey, {
      order: groupConfig.order ?? (index + 1) * 100,
      label: groupConfig.label ?? '',
      visible: groupConfig.visible !== false,
    })
  })

  templates
    .filter((template) => !UNSUPPORTED_RELATION_KINDS.includes(template.kind ?? ''))
    .forEach((template, index) => {
      const fieldConfig = getFieldConfig(configFields?.[template.name])
      const visible = fieldConfig.visible ?? template.formVisible ?? false
      const group = fieldConfig.group ?? template.formGroup ?? ''
      if (!observedGroups.has(group)) {
        observedGroups.set(group, {
          order:
            fieldConfig.groupOrder ?? template.formGroupOrder ?? (observedGroups.size + 1) * 100,
          label: template.formGroupConfig?.label ?? '',
          visible: template.formGroupConfig?.visible !== false,
        })
      }

      fields.push({
        name: template.name,
        type: template.type,
        visible,
        label: fieldConfig.label ?? getDefaultLabel(template),
        group,
        order: fieldConfig.order ?? template.formOrder ?? index + 1,
        width: fieldConfig.width ?? template.formWidth ?? getDialogTemplateWidth(template),
        tableVisible: fieldConfig.tableVisible ?? template.tableVisible ?? visible,
        tableOrder:
          fieldConfig.tableOrder ?? template.tableOrder ?? template.formOrder ?? index + 1,
        mobileVisible: fieldConfig.mobileVisible ?? template.mobileVisible ?? false,
        mobileOrder:
          fieldConfig.mobileOrder ??
          template.mobileOrder ??
          template.tableOrder ??
          template.formOrder ??
          index + 1,
        renderer: fieldConfig.renderer ?? 'auto',
        placeholder: fieldConfig.placeholder ?? '',
        helpText: fieldConfig.helpText ?? template.formConfig?.helpText ?? '',
        required: fieldConfig.required ?? template.isRequired === true,
        recommended:
          (fieldConfig.required ?? template.isRequired === true) !== true &&
          (fieldConfig.recommended ?? template.options?.includes('isRecommended') === true),
        readonly:
          fieldConfig.readonly ??
          (template.options?.includes('isReadOnly') === true ||
            template.options?.includes('isSecurity') === true),
      })
    })

  const groups = [...observedGroups.entries()]
    .sort(([leftKey, left], [rightKey, right]) => {
      if (!leftKey && rightKey) return 1
      if (leftKey && !rightKey) return -1
      return left.order - right.order
    })
    .map(([key, group], index) => ({
      key,
      label: group.label,
      visible: group.visible,
      order: (index + 1) * 100,
    }))

  normalizeFieldOrders(fields, groups)
  return { fields, groups }
}

export function showAllFormConfigFields(fields: FieldDraft[], groups: GroupDraft[]): void {
  groups.forEach((group) => (group.visible = true))
  fields.forEach((field) => {
    field.visible = true
    field.tableVisible = true
    field.mobileVisible = true
  })
}

export function createFormConfigGroup(
  groups: GroupDraft[],
  entityHandle: string,
  label: string,
): GroupDraft | null {
  const normalizedLabel = label.trim()
  if (!normalizedLabel) return null

  let suffix = groups.length + 1
  let key = `${entityHandle}.customGroup${suffix}`
  while (groups.some((group) => group.key === key)) {
    key = `${entityHandle}.customGroup${++suffix}`
  }
  return { key, label: normalizedLabel, visible: true, order: (groups.length + 1) * 100 }
}

export function removeFormConfigGroup(
  fields: FieldDraft[],
  groups: GroupDraft[],
  groupKey: string,
): void {
  if (!groupKey || fields.some((field) => field.group === groupKey)) return
  const index = groups.findIndex((group) => group.key === groupKey)
  if (index >= 0) groups.splice(index, 1)
  normalizeGroupOrders(groups)
}

export function reorderFormConfigGroup(
  groups: GroupDraft[],
  sourceKey: string,
  targetKey: string,
  placement: 'swap' | 'before' | 'after' = 'swap',
): void {
  const sourceIndex = groups.findIndex((group) => group.key === sourceKey)
  const targetIndex = groups.findIndex((group) => group.key === targetKey)
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return

  if (placement === 'swap') {
    ;[groups[sourceIndex], groups[targetIndex]] = [groups[targetIndex], groups[sourceIndex]]
    normalizeGroupOrders(groups)
    return
  }

  const [source] = groups.splice(sourceIndex, 1)
  if (!source) return

  const nextTargetIndex = groups.findIndex((group) => group.key === targetKey)
  const insertionIndex = placement === 'after' ? nextTargetIndex + 1 : nextTargetIndex
  groups.splice(insertionIndex, 0, source)
  normalizeGroupOrders(groups)
}

export function moveFormConfigField(
  fields: FieldDraft[],
  groups: GroupDraft[],
  fieldName: string,
  targetGroupKey: string,
  targetIndex: number,
): void {
  const field = fields.find((entry) => entry.name === fieldName)
  if (!field || !groups.some((group) => group.key === targetGroupKey)) return

  const targetFields = fields
    .filter((entry) => entry.group === targetGroupKey && entry.name !== fieldName)
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
  field.group = targetGroupKey
  targetFields.splice(Math.max(0, Math.min(targetIndex, targetFields.length)), 0, field)
  targetFields.forEach((entry, index) => (entry.order = (index + 1) * 100))
  normalizeFieldOrders(fields, groups)
}

export function normalizeGroupOrders(groups: GroupDraft[]): void {
  groups.forEach((group, index) => (group.order = (index + 1) * 100))
}

export function normalizeFieldOrders(fields: FieldDraft[], groups: GroupDraft[]): void {
  groups.forEach((group) => {
    fields
      .filter((field) => field.group === group.key)
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
      .forEach((field, index) => (field.order = (index + 1) * 100))
  })
}

function getFieldConfig(value: unknown): SaplingFormFieldConfig {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as SaplingFormFieldConfig)
    : {}
}
