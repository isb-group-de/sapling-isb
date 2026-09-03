import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import SaplingFieldDateType from '../SaplingFieldDateType.vue'

describe('SaplingFieldDateType', () => {
  it('emits a selected calendar day as a date-only string', async () => {
    const selectedDate = new Date(2026, 5, 20)
    const VDateInputStub = defineComponent({
      emits: ['update:modelValue'],
      setup() {
        return { selectedDate }
      },
      template:
        '<button data-test="select-date" @click="$emit(\'update:modelValue\', selectedDate)" />',
    })
    const wrapper = mount(SaplingFieldDateType, {
      props: {
        label: 'Expected completion date',
        modelValue: null,
      },
      global: {
        stubs: {
          VDateInput: VDateInputStub,
        },
      },
    })

    await wrapper.get('[data-test="select-date"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['2026-06-20']])
  })

  it('forwards the range error state to the date input', () => {
    const VDateInputStub = defineComponent({
      props: { error: Boolean },
      template: '<div data-test="date-input" />',
    })
    const wrapper = mount(SaplingFieldDateType, {
      props: {
        label: 'End date',
        modelValue: '2026-06-20',
        error: true,
      },
      global: {
        stubs: {
          VDateInput: VDateInputStub,
        },
      },
    })

    expect(wrapper.getComponent(VDateInputStub).props('error')).toBe(true)
  })
})
