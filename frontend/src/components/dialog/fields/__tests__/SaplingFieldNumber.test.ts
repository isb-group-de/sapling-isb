import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { beforeAll, describe, expect, it } from 'vitest'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import SaplingFieldNumber from '../SaplingFieldNumber.vue'

const vuetify = createVuetify({
  components,
  directives,
})

const TestHost = defineComponent({
  components: {
    SaplingFieldNumber,
  },
  setup() {
    const value = ref<number | null>(null)

    return {
      value,
    }
  },
  template: `
    <SaplingFieldNumber
      label="Anzahl"
      v-model:modelValue="value"
      :min="1"
      :step="1"
    />
  `,
})

describe('SaplingFieldNumber', () => {
  beforeAll(() => {
    if (!HTMLElement.prototype.setPointerCapture) {
      Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
        configurable: true,
        value: () => {},
      })
    }

    if (!HTMLElement.prototype.releasePointerCapture) {
      Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
        configurable: true,
        value: () => {},
      })
    }
  })

  it('increments from an empty value when a positive minimum is configured', async () => {
    const wrapper = mount(TestHost, {
      attachTo: document.body,
      global: {
        plugins: [vuetify],
      },
    })

    const incrementButton = wrapper.find('[data-testid="increment"]')
    const details = wrapper.get('.v-input__details')

    expect(incrementButton.exists()).toBe(true)
    expect(details.classes()).toContain('v-input__details--hidden')

    await incrementButton.trigger('pointerdown', { pointerId: 1 })
    await nextTick()

    expect((wrapper.vm as { value: number | null }).value).toBe(1)

    await incrementButton.trigger('pointerdown', { pointerId: 2 })
    await nextTick()

    expect((wrapper.vm as { value: number | null }).value).toBe(2)

    wrapper.unmount()
  })

  it('restores the detail area when validation has a message', async () => {
    const wrapper = mount(SaplingFieldNumber, {
      props: {
        label: 'Anzahl',
        modelValue: null,
        rules: [() => 'Pflichtfeld'],
      },
      attachTo: document.body,
      global: {
        plugins: [vuetify],
      },
    })

    const numberInput = wrapper.getComponent({ name: 'VNumberInput' })
    await (numberInput.vm as unknown as { validate: () => Promise<unknown> }).validate()
    await nextTick()

    const details = wrapper.get('.v-input__details')
    expect(details.classes()).not.toContain('v-input__details--hidden')
    expect(details.text()).toContain('Pflichtfeld')

    wrapper.unmount()
  })
})
