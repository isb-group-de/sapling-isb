import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import type { AiProviderModelItem, AiProviderTypeItem } from '@/entity/entity'
import type { MarkdownEditorHandle } from '@/components/dialog/fields/markdown/markdownField.types'
import { resolveRuntimeTarget } from '@/components/system/ai-chat/aiChatRuntimeTargets'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import ApiAiService from '@/services/api.ai.service'
import {
  loadSaplingAiPreferences,
  SAPLING_AI_PREFERENCES_UPDATED_EVENT,
} from '@/services/ai-preferences.service'

const VOICE_INPUT_SILENCE_THRESHOLD = 0.02
const VOICE_INPUT_SILENCE_STOP_DELAY_MS = 1600
const VOICE_INPUT_SILENCE_MONITOR_INTERVAL_MS = 200
const VOICE_INPUT_INITIAL_GRACE_PERIOD_MS = 2500

let activeTranscriptionCatalogRequest: Promise<{
  providerConfigs: AiProviderTypeItem[]
  modelConfigs: AiProviderModelItem[]
}> | null = null

type MarkdownVoiceInputOptions = {
  draftValue: Ref<string>
  previewValue: Ref<string>
  editor: Ref<MarkdownEditorHandle | null>
  isPreparingWithAi: Ref<boolean>
  prepareWithAi: (content?: string) => Promise<boolean>
}

