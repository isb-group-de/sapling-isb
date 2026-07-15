import { describe, expect, it } from 'vitest'
import type { EntityTemplate } from '@/entity/structure'
import type { FieldDraft } from '../formConfigAdmin.types'
import { applyFormConfigDraftToTemplate, buildFormConfigPayload } from '../formConfigDraft.utils'

const field: FieldDraft = {
  name: 'title',
  type: 'string',
  visible: true,
  label: '  Headline  ',
  group: '  Main  ',
  order: 2,
  width: 3,
  tableVisible: true,
  tableOrder: 4,
  mobileVisible: false,
  mobileOrder: 5,
  renderer: 'shortText',
  placeholder: '  Enter title  ',
  required: true,
  readonly: false,
}

describe('formConfigDraft utils', () => {
  it('builds a normalized persisted form-config payload', () => {
    expect(buildFormConfigPayload('ticket', [field])).toEqual({
      schema: 'sapling.form-config.v1',
      entityHandle: 'ticket',
      fields: {
        title: {
          visible: true,
          label: 'Headline',
          group: 'Main',
          order: 2,
          width: 3,
          tableVisible: true,
          tableOrder: 4,
          mobileVisible: false,
          mobileOrder: 5,
          renderer: 'shortText',
          placeholder: 'Enter title',
          required: true,
          readonly: false,
        },
      },
    })
  })

  it('projects a draft onto preview template metadata', () => {
    const template = {
      name: 'title',
      type: 'string',
      formGroup: null,
      formOrder: null,
      formWidth: null,
    } as EntityTemplate

    const result = applyFormConfigDraftToTemplate(template, field)

    expect(result).toMatchObject({
      formGroup: '  Main  ',
      formOrder: 2,
      formWidth: 3,
      formVisible: true,
      tableVisible: true,
      mobileVisible: false,
      isRequired: true,
      formConfig: {
        label: '  Headline  ',
        renderer: 'shortText',
        readonly: false,
      },
    })
  })

  it('preserves templates without a matching draft', () => {
    const template = { name: 'handle', type: 'number' } as EntityTemplate
    expect(applyFormConfigDraftToTemplate(template, undefined)).toBe(template)
  })
})
