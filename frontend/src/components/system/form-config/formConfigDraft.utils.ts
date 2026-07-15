import type {
  EntityTemplate,
  SaplingFormConfigPayload,
  SaplingFormFieldConfig,
} from '@/entity/structure'
import type { FieldDraft } from './formConfigAdmin.types'

export function buildFormConfigPayload(
  entityHandle: string,
  fields: FieldDraft[],
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
          required: field.required,
          readonly: field.readonly,
        } satisfies SaplingFormFieldConfig,
      ]),
    ),
  }
}

export function applyFormConfigDraftToTemplate(
  template: EntityTemplate,
  field: FieldDraft | undefined,
): EntityTemplate {
  if (!field) {
    return template
  }

  return {
    ...template,
    formGroup: field.group || null,
    formOrder: field.order,
    formWidth: field.width,
    formVisible: field.visible,
    tableVisible: field.tableVisible,
    tableOrder: field.tableOrder,
    mobileVisible: field.mobileVisible,
    mobileOrder: field.mobileOrder,
    isRequired: field.required,
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
      required: field.required,
      readonly: field.readonly,
    },
  }
}
