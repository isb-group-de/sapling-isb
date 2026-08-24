import { describe, expect, it } from 'vitest'
import type { EntityTemplate } from '@/entity/structure'
import {
  buildFormConfigDraftRows,
  createFormConfigGroup,
  moveFormConfigField,
  removeFormConfigGroup,
  reorderFormConfigGroup,
} from '../formConfigAdminDraft.utils'

describe('formConfigAdminDraft utils', () => {
  it('builds supported field and ordered group drafts', () => {
    const templates = [
      { name: 'title', type: 'string', formGroup: 'main', formVisible: true },
      { name: 'children', type: 'collection', kind: '1:m' },
    ] as unknown as EntityTemplate[]

    const draft = buildFormConfigDraftRows(
      templates,
      { title: { label: 'Configured title', helpText: 'Explains the title', order: 5 } },
      { main: { order: 20, label: 'Main', visible: true } },
      (template) => template.name,
    )

    expect(draft.fields.map((field) => field.name)).toEqual(['title'])
    expect(draft.fields[0]).toMatchObject({
      label: 'Configured title',
      helpText: 'Explains the title',
      order: 100,
    })
    expect(draft.groups).toEqual([{ key: 'main', label: 'Main', visible: true, order: 100 }])
  })

  it('creates collision-free custom groups and preserves occupied groups', () => {
    const groups = [{ key: 'ticket.customGroup2', label: 'Existing', visible: true, order: 100 }]
    const created = createFormConfigGroup(groups, 'ticket', 'Extra')
    expect(created).toMatchObject({ key: 'ticket.customGroup3', label: 'Extra' })

    removeFormConfigGroup([{ name: 'title', group: groups[0].key } as never], groups, groups[0].key)
    expect(groups).toHaveLength(1)
  })

  it('reorders groups and moves fields with normalized order values', () => {
    const groups = [
      { key: 'one', label: '', visible: true, order: 100 },
      { key: 'two', label: '', visible: true, order: 200 },
    ]
    const fields = [
      { name: 'a', group: 'one', order: 100 },
      { name: 'b', group: 'two', order: 100 },
    ] as never[]

    reorderFormConfigGroup(groups, 'one', 'two')
    moveFormConfigField(fields, groups, 'a', 'two', 0)

    expect(groups.map((group) => group.key)).toEqual(['two', 'one'])
    expect(fields).toMatchObject([
      { name: 'a', group: 'two', order: 100 },
      { name: 'b', group: 'two', order: 200 },
    ])
  })

  it('inserts groups before and after exact preview targets', () => {
    const groups = [
      { key: 'one', label: '', visible: true, order: 100 },
      { key: 'two', label: '', visible: true, order: 200 },
      { key: 'three', label: '', visible: true, order: 300 },
    ]

    reorderFormConfigGroup(groups, 'three', 'one', 'before')
    expect(groups.map((group) => group.key)).toEqual(['three', 'one', 'two'])

    reorderFormConfigGroup(groups, 'three', 'two', 'after')
    expect(groups.map((group) => group.key)).toEqual(['one', 'two', 'three'])
    expect(groups.map((group) => group.order)).toEqual([100, 200, 300])
  })
})
