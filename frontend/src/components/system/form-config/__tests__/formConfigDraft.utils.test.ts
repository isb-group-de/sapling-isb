import { describe, expect, it } from 'vitest'
import type { EntityTemplate } from '@/entity/structure'
import type { FieldDraft, GroupDraft } from '../formConfigAdmin.types'
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
  helpText: '  Used in headings and references.  ',
  required: true,
  recommended: true,
  readonly: false,
}

const group: GroupDraft = {
  key: 'Main',
  label: 'Main fields',
  visible: false,
  order: 100,
}

describe('formConfigDraft utils', () => {
  it('builds a normalized persisted form-config payload', () => {
    expect(buildFormConfigPayload('ticket', [field], [group])).toEqual({
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
          helpText: 'Used in headings and references.',
          required: true,
          recommended: false,
          readonly: false,
        },
      },
      groups: {
        Main: {
          visible: false,
          order: 100,
          label: 'Main fields',
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

    const result = applyFormConfigDraftToTemplate(template, field, group)

    expect(result).toMatchObject({
      formGroup: '  Main  ',
      formGroupOrder: 100,
      formGroupConfig: {
        visible: false,
        order: 100,
        label: 'Main fields',
      },
      formOrder: 2,
      formWidth: 3,
      formVisible: false,
      tableVisible: true,
      mobileVisible: false,
      isRequired: true,
      options: [],
      formConfig: {
        label: '  Headline  ',
        renderer: 'shortText',
        helpText: '  Used in headings and references.  ',
        readonly: false,
        recommended: false,
      },
    })
  })

  it('preserves templates without a matching draft', () => {
    const template = { name: 'handle', type: 'number' } as EntityTemplate
    expect(applyFormConfigDraftToTemplate(template, undefined)).toBe(template)
  })
})
