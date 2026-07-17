import { describe, expect, it, vi } from 'vitest'
import { useSaplingTableMultiSelect } from '../useSaplingTableMultiSelect'

function createProps(overrides: Record<string, unknown> = {}) {
  return {
    multiSelect: true,
    selectedRows: [0, 1],
    selectedItems: [{ handle: 1 }, { handle: 2 }],
    entityTemplates: [
      {
        name: 'name',
        type: 'string',
        fieldAccess: { allowRead: true, allowCreate: true, allowUpdate: true },
      },
    ],
    scriptButtons: [],
    showActions: true,
    entity: { handle: 'company', canUpdate: true },
    entityPermission: { entityHandle: 'company', allowUpdate: true },
    ...overrides,
  } as never
}

describe('useSaplingTableMultiSelect', () => {
  it('shows and emits bulk update only for updateable selections', () => {
    const emit = vi.fn()
    const subject = useSaplingTableMultiSelect(createProps(), emit as never)

    expect(subject.canBulkUpdateSelection.value).toBe(true)
    subject.bulkUpdateSelected()
    expect(emit).toHaveBeenCalledWith('bulkUpdateSelected')
  })

  it('hides bulk update without entity permission', () => {
    const subject = useSaplingTableMultiSelect(
      createProps({ entityPermission: { entityHandle: 'company', allowUpdate: false } }),
      vi.fn() as never,
    )

    expect(subject.canBulkUpdateSelection.value).toBe(false)
  })

  it('hides bulk update without a writable field', () => {
    const subject = useSaplingTableMultiSelect(
      createProps({
        entityTemplates: [
          {
            name: 'name',
            type: 'string',
            fieldAccess: { allowRead: true, allowCreate: true, allowUpdate: false },
          },
        ],
      }),
      vi.fn() as never,
    )

    expect(subject.canBulkUpdateSelection.value).toBe(false)
  })
})
