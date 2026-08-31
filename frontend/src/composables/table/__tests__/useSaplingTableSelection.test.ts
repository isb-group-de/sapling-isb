import { describe, expect, it, vi } from 'vitest'
import { useSaplingTableSelection } from '../useSaplingTableSelection'

describe('useSaplingTableSelection', () => {
  it('keeps the active row independent from the bulk selection', () => {
    const items = [
      { handle: 'preview', filename: 'preview.pdf' },
      { handle: 'bulk', filename: 'bulk.pdf' },
    ]
    const emit = vi.fn()
    const selection = useSaplingTableSelection(
      {
        items,
        multiSelect: true,
        activeItem: null,
      },
      emit,
    )

    selection.activateRow(0)

    expect(selection.activeRow.value).toBe(0)
    expect(selection.selectedRows.value).toEqual([])
    expect(emit).toHaveBeenCalledWith('update:activeItem', items[0])
    expect(emit).not.toHaveBeenCalledWith('update:selected', [items[0]])

    selection.selectRow(1)

    expect(selection.activeRow.value).toBe(0)
    expect(selection.selectedRows.value).toEqual([1])
    expect(selection.selectedItems.value).toEqual([items[1]])
    expect(emit).toHaveBeenCalledWith('update:selected', [items[1]])
  })

  it('activates the selected row in single-select mode', () => {
    const item = { handle: 'single', filename: 'single.pdf' }
    const emit = vi.fn()
    const selection = useSaplingTableSelection(
      {
        items: [item],
        multiSelect: false,
      },
      emit,
    )

    selection.selectRow(0)

    expect(selection.selectedRow.value).toBe(0)
    expect(selection.activeRow.value).toBe(0)
    expect(emit).toHaveBeenCalledWith('update:activeItem', item)
    expect(emit).toHaveBeenCalledWith('update:selected', [item])
  })
})
