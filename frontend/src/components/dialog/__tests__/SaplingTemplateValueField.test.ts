import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it } from 'vitest'
import type { EntityTemplate } from '@/entity/structure'
import SaplingTemplateValueField from '../SaplingTemplateValueField.vue'

describe('SaplingTemplateValueField', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('uses edit semantics for neutral value entry', () => {
    const wrapper = mount(SaplingTemplateValueField, {
      props: {
        modelValue: '',
        template: { name: 'name', type: 'string' } as EntityTemplate,
        entityHandle: 'company',
        visibleTemplates: [],
        permissions: [],
      },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'de', messages: { de: {} } })],
        stubs: {
          SaplingDialogEditFieldRenderer: {
            props: ['mode'],
            template: '<div data-test="renderer" :data-mode="mode" />',
          },
        },
      },
    })

    expect(wrapper.get('[data-test="renderer"]').attributes('data-mode')).toBe('edit')
  })
})
