import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
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

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})
afterEach(() => vi.unstubAllGlobals())

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
  it('keeps the editor mounted and its text intact while switching to signature and attachments', async () => {
    const wrapper = mount(SaplingDialogMailComposer, {
      props: { ...baseProps, bodyMarkdown: 'Draft text' },
      global: { plugins: [vuetify, i18n], stubs: { SaplingMarkdownField: true } },
    })
    const panels = wrapper.findAll('[role="tabpanel"]')
    const editor = wrapper.findComponent({ ref: 'markdownField' })
    expect(panels[0].isVisible()).toBe(true)
    expect(panels[1].isVisible()).toBe(false)
    wrapper.findComponent(components.VTabs).vm.$emit('update:modelValue', 'options')
    await nextTick()
    expect(panels[0].attributes('style')).toContain('display: none')
    expect(panels[1].attributes('style') ?? '').not.toContain('display: none')
    wrapper.findComponent(components.VTabs).vm.$emit('update:modelValue', 'message')
    await nextTick()
    expect(wrapper.findComponent({ ref: 'markdownField' }).vm).toBe(editor.vm)
    expect(editor.props('modelValue')).toBe('Draft text')
  })
  it('passes the record context to the image-capable Markdown editor', () => {
    const wrapper = mount(SaplingDialogMailComposer, {
      props: { ...baseProps, entityHandle: 'ticket', itemHandle: 7 },
      global: { plugins: [vuetify, i18n], stubs: { SaplingMarkdownField: true } },
    })
    const editor = wrapper.findComponent({ ref: 'markdownField' })
    expect(editor.props('entityHandle')).toBe('ticket')
    expect(editor.props('itemHandle')).toBe(7)
  })
  it('inserts a template body at the cursor without replacing the subject or existing message', async () => {
    const insert = vi.fn()
    const wrapper = mount(SaplingDialogMailComposer, {
      props: {
        ...baseProps,
        subject: 'Existing subject',
        bodyMarkdown: 'Existing text',
        templates: [
          {
            handle: 5,
            name: 'Paragraph',
            subjectTemplate: 'Unused',
            bodyMarkdown: 'Extra paragraph',
          },
        ],
      },
      global: {
        plugins: [vuetify, i18n],
        stubs: {
          SaplingMarkdownField: defineComponent({
            setup(_, { expose }) {
              expose({ insertTextAtCursor: insert })
              return () => h('div')
            },
          }),
        },
      },
    })
    const selector = wrapper
      .findAllComponents(components.VAutocomplete)
      .find((field) => field.props('label') === 'mail.insertSnippet')!
    selector.vm.$emit('update:modelValue', 5)
    await nextTick()
    expect(insert).toHaveBeenCalledWith('Extra paragraph')
    expect(wrapper.emitted('update:subject')).toBeUndefined()
    expect(wrapper.emitted('update:bodyMarkdown')).toBeUndefined()
  })

  it('accepts dropped attachments and ignores drops during an upload', async () => {
    const wrapper = mount(SaplingDialogMailComposer, {
      props: { ...baseProps, hasItemHandle: true, canUpload: true },
      global: { plugins: [vuetify, i18n] },
    })
    const file = new File(['text'], 'test.txt')
    await wrapper
      .find('.sapling-mail-dialog__upload')
      .trigger('drop', { dataTransfer: { files: [file] } })
    expect(wrapper.emitted('upload-attachments')).toEqual([[[file]]])
    await wrapper.setProps({ isUploading: true })
    await wrapper
      .find('.sapling-mail-dialog__upload')
      .trigger('drop', { dataTransfer: { files: [file] } })
    expect(wrapper.emitted('upload-attachments')).toHaveLength(1)
  })
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
            companyHandle: 2,
            companyName: 'Beta AG',
            departmentName: 'Support',
          },
          {
            email: 'ada@example.com',
            name: 'Ada Lovelace',
            companyHandle: 1,
            companyName: 'Acme GmbH',
            departmentName: 'Entwicklung',
            isCurrentCompany: true,
          },
        ],
      },
      global: {
        plugins: [vuetify, i18n],
      },
    })

    const recipientFields = wrapper.findAllComponents(components.VCombobox)
    const expectedItems = [
      {
        title: 'Ada Lovelace (Acme GmbH, Entwicklung) – ada@example.com',
        value: 'ada@example.com',
        companyLabel: 'Acme GmbH · mail.currentCompany',
        showCompanyHeader: true,
        showDivider: false,
      },
      {
        title: 'Zoë Zimmer (Beta AG, Support) – zoe@example.com',
        value: 'zoe@example.com',
        companyLabel: 'Beta AG',
        showCompanyHeader: true,
        showDivider: true,
      },
    ]

    expect(recipientFields).toHaveLength(3)
    recipientFields.forEach((field) => expect(field.props('items')).toEqual(expectedItems))
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

    const option = {
      title: 'Erik Baumann (Standardfirma, Finanzen) – info@standardfirma.de',
      value: 'info@standardfirma.de',
    }
    const recipientFields = wrapper.findAllComponents(components.VCombobox)
    recipientFields[1].vm.$emit('update:modelValue', [option])
    recipientFields[2].vm.$emit('update:modelValue', [option])
    await nextTick()

    expect(wrapper.emitted('update:ccRecipients')).toEqual([[['info@standardfirma.de']]])
    expect(wrapper.emitted('update:bccRecipients')).toEqual([[['info@standardfirma.de']]])
  })
})
