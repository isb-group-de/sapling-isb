import { reactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { SAPLING_ICON_PICKER_PAGE_SIZE, useSaplingIconField } from '../useSaplingIconField'

function createIconItems(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    name: `mdi-test-icon-${String(index + 1).padStart(3, '0')}`,
  }))
}

describe('useSaplingIconField', () => {
  it('opens on the page containing the currently selected icon', () => {
    const items = createIconItems(SAPLING_ICON_PICKER_PAGE_SIZE + 4)
    const props = reactive({
      items,
      label: 'Icon',
      modelValue: items[SAPLING_ICON_PICKER_PAGE_SIZE + 1].name,
    })
    const emit = vi.fn()
    const field = useSaplingIconField(props, emit)

    field.openDialog()

    expect(field.dialog.value).toBe(true)
    expect(field.page.value).toBe(2)
    expect(field.pagedItems.value).toEqual(items.slice(SAPLING_ICON_PICKER_PAGE_SIZE))
  })

  it('filters icon names without requiring the mdi prefix or hyphens', () => {
    const props = reactive({
      items: [
        { name: 'mdi-account-alert-outline' },
        { name: 'mdi-account-check' },
        { name: 'mdi-alert-circle' },
      ],
      label: 'Icon',
      modelValue: '',
    })
    const field = useSaplingIconField(props, vi.fn())

    field.updateSearchQuery('account alert')

    expect(field.filteredItems.value).toEqual([{ name: 'mdi-account-alert-outline' }])
    expect(field.page.value).toBe(1)
  })

  it('emits the selected icon and closes the picker', () => {
    const props = reactive({
      items: [{ name: 'mdi-check' }],
      label: 'Icon',
      modelValue: '',
    })
    const emit = vi.fn()
    const field = useSaplingIconField(props, emit)

    field.openDialog()
    field.selectIcon('mdi-check')

    expect(emit).toHaveBeenCalledWith('update:modelValue', 'mdi-check')
    expect(field.dialog.value).toBe(false)
  })

  it('does not open while the field is disabled', () => {
    const props = reactive({
      items: [{ name: 'mdi-check' }],
      label: 'Icon',
      modelValue: '',
      disabled: true,
    })
    const field = useSaplingIconField(props, vi.fn())

    field.openDialog()

    expect(field.dialog.value).toBe(false)
  })
})
