import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SaplingTableGrouping from '../SaplingTableGrouping.vue'
import { TABLE_GROUP_DRAG_TYPE } from '@/composables/table/saplingTablePreferences'

const fields = [
  { value: 'status', title: 'Status' },
  { value: 'priority', title: 'Priorität' },
]
function mountGrouping(modelValue: string[]) {
  return mount(SaplingTableGrouping, {
    props: { fields, modelValue },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        VIcon: true,
        VMenu: true,
        VList: true,
        VListItem: true,
        VBtn: { template: '<button><slot /></button>' },
      },
    },
  })
}
const transfer = (field: string) => ({ types: [TABLE_GROUP_DRAG_TYPE], getData: () => field })

describe('table grouping drop area', () => {
  it('adds a visible column and rejects hidden columns', async () => {
    const wrapper = mountGrouping(['status'])
    await wrapper.get('section').trigger('drop', { dataTransfer: transfer('hidden') })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await wrapper.get('section').trigger('drop', { dataTransfer: transfer('priority') })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['status', 'priority']])
  })
  it('moves an existing group before another without duplicating it', async () => {
    const wrapper = mountGrouping(['status', 'priority'])
    await wrapper
      .get('.sapling-table-grouping__level')
      .trigger('drop', { dataTransfer: transfer('priority') })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['priority', 'status']])
  })
  it('supports accessible reordering and removal without drag and drop', async () => {
    const wrapper = mountGrouping(['status', 'priority'])
    await wrapper.get('button[aria-label="global.tableGroupEarlier: Priorität"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['priority', 'status']])
    await wrapper.get('button[aria-label="global.tableGroupRemove: Status"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual([['priority']])
  })
})
