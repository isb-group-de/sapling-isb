import { defineComponent, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiProviderModelItem, AiProviderTypeItem } from '@/entity/entity'
import {
  appendTranscriptToMarkdown,
  useSaplingMarkdownVoiceInput,
} from './useSaplingMarkdownVoiceInput'

const api = vi.hoisted(() => ({
  listTranscriptionProviders: vi.fn(),
  listTranscriptionModels: vi.fn(),
  createTranscription: vi.fn(),
}))

vi.mock('@/services/api.ai.service', () => ({ default: api }))

const transcriptionProviders = [
  { handle: 'openai', title: 'OpenAI' },
] as unknown as AiProviderTypeItem[]
const transcriptionModels = [
  {
    handle: 'openai-whisper-1',
    title: 'Whisper 1',
    provider: 'openai',
    isDefault: true,
  },
] as unknown as AiProviderModelItem[]

class FakeMediaRecorder extends EventTarget {
  static latest: FakeMediaRecorder | null = null

  readonly mimeType = 'audio/webm'
  state: RecordingState = 'inactive'

  constructor(stream: MediaStream) {
    super()
    void stream
    FakeMediaRecorder.latest = this
  }

  start() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    const dataEvent = new Event('dataavailable')
    Object.defineProperty(dataEvent, 'data', {
      value: new Blob(['recording'], { type: this.mimeType }),
    })
    this.dispatchEvent(dataEvent)
    this.dispatchEvent(new Event('stop'))
  }
}

const getUserMedia = vi.fn()
const stopTrack = vi.fn()

function mountHarness(prepareWithAi = vi.fn(async () => true)) {
  return mount(
    defineComponent({
      setup() {
        const draftValue = ref('Vorhandener Inhalt')
        const previewValue = ref('Vorhandener Inhalt')
        const editor = ref(null)
        const isPreparingWithAi = ref(false)
        const voiceInput = useSaplingMarkdownVoiceInput({
          draftValue,
          previewValue,
          editor,
          isPreparingWithAi,
          prepareWithAi,
        })

        return { draftValue, ...voiceInput }
      },
      template: `
        <button
          v-if="canTranscribeWithAi"
          data-test="voice-input"
          @click="toggleVoiceInput"
        />
        <span data-test="draft">{{ draftValue }}</span>
      `,
    }),
  )
}

describe('useSaplingMarkdownVoiceInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    FakeMediaRecorder.latest = null
    api.listTranscriptionProviders.mockResolvedValue(transcriptionProviders)
    api.listTranscriptionModels.mockResolvedValue(transcriptionModels)
    api.createTranscription.mockResolvedValue({
      transcriptionHandle: 17,
      transcript: 'Neu diktierter Text',
      detectedLanguage: 'de',
      durationSeconds: 1,
      status: 'completed',
      providerHandle: 'openai',
      modelHandle: 'openai-whisper-1',
      documentHandle: 42,
    })
    getUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream)
    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      value: FakeMediaRecorder,
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not expose voice input without a configured transcription model', async () => {
    api.listTranscriptionModels.mockResolvedValue([])

    const wrapper = mountHarness()
    await flushPromises()

    expect(wrapper.find('[data-test="voice-input"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('transcribes a recording and immediately passes the combined draft to AI preparation', async () => {
    const prepareWithAi = vi.fn(async () => true)
    const wrapper = mountHarness(prepareWithAi)
    await flushPromises()

    await wrapper.get('[data-test="voice-input"]').trigger('click')
    await flushPromises()
    expect(FakeMediaRecorder.latest?.state).toBe('recording')

    await wrapper.get('[data-test="voice-input"]').trigger('click')
    await flushPromises()

    expect(api.createTranscription).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.objectContaining({
        providerHandle: 'openai',
        modelHandle: 'openai-whisper-1',
      }),
      'sapling-markdown-audio.webm',
    )
    expect(prepareWithAi).toHaveBeenCalledWith('Vorhandener Inhalt\n\nNeu diktierter Text')
    expect(wrapper.get('[data-test="draft"]').text()).toBe(
      'Vorhandener Inhalt\n\nNeu diktierter Text',
    )
    expect(stopTrack).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
})

describe('appendTranscriptToMarkdown', () => {
  it('separates an appended transcript from existing Markdown', () => {
    expect(appendTranscriptToMarkdown('Bestehend', 'Diktiert')).toBe('Bestehend\n\nDiktiert')
  })

  it('uses the transcript directly for an empty field', () => {
    expect(appendTranscriptToMarkdown('  ', ' Diktiert ')).toBe('Diktiert')
  })
})
