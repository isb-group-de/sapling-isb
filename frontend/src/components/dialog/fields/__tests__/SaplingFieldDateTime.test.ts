import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import SaplingFieldDateTime from '../SaplingFieldDateTime.vue'

describe('SaplingFieldDateTime', () => {
  it('forwards the range error state to both date and time inputs', () => {
    const VDateInputStub = defineComponent({
      name: 'VDateInput',
      props: { error: Boolean },
      template: '<div data-test="date-input" />',
    })
    const SaplingTextFieldStub = defineComponent({
      name: 'SaplingTextField',
      props: { error: Boolean },
      template: '<div data-test="time-input" />',
    })
    const wrapper = mount(SaplingFieldDateTime, {
      props: {
        label: 'End date',
        dateValue: '2026-09-01',
        timeValue: '12:00',
        error: true,
      },
      global: {
        stubs: {
          VRow: { template: '<div><slot /></div>' },
          VCol: { template: '<div><slot /></div>' },
          VDateInput: VDateInputStub,
          SaplingTextField: SaplingTextFieldStub,
        },
      },
    })

    expect(wrapper.getComponent(VDateInputStub).props('error')).toBe(true)
    expect(wrapper.getComponent(SaplingTextFieldStub).props('error')).toBe(true)
  })
})
