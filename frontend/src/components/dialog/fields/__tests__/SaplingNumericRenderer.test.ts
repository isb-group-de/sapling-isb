import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { de } from 'vuetify/locale'
import { createI18n } from 'vue-i18n'
import type { EntityTemplate } from '@/entity/structure'
import SaplingDialogEditFieldRenderer from '../../SaplingDialogEditFieldRenderer.vue'

function mountNumber(template: Partial<EntityTemplate>) {
  const host = defineComponent({
    components: { SaplingDialogEditFieldRenderer },
    setup() {
      const values = ref({ amount: 0 })
      return { values, template: { name: 'amount', key: 'amount', type: 'number', ...template } }
    },
    template: `<SaplingDialogEditFieldRenderer
      :template="template" entity-handle="test" mode="edit" :form-values="values"
      :visible-templates="[template]" :permissions="[]" :icon-names="[]" :rules="[]"
      :is-reference-visible="false" :field-disabled="false" :reference-field-disabled="false"
      @update-field="(key, value) => values[key] = value"
    />`,
  })
  return mount(host, {
    attachTo: document.body,
    global: {
      plugins: [
        createVuetify({ components, directives, locale: { locale: 'de', messages: { de } } }),
        createI18n({ legacy: false, locale: 'de', missingWarn: false, fallbackWarn: false }),
      ],
    },
  })
}

describe('numeric field metadata', () => {
  it.each([
    { isInteger: true, numeric: null, expected: 1 },
    { isInteger: false, numeric: null, expected: 0.5 },
    { isInteger: false, numeric: { step: 0.5 }, expected: 0.5 },
    { isInteger: false, numeric: { step: 1 }, expected: 1 },
    { isInteger: true, numeric: { step: 10 }, expected: 10 },
    { isInteger: true, numeric: { step: 100 }, expected: 100 },
  ])('increments and decrements with $expected steps', async ({ expected, ...template }) => {
    const wrapper = mountNumber(template)
    await vi.waitFor(() => expect(wrapper.find('input').exists()).toBe(true))
    const input = wrapper.get('input')
    await input.trigger('keydown', { key: 'ArrowUp' })
    expect(wrapper.vm.values.amount).toBe(expected)
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.vm.values.amount).toBe(0)
    wrapper.unmount()
  })

  it('keeps German decimal input after blur, including values finer than the step', async () => {
    const wrapper = mountNumber({ isInteger: false, numeric: { step: 0.5 } })
    await flushPromises()
    const input = wrapper.get('input')
    for (const value of ['0,5', '1,25']) {
      await input.setValue(value)
      await input.trigger('blur')
      expect(wrapper.vm.values.amount).toBe(Number(value.replace(',', '.')))
      expect(input.element.value).toBe(value)
    }
    await input.setValue('')
    expect(wrapper.vm.values.amount).toBeNull()
    wrapper.unmount()
  })

  it('prevents a decimal separator when typing in integer fields', async () => {
    const wrapper = mountNumber({ isInteger: true })
    await flushPromises()
    const input = wrapper.get('input')
    input.element.setSelectionRange(1, 1)
    const event = new InputEvent('beforeinput', {
      data: ',',
      inputType: 'insertText',
      bubbles: true,
      cancelable: true,
    })
    input.element.dispatchEvent(event)
    await flushPromises()
    expect(event.defaultPrevented).toBe(true)
    expect(input.element.value).toBe('0')
    expect(wrapper.vm.values.amount).toBe(0)
    wrapper.unmount()
  })
})
