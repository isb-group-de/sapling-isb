import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import SaplingDialogMailPreview from './SaplingDialogMailPreview.vue'

const vuetify = createVuetify({ components, directives })
const props = {
  composerLocked: false,
  draftStatus: 'restored' as const,
  failedUploads: [],
  sendIssues: [],
  noRotationSignatures: true,
  hasItemHandle: true,
  placeholderGroups: [],
  insertTarget: 'body' as const,
  isLoadingPlaceholders: false,
  isPreviewLoading: false,
  previewFrom: 'sender@example.com',
  previewTo: 'recipient@example.com',
  previewCc: '',
  previewBcc: '',
  previewSubject: 'Review',
  attachmentSelectionSummary: '',
  previewMarkdown: 'Message',
  translate: (key: string) => key,
}

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

function render() {
  return mount(SaplingDialogMailPreview, {
    props,
    global: { plugins: [vuetify], stubs: { SaplingMarkdownContent: true } },
  })
}

describe('mail preview and information workspace', () => {
  it('collects routine notices without displacing or replacing the preview', async () => {
    const wrapper = render()
    const information = wrapper.find('[id$="-information"][role="tabpanel"]')
    const preview = wrapper.find('[id$="-preview"][role="tabpanel"]')
    expect(preview.isVisible()).toBe(true)
    expect(information.isVisible()).toBe(false)
    await wrapper.find('[id$="-information-tab"]').trigger('click')
    await flushPromises()
    expect(information.attributes('style') ?? '').not.toContain('display: none')
    expect(information.text()).toContain('mail.draftRestored')
    expect(information.text()).toContain('mail.noRotationSignatures')
    const discard = information
      .findAll('button')
      .find((button) => button.text() === 'mail.discardDraft')!
    await discard.trigger('click')
    expect(wrapper.emitted('discard-draft')).toHaveLength(1)
  })

  it('opens send checks automatically and keeps blocking checks unconfirmable', async () => {
    const wrapper = render()
    await wrapper.setProps({ composerLocked: true, sendIssues: [{ key: 'mail.checkSubject' }] })
    const information = wrapper.find('[id$="-information"][role="tabpanel"]')
    expect(information.isVisible()).toBe(true)
    expect(information.attributes('inert')).toBeUndefined()
    const confirm = information
      .findAll('button')
      .find((button) => button.text() === 'mail.sendAnyway')!
    await confirm.trigger('click')
    expect(wrapper.emitted('confirm-send')).toHaveLength(1)
    await wrapper.setProps({ sendIssues: [{ key: 'mail.checkRecipients', blocking: true }] })
    expect(information.text()).not.toContain('mail.sendAnyway')
    const resume = information
      .findAll('button')
      .find((button) => button.text() === 'mail.continueEditing')!
    await resume.trigger('click')
    expect(wrapper.emitted('continue-editing')).toHaveLength(1)
  })

  it('surfaces failed uploads and draft storage failures in the information panel', async () => {
    const wrapper = render()
    await wrapper.setProps({ failedUploads: ['report.pdf'], draftStatus: 'failed' })
    const information = wrapper.find('[id$="-information"][role="tabpanel"]')
    expect(information.isVisible()).toBe(true)
    expect(information.text()).toContain('report.pdf')
    expect(information.text()).toContain('mail.draftFailed')
  })
})
