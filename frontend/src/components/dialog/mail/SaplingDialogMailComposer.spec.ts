import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { i18n } from '@/i18n'
import SaplingDialogMailComposer from './SaplingDialogMailComposer.vue'

vi.mock('@/components/common/SaplingCodeMirror.vue', () => ({
  default: defineComponent({
    name: 'SaplingCodeMirrorStub',
    props: {
      modelValue: {
        type: String,
        default: '',
      },
    },
    emits: ['update:modelValue', 'focus'],
    setup(props) {
      return () => h('div', { class: 'stub-codemirror-editor' }, props.modelValue)
    },
  }),
}))

const vuetify = createVuetify({
  components,
  directives,
})

const baseProps = {
  templates: [],
  templateHandle: null,
  toRecipients: ['info@schulz-bau.de'],
  ccRecipients: [],
  bccRecipients: [],
  senderEmail: 'sender@example.com',
  selectedSenderEmail: 'sender@example.com',
  senderOptions: [],
  isLoadingSenderOptions: false,
  recipientOptions: [],
  isLoadingRecipientOptions: false,
  subject: '',
  bodyMarkdown: '',
  availableAttachments: [],
  attachmentHandles: [],
  attachmentSelectionSummary: '',
  isLoadingTemplates: false,
  isLoadingAttachments: false,
  hasItemHandle: false,
  translate: (key: string) => key,
}

describe('SaplingDialogMailComposer', () => {
  it('renders with a stubbed markdown field', () => {
    const wrapper = mount(SaplingDialogMailComposer, {
      props: baseProps,
      global: {
        plugins: [vuetify, i18n],
        stubs: {
          SaplingMarkdownField: {
            props: ['modelValue', 'label', 'rows', 'showPreview'],
            emits: ['update:modelValue'],
            render() {
              return h('div', { class: 'stub-markdown-field' }, this.label)
            },
          },
        },
      },
    })

    expect(wrapper.text()).toContain('document.to')
    expect(wrapper.find('.stub-markdown-field').exists()).toBe(true)
  })

  it('renders with the real markdown field', () => {
    const wrapper = mount(SaplingDialogMailComposer, {
      props: baseProps,
      global: {
        plugins: [vuetify, i18n],
      },
    })

    expect(wrapper.exists()).toBe(true)
  })

  it('shows alphabetically sorted context contacts while selected chips stay email-only', () => {
    const wrapper = mount(SaplingDialogMailComposer, {
      props: {
        ...baseProps,
        toRecipients: ['ada@example.com'],
        recipientOptions: [
          {
            email: 'zoe@example.com',
            name: 'Zoë Zimmer',
            companyName: 'Beta AG',
            departmentName: 'Support',
          },
          {
            email: 'ada@example.com',
            name: 'Ada Lovelace',
            companyName: 'Acme GmbH',
            departmentName: 'Entwicklung',
          },
        ],
      },
      global: {
        plugins: [vuetify, i18n],
      },
    })

    const recipientField = wrapper.findAllComponents(components.VCombobox)[0]
    expect(recipientField.props('items')).toEqual([
      {
        title: 'Ada Lovelace (Acme GmbH, Entwicklung) – ada@example.com',
        value: 'ada@example.com',
      },
      {
        title: 'Zoë Zimmer (Beta AG, Support) – zoe@example.com',
        value: 'zoe@example.com',
      },
    ])
    expect(wrapper.text()).toContain('ada@example.com')
    expect(wrapper.text()).not.toContain('Ada Lovelace')
  })

  it('extracts email values from Vuetify option objects when contacts are added successively', async () => {
    const wrapper = mount(SaplingDialogMailComposer, {
      props: {
        ...baseProps,
        recipientOptions: [
          {
            email: 'service@bauer-it.de',
            name: 'Angelika Böhm',
            companyName: 'König Handels GmbH',
            departmentName: 'Einkauf',
          },
          {
            email: 'info@standardfirma.de',
            name: 'Erik Baumann',
            companyName: 'Standardfirma',
            departmentName: 'Finanzen / Rechnungswesen',
          },
        ],
      },
      global: {
        plugins: [vuetify, i18n],
      },
    })
    const recipientField = wrapper.findAllComponents(components.VCombobox)[0]

    recipientField.vm.$emit('update:modelValue', [
      'info@schulz-bau.de',
      {
        title: 'Angelika Böhm (König Handels GmbH, Einkauf) – service@bauer-it.de',
        value: 'service@bauer-it.de',
      },
    ])
    await nextTick()

    const firstSelection = ['info@schulz-bau.de', 'service@bauer-it.de']
    let recipientUpdates = wrapper.emitted('update:toRecipients') ?? []
    expect(recipientUpdates[recipientUpdates.length - 1]).toEqual([firstSelection])

    await wrapper.setProps({ toRecipients: firstSelection })
    recipientField.vm.$emit('update:modelValue', [
      ...firstSelection,
      {
        value: { raw: { email: 'info@standardfirma.de' } },
      },
    ])
    await nextTick()

    recipientUpdates = wrapper.emitted('update:toRecipients') ?? []
    expect(recipientUpdates[recipientUpdates.length - 1]).toEqual([
      [...firstSelection, 'info@standardfirma.de'],
    ])
    expect(recipientUpdates.flat()).not.toContain('[object Object]')
  })
})
