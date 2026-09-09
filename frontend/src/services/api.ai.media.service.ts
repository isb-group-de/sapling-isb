import axios from 'axios'
import type { AiChatAttachmentItem, AiChatMessageItem } from '@/entity/entity'
import type {
  AiChatAttachmentUploadResponse,
  AiChatTranscriptionResponse,
  CreateAiChatMessageSpeechPayload,
  CreateAiChatTranscriptionPayload,
} from './api.ai.types'
import { buildApiUrl } from './api.client'
import { pushApiErrorMessage } from './api.error.service'
import { withClientTimeContext } from './api.ai.utils'

export class ApiAiMediaService {
  static async createChatImage(
    file: File,
    payload: { sessionHandle?: number; providerHandle?: string; modelHandle?: string },
  ) {
    try {
      const form = new FormData()
      form.append('file', file, file.name)
      for (const [key, value] of Object.entries(payload)) {
        if (value != null) form.append(key, String(value))
      }
      return (
        await axios.post<{ attachment: AiChatAttachmentItem }>(buildApiUrl('ai/chat/images'), form)
      ).data
    } catch (error) {
      this.handleError(error, 'aiChat.attachmentUploadFailed')
      throw error
    }
  }

  static async getChatImage(handle: number): Promise<Blob> {
    return (await axios.get(buildApiUrl(`ai/chat/images/${handle}`), { responseType: 'blob' })).data
  }

  static async ensureMessageSpeech(
    handle: number,
    payload?: CreateAiChatMessageSpeechPayload,
    options?: { suppressErrorMessage?: boolean },
  ): Promise<AiChatMessageItem> {
    try {
      return (
        await axios.post<AiChatMessageItem>(
          buildApiUrl(`ai/chat/messages/${handle}/speech`),
          payload ?? {},
        )
      ).data
    } catch (error: unknown) {
      if (!options?.suppressErrorMessage) this.handleError(error, 'ai.speech.createFailed')
      throw error
    }
  }

  static async downloadMessageSpeechAudio(
    documentHandle: number,
    options?: { suppressErrorMessage?: boolean },
  ): Promise<Blob> {
    try {
      return (
        await axios.get<Blob>(buildApiUrl(`document/download/${documentHandle}`), {
          responseType: 'blob',
          withCredentials: true,
        })
      ).data
    } catch (error: unknown) {
      if (!options?.suppressErrorMessage) this.handleError(error, 'ai.speech.playbackFailed')
      throw error
    }
  }

  static async createChatAttachment(
    file: File,
    payload: { sessionHandle?: number; purpose?: string } = {},
  ): Promise<AiChatAttachmentUploadResponse> {
    try {
      const formData = new FormData()
      formData.append('file', file, file.name)
      for (const [key, value] of Object.entries(payload)) {
        if (value != null) formData.append(key, String(value))
      }
      return (
        await axios.post<AiChatAttachmentUploadResponse>(
          buildApiUrl('ai/chat/attachments'),
          formData,
        )
      ).data
    } catch (error: unknown) {
      this.handleError(error, 'aiChat.attachmentUploadFailed')
      throw error
    }
  }

  static async createTranscription(
    file: File | Blob,
    payload: CreateAiChatTranscriptionPayload = {},
    filename = 'sapling-chat-audio.webm',
  ): Promise<AiChatTranscriptionResponse> {
    try {
      const formData = new FormData()
      formData.append('file', file, filename)
      for (const [key, value] of Object.entries(withClientTimeContext(payload))) {
        if (value != null) formData.append(key, String(value))
      }
      return (
        await axios.post<AiChatTranscriptionResponse>(
          buildApiUrl('ai/chat/transcriptions'),
          formData,
        )
      ).data
    } catch (error: unknown) {
      this.handleError(error, 'ai.transcription.createFailed')
      throw error
    }
  }

  protected static handleError(error: unknown, fallbackMessage: string, context = 'aiChat') {
    pushApiErrorMessage(error, fallbackMessage, context)
  }
}
