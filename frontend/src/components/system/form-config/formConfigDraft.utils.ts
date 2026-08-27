import type {
  EntityTemplate,
  SaplingFormConfigPayload,
  SaplingFormFieldConfig,
  SaplingFormGroupConfig,
} from '@/entity/structure'
import type { FieldDraft, GroupDraft } from './formConfigAdmin.types'

export function buildFormConfigPayload(
  entityHandle: string,
  fields: FieldDraft[],
  groups: GroupDraft[] = [],
): SaplingFormConfigPayload {
  return {
    schema: 'sapling.form-config.v1',
    entityHandle,
    fields: Object.fromEntries(
      fields.map((field) => [
        field.name,
        {
          visible: field.visible,
          label: field.label.trim() || null,
          group: field.group.trim() || null,
          order: field.order,
          width: field.width,
          tableVisible: field.tableVisible,
          tableOrder: field.tableOrder,
          mobileVisible: field.mobileVisible,
          mobileOrder: field.mobileOrder,
          renderer: field.renderer,
          placeholder: field.placeholder.trim() || null,
          helpText: field.helpText.trim() || null,
          required: field.required,
          recommended: field.required ? false : field.recommended,
          readonly: field.readonly,
        } satisfies SaplingFormFieldConfig,
      ]),
    ),
    groups: Object.fromEntries(
      groups
        .filter((group) => group.key.trim())
        .map((group) => [
          group.key.trim(),
          {
            visible: group.visible,
            order: group.order,
            label: group.label.trim() || null,
          } satisfies SaplingFormGroupConfig,
        ]),
    ),
  }
}

export function applyFormConfigDraftToTemplate(
  template: EntityTemplate,
  field: FieldDraft | undefined,
  group?: GroupDraft,
): EntityTemplate {
  if (!field) {
    return template
  }

  const isRecommended = !field.required && field.recommended

  return {
    ...template,
    formGroup: field.group || null,
    formGroupOrder: group?.order ?? template.formGroupOrder,
    formGroupConfig: group
      ? { visible: group.visible, order: group.order, label: group.label.trim() || null }
      : template.formGroupConfig,
    formOrder: field.order,
    formWidth: field.width,
    formVisible: field.visible && group?.visible !== false,
    tableVisible: field.tableVisible,
    tableOrder: field.tableOrder,
    mobileVisible: field.mobileVisible,
    mobileOrder: field.mobileOrder,
    isRequired: field.required,
    options: isRecommended
      ? [...new Set([...(template.options ?? []), 'isRecommended' as const])]
      : (template.options ?? []).filter((option) => option !== 'isRecommended'),
    formConfig: {
      visible: field.visible,
      label: field.label || null,
      group: field.group || null,
      order: field.order,
      width: field.width,
      tableVisible: field.tableVisible,
      tableOrder: field.tableOrder,
      mobileVisible: field.mobileVisible,
      mobileOrder: field.mobileOrder,
      renderer: field.renderer,
      placeholder: field.placeholder || null,
      helpText: field.helpText || null,
      required: field.required,
      recommended: isRecommended,
      readonly: field.readonly,
    },
  }
}