export function useSaplingMarkdownVoiceInput({
  draftValue,
  previewValue,
  editor,
  isPreparingWithAi,
  prepareWithAi,
}: MarkdownVoiceInputOptions) {
  const { pushMessage } = useSaplingMessageCenter()
  const selectedTranscriptionProviderHandle = ref<string | null>(null)
  const selectedTranscriptionModelHandle = ref<string | null>(null)
  const isRecordingVoiceInput = ref(false)
  const isTranscribingVoiceInput = ref(false)
  const activeVoiceRecorder = ref<MediaRecorder | null>(null)
  const activeVoiceStream = ref<MediaStream | null>(null)
  const activeVoiceAudioContext = ref<AudioContext | null>(null)
  const activeVoiceAnalyser = ref<AnalyserNode | null>(null)
  const activeVoiceSourceNode = ref<MediaStreamAudioSourceNode | null>(null)

  let voiceRecordingStartedAt: number | null = null
  let pendingVoiceChunks: Blob[] = []
  let discardPendingVoiceRecording = false
  let voiceInputSilenceMonitorTimer: number | null = null
  let lastDetectedVoiceActivityAt: number | null = null

  const hasConfiguredTranscriptionTarget = computed(
    () => !!selectedTranscriptionProviderHandle.value && !!selectedTranscriptionModelHandle.value,
  )
  const canTranscribeWithAi = computed(
    () =>
      typeof window !== 'undefined' &&
      typeof MediaRecorder !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      hasConfiguredTranscriptionTarget.value,
  )

  async function loadTranscriptionTarget() {
    try {
      const { providerConfigs, modelConfigs } = await loadTranscriptionCatalog()

      if (providerConfigs.length === 0 || modelConfigs.length === 0) {
        selectedTranscriptionProviderHandle.value = null
        selectedTranscriptionModelHandle.value = null
        return
      }

      const preferences = loadSaplingAiPreferences()
      const target = resolveRuntimeTarget({
        providerConfigs,
        modelConfigs,
        requestedProviderHandle: preferences.transcriptionProviderHandle,
        requestedModelHandle: preferences.transcriptionModelHandle,
        preferredModelHandle: preferences.transcriptionModelHandle,
      })

      selectedTranscriptionProviderHandle.value = target.providerHandle
      selectedTranscriptionModelHandle.value = target.modelHandle
    } catch {
      selectedTranscriptionProviderHandle.value = null
      selectedTranscriptionModelHandle.value = null
    }
  }

  async function toggleVoiceInput() {
    if (isTranscribingVoiceInput.value || isPreparingWithAi.value) {
      return
    }

    if (isRecordingVoiceInput.value) {
      stopVoiceInput()
      return
    }

    if (!canTranscribeWithAi.value) {
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)

      pendingVoiceChunks = []
      discardPendingVoiceRecording = false
      voiceRecordingStartedAt = Date.now()
      activeVoiceStream.value = stream
      activeVoiceRecorder.value = recorder
      isRecordingVoiceInput.value = true
      startVoiceInputSilenceMonitoring(stream)

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          pendingVoiceChunks.push(event.data)
        }
      })

      recorder.addEventListener('stop', () => {
        const mimeType = recorder.mimeType || 'audio/webm'
        const durationSeconds =
          voiceRecordingStartedAt != null
            ? Math.max(0, (Date.now() - voiceRecordingStartedAt) / 1000)
            : undefined

        isRecordingVoiceInput.value = false
        voiceRecordingStartedAt = null
        stopVoiceInputSilenceMonitoring()
        stopVoiceStreamTracks()
        activeVoiceRecorder.value = null

        const chunks = pendingVoiceChunks
        pendingVoiceChunks = []

        if (discardPendingVoiceRecording || chunks.length === 0) {
          discardPendingVoiceRecording = false
          return
        }

        void transcribeAndPrepareRecording(
          new Blob(chunks, { type: mimeType }),
          mimeType,
          durationSeconds,
        )
      })

      recorder.start()
    } catch (error) {
      pushMessage('error', 'aiChat.microphoneAccessFailed', '', 'aiChat', error)
      cancelVoiceInput()
    }
  }

  function stopVoiceInput() {
    if (!activeVoiceRecorder.value || activeVoiceRecorder.value.state === 'inactive') {
      return
    }

    activeVoiceRecorder.value.stop()
  }

  function cancelVoiceInput() {
    discardPendingVoiceRecording = true

    if (activeVoiceRecorder.value && activeVoiceRecorder.value.state !== 'inactive') {
      activeVoiceRecorder.value.stop()
    }

    pendingVoiceChunks = []
    isRecordingVoiceInput.value = false
    isTranscribingVoiceInput.value = false
    voiceRecordingStartedAt = null
    stopVoiceInputSilenceMonitoring()
    activeVoiceRecorder.value = null
    stopVoiceStreamTracks()
  }

  function stopVoiceStreamTracks() {
    if (!activeVoiceStream.value) {
      return
    }

    for (const track of activeVoiceStream.value.getTracks()) {
      track.stop()
    }

    activeVoiceStream.value = null
  }

  function startVoiceInputSilenceMonitoring(stream: MediaStream) {
    stopVoiceInputSilenceMonitoring()

    const webkitWindow = window as Window & { webkitAudioContext?: typeof AudioContext }
    const audioContextConstructor = window.AudioContext ?? webkitWindow.webkitAudioContext

    if (!audioContextConstructor) {
      return
    }

    try {
      const audioContext = new audioContextConstructor()
      const analyser = audioContext.createAnalyser()
      const sourceNode = audioContext.createMediaStreamSource(stream)

      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.1
      sourceNode.connect(analyser)

      const sampleBuffer = new Uint8Array(analyser.fftSize)

      activeVoiceAudioContext.value = audioContext
      activeVoiceAnalyser.value = analyser
      activeVoiceSourceNode.value = sourceNode
      lastDetectedVoiceActivityAt = Date.now()

      void audioContext.resume().catch(() => undefined)

      voiceInputSilenceMonitorTimer = window.setInterval(() => {
        if (
          !isRecordingVoiceInput.value ||
          !activeVoiceRecorder.value ||
          activeVoiceRecorder.value.state === 'inactive'
        ) {
          return
        }

        analyser.getByteTimeDomainData(sampleBuffer)

        let sumSquares = 0

        for (const sample of sampleBuffer) {
          const normalizedSample = (sample - 128) / 128
          sumSquares += normalizedSample * normalizedSample
        }

        const rms = Math.sqrt(sumSquares / sampleBuffer.length)
        const now = Date.now()

        if (rms >= VOICE_INPUT_SILENCE_THRESHOLD) {
          lastDetectedVoiceActivityAt = now
          return
        }

        const recordingStartedAt = voiceRecordingStartedAt ?? now
        const lastActivityAt = lastDetectedVoiceActivityAt ?? recordingStartedAt

        if (now - recordingStartedAt < VOICE_INPUT_INITIAL_GRACE_PERIOD_MS) {
          return
        }

        if (now - lastActivityAt >= VOICE_INPUT_SILENCE_STOP_DELAY_MS) {
          stopVoiceInput()
        }
      }, VOICE_INPUT_SILENCE_MONITOR_INTERVAL_MS)
    } catch {
      stopVoiceInputSilenceMonitoring()
    }
  }

  function stopVoiceInputSilenceMonitoring() {
    if (voiceInputSilenceMonitorTimer != null) {
      window.clearInterval(voiceInputSilenceMonitorTimer)
      voiceInputSilenceMonitorTimer = null
    }

    lastDetectedVoiceActivityAt = null

    activeVoiceSourceNode.value?.disconnect()
    activeVoiceAnalyser.value?.disconnect()
    activeVoiceSourceNode.value = null
    activeVoiceAnalyser.value = null

    const audioContext = activeVoiceAudioContext.value
    activeVoiceAudioContext.value = null
    void audioContext?.close().catch(() => undefined)
  }

  async function transcribeAndPrepareRecording(
    blob: Blob,
    mimeType: string,
    durationSeconds?: number,
  ) {
    isTranscribingVoiceInput.value = true

    try {
      const response = await ApiAiService.createTranscription(
        blob,
        {
          providerHandle: selectedTranscriptionProviderHandle.value ?? undefined,
          modelHandle: selectedTranscriptionModelHandle.value ?? undefined,
          url: window.location.href,
          pageTitle: document.title || undefined,
          durationSeconds,
        },
        buildVoiceRecordingFilename(mimeType),
      )
      const transcript = response.transcript?.trim() ?? ''

      if (!transcript) {
        pushMessage('info', 'aiChat.noSpeechDetected', '', 'aiChat')
        return
      }

      const contentWithTranscript = appendTranscriptToMarkdown(draftValue.value, transcript)
      draftValue.value = contentWithTranscript
      previewValue.value = contentWithTranscript
      await prepareWithAi(contentWithTranscript)
      editor.value?.focus()
    } catch {
      // ApiAiService already forwards transcription and preparation errors.
    } finally {
      isTranscribingVoiceInput.value = false
    }
  }

  function handlePreferencesUpdated() {
    void loadTranscriptionTarget()
  }

  onMounted(() => {
    void loadTranscriptionTarget()
    window.addEventListener(SAPLING_AI_PREFERENCES_UPDATED_EVENT, handlePreferencesUpdated)
  })

  onBeforeUnmount(() => {
    window.removeEventListener(SAPLING_AI_PREFERENCES_UPDATED_EVENT, handlePreferencesUpdated)
    cancelVoiceInput()
  })

  return {
    canTranscribeWithAi,
    isRecordingVoiceInput,
    isTranscribingVoiceInput,
    toggleVoiceInput,
  }
}

