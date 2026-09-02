import { onMounted, onUnmounted, type Ref } from 'vue'
import {
  SAPLING_AI_PREFERENCES_UPDATED_EVENT,
  type SaplingAiPreferences,
} from '@/services/ai-preferences.service'
import { SAPLING_AI_CHAT_PROMPT_EVENT } from '@/utils/saplingScriptResultUtil'
import type { SaplingAiChatPromptEventDetail } from './saplingAiChat.utils'

interface SaplingAiChatLifecycleOptions {
  streamingClock: Ref<number>
  closePanel: () => void
  openPrompt: (detail?: SaplingAiChatPromptEventDetail) => Promise<void>
  applyPreferences: (preferences: SaplingAiPreferences) => void
  pollPersistedActivity: () => void
  abortStream: () => void
  cancelVoiceInput: () => void
  stopSpeechPlayback: () => void
  revokeSpeechObjectUrls: () => void
}

export function useSaplingAiChatLifecycle(options: SaplingAiChatLifecycleOptions): void {
  let streamingClockTimer: number | null = null
  let persistedActivityTimer: number | null = null

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') options.closePanel()
  }
  const handlePrompt = (event: CustomEvent<SaplingAiChatPromptEventDetail>) => {
    void options.openPrompt(event.detail)
  }
  const handlePreferences = (event: CustomEvent<SaplingAiPreferences>) => {
    options.applyPreferences(event.detail)
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
    window.addEventListener(SAPLING_AI_CHAT_PROMPT_EVENT, handlePrompt as EventListener)
    window.addEventListener(
      SAPLING_AI_PREFERENCES_UPDATED_EVENT,
      handlePreferences as EventListener,
    )
    streamingClockTimer = window.setInterval(
      () => (options.streamingClock.value = Date.now()),
      1000,
    )
    persistedActivityTimer = window.setInterval(options.pollPersistedActivity, 1250)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
    window.removeEventListener(SAPLING_AI_CHAT_PROMPT_EVENT, handlePrompt as EventListener)
    window.removeEventListener(
      SAPLING_AI_PREFERENCES_UPDATED_EVENT,
      handlePreferences as EventListener,
    )
    options.abortStream()
    options.cancelVoiceInput()
    options.stopSpeechPlayback()
    options.revokeSpeechObjectUrls()
    if (streamingClockTimer != null) window.clearInterval(streamingClockTimer)
    if (persistedActivityTimer != null) window.clearInterval(persistedActivityTimer)
  })
}
