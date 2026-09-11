import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
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
    expect(panels[1].findComponent({ name: 'SaplingMailSignatureSelection' }).exists()).toBe(false)
    wrapper.findComponent(components.VTabs).vm.$emit('update:modelValue', 'signature')
    await nextTick()
    expect(panels[1].attributes('style')).toContain('display: none')
    expect(panels[2].attributes('style') ?? '').not.toContain('display: none')
    expect(panels[2].findComponent({ name: 'SaplingMailSignatureSelection' }).exists()).toBe(true)
    wrapper.findComponent(components.VTabs).vm.$emit('update:modelValue', 'message')
    await nextTick()
    expect(wrapper.findComponent({ ref: 'markdownField' }).vm).toBe(editor.vm)
    expect(editor.props('modelValue')).toBe('Draft text')
  })
  it('reveals populated CC and BCC fields and allows opening empty fields', async () => {
    const wrapper = mount(SaplingDialogMailComposer, {
      props: { ...baseProps, ccRecipients: ['copy@example.com'] },
      global: { plugins: [vuetify, i18n], stubs: { SaplingMarkdownField: true } },
    })
    const fields = wrapper.findAllComponents(components.VCombobox)
    const recipientHeader = wrapper.find('.sapling-mail-dialog__recipients-header')
    const cc = fields.find((field) => field.props('label') === 'document.cc')!
    const bcc = fields.find((field) => field.props('label') === 'document.bcc')!
    expect(recipientHeader.find('.sapling-mail-dialog__section-title').exists()).toBe(true)
    expect(recipientHeader.find('.sapling-mail-dialog__recipient-toggles').exists()).toBe(true)
    expect(
      recipientHeader
        .find('.sapling-mail-dialog__section-title .sapling-mail-dialog__recipient-toggles')
        .exists(),
    ).toBe(false)
    expect(cc.isVisible()).toBe(true)
    expect(bcc.isVisible()).toBe(false)
    await wrapper.findAll('.sapling-mail-dialog__recipient-toggles button')[1].trigger('click')
    await flushPromises()
    expect(bcc.attributes('style') ?? '').not.toContain('display: none')
    expect(cc.props('modelValue')).toEqual(['copy@example.com'])
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

  it('offers matching people after @ and assigns a selection to exactly one recipient field', async () => {
    const replaceTextRange = vi.fn(() => 'Hallo @Ada Lovelace')
    const wrapper = mount(SaplingDialogMailComposer, {
      props: {
        ...baseProps,
        toRecipients: ['ada@example.com'],
        recipientOptions: [
          {
            email: 'ada@example.com',
            name: 'Ada Lovelace',
            companyName: 'Analytical Engines',
            departmentName: 'Entwicklung',
          },
          {
            email: 'grace@example.com',
            name: 'Grace Hopper',
            companyName: 'Navy',
            departmentName: 'Research',
          },
        ],
      },
      global: {
        plugins: [vuetify, i18n],
        stubs: {
          VMenu: defineComponent({
            name: 'VMenuStub',
            props: { modelValue: Boolean, target: Array },
            setup(props, { slots }) {
              return () => (props.modelValue ? h('div', slots.default?.()) : null)
            },
          }),
          SaplingMarkdownField: defineComponent({
            emits: ['update:modelValue', 'focus', 'selectionChange'],
            setup(_, { expose }) {
              expose({
                replaceTextRange,
              })
              return () => h('div', { class: 'stub-markdown-field' })
            },
          }),
        },
      },
    })
    const editor = wrapper.findComponent({ ref: 'markdownField' })

    editor.vm.$emit('selectionChange', {
      from: 10,
      to: 10,
      value: 'Hallo @Ada',
      focused: true,
      coordinates: { left: 120, top: 200, bottom: 220 },
    })
    await nextTick()

    const mentionPanel = wrapper.get('[data-test="mail-mention-panel"]')
    expect(mentionPanel.text()).toContain('Ada Lovelace')
    expect(mentionPanel.text()).not.toContain('Grace Hopper')

    const bccButton = mentionPanel
      .findAll('button')
      .find((button) => button.text() === 'document.bcc')!
    await bccButton.trigger('click')

    expect(replaceTextRange).toHaveBeenCalledWith(6, 10, '@Ada Lovelace')
    const toUpdates = wrapper.emitted('update:toRecipients') ?? []
    const ccUpdates = wrapper.emitted('update:ccRecipients') ?? []
    const bccUpdates = wrapper.emitted('update:bccRecipients') ?? []
    const bodyUpdates = wrapper.emitted('update:bodyMarkdown') ?? []
    expect(toUpdates[toUpdates.length - 1]).toEqual([[]])
    expect(ccUpdates[ccUpdates.length - 1]).toEqual([[]])
    expect(bccUpdates[bccUpdates.length - 1]).toEqual([['ada@example.com']])
    expect(bodyUpdates[bodyUpdates.length - 1]).toEqual(['Hallo @Ada Lovelace'])
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
    expect(wrapper.get('.sapling-markdown-field').classes()).not.toContain('v-card--link')
  })

  it('shows target-company contacts before current-company contacts while chips stay email-only', () => {
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
        title: 'Zoë Zimmer (Beta AG, Support) – zoe@example.com',
        value: 'zoe@example.com',
        companyLabel: 'Beta AG',
        showCompanyHeader: true,
        showDivider: false,
      },
      {
        title: 'Ada Lovelace (Acme GmbH, Entwicklung) – ada@example.com',
        value: 'ada@example.com',
        companyLabel: 'Acme GmbH · mail.currentCompany',
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