function loadTranscriptionCatalog() {
  if (activeTranscriptionCatalogRequest) {
    return activeTranscriptionCatalogRequest
  }

  const request = Promise.all([
    ApiAiService.listTranscriptionProviders({ suppressErrorMessage: true }),
    ApiAiService.listTranscriptionModels(undefined, { suppressErrorMessage: true }),
  ]).then(([providerConfigs, modelConfigs]) => ({ providerConfigs, modelConfigs }))

  activeTranscriptionCatalogRequest = request
  const clearRequest = () => {
    if (activeTranscriptionCatalogRequest === request) {
      activeTranscriptionCatalogRequest = null
    }
  }
  void request.then(clearRequest, clearRequest)

  return request
}

export function appendTranscriptToMarkdown(content: string, transcript: string) {
  const trimmedContent = content.trim()
  const trimmedTranscript = transcript.trim()

  if (!trimmedContent) {
    return trimmedTranscript
  }

  if (!trimmedTranscript) {
    return trimmedContent
  }

  return `${trimmedContent}\n\n${trimmedTranscript}`
}

function buildVoiceRecordingFilename(mimeType: string) {
  if (mimeType.includes('ogg')) {
    return 'sapling-markdown-audio.ogg'
  }

  if (mimeType.includes('wav')) {
    return 'sapling-markdown-audio.wav'
  }

  if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
    return 'sapling-markdown-audio.m4a'
  }

  return 'sapling-markdown-audio.webm'
}
