import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SaplingMergeFieldChoice from '../SaplingMergeFieldChoice.vue'

function mountChoice() {
  return mount(SaplingMergeFieldChoice, {
    props: {
      modelValue: 'winner',
      entityHandle: 'company',
      label: 'Name',
      template: { key: 'company.name', name: 'name', type: 'string' },
      leftSource: 'loser',
      rightSource: 'winner',
      leftLabel: 'Loser',
      rightLabel: 'Winner',
      leftValue: 'Source name',
      rightValue: 'Winner name',
    },
    global: {
      stubs: {
        VBtnToggle: {
          name: 'VBtnToggle',
          props: ['modelValue', 'disabled'],
          emits: ['update:modelValue'],
          template: '<div><slot /></div>',
        },
        VBtn: { template: '<button><slot /></button>' },
        SaplingChangeLogDetailValue: {
          name: 'SaplingChangeLogDetailValue',
          props: ['value'],
          template: '<div>{{ value }}</div>',
        },
      },
    },
  })
}

describe('shared merge field comparison', () => {
  it('shows the loser on the left and highlights the selected winner on the right', () => {
    const wrapper = mountChoice()
    const values = wrapper.findAll('.sapling-update-conflict__value')
    expect(values[0].text()).toContain('Source name')
    expect(values[1].text()).toContain('Winner name')
    expect(values[0].classes()).not.toContain('sapling-update-conflict__value--selected')
    expect(values[1].classes()).toContain('sapling-update-conflict__value--selected')
    expect(wrapper.findAll('button').map((button) => button.attributes('aria-pressed'))).toEqual([
      'false',
      'true',
    ])
    wrapper.unmount()
  })

  it('emits field source choices and reflects the newly selected side', async () => {
    const wrapper = mountChoice()
    wrapper.getComponent({ name: 'VBtnToggle' }).vm.$emit('update:modelValue', 'loser')
    expect(wrapper.emitted('update:modelValue')).toEqual([['loser']])
    await wrapper.setProps({ modelValue: 'loser' })
    expect(wrapper.findAll('.sapling-update-conflict__value')[0].classes()).toContain(
      'sapling-update-conflict__value--selected',
    )
    expect(wrapper.findAll('button').map((button) => button.attributes('aria-pressed'))).toEqual([
      'true',
      'false',
    ])
    wrapper.unmount()
  })

  it('locks the selector for read-only fields and during saving', async () => {
    const wrapper = mountChoice()
    await wrapper.setProps({ disabled: true })
    expect(wrapper.getComponent({ name: 'VBtnToggle' }).props('disabled')).toBe(true)
    wrapper.unmount()
  })
})
