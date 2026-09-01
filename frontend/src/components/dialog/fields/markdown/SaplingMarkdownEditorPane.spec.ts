import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import SaplingMarkdownEditorPane from './SaplingMarkdownEditorPane.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: { value: 'de' },
    t: (key: string) => key,
  }),
}))

function mountPane(canUploadImage: boolean) {
  return shallowMount(SaplingMarkdownEditorPane, {
    props: {
      draftValue: '',
      resolvedLabel: 'Beschreibung',
      rows: 6,
      disabled: false,
      required: false,
      remainingCharacters: null,
      rules: [],
      toolbarActions: [],
      isEnhancedEditorReady: false,
      editorTheme: 'light',
      editorHeight: '200px',
      isPreparingWithAi: false,
      canPrepareWithAi: false,
      canTranscribeWithAi: false,
      isRecordingVoiceInput: false,
      isTranscribingVoiceInput: false,
      showImageUpload: canUploadImage,
      canUploadImage,
      isUploadingImage: false,
      imageUploadTitle: 'Bild hochladen',
      existingImageTitle: 'Vorhandenes Bild',
    },
  })
}

function dispatchPaste(wrapper: ReturnType<typeof mountPane>, files: File[]) {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: {
      items: files.map((file) => ({
        kind: 'file',
        type: file.type,
        getAsFile: () => file,
      })),
      files,
    },
  })
  wrapper.get('.sapling-markdown-editor-shell').element.dispatchEvent(event)
  return event
}

describe('SaplingMarkdownEditorPane clipboard images', () => {
  it('intercepts image paste and emits the images for scoped upload', () => {
    const wrapper = mountPane(true)
    const image = new File(['image'], 'clipboard.png', { type: 'image/png' })

    const event = dispatchPaste(wrapper, [image])

    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.emitted('pasteImages')?.[0]).toEqual([[image]])
  })

  it('keeps native paste behavior when image upload is unavailable', () => {
    const wrapper = mountPane(false)
    const image = new File(['image'], 'clipboard.png', { type: 'image/png' })

    const event = dispatchPaste(wrapper, [image])

    expect(event.defaultPrevented).toBe(false)
    expect(wrapper.emitted('pasteImages')).toBeUndefined()
  })
})
