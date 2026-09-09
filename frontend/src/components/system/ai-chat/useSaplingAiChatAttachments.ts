import { ref, type Ref } from 'vue'
import ApiAiService, { type AiChatAttachmentUploadResponse } from '@/services/api.ai.service'

export interface PendingImportAttachment {
  purpose?: string
  handle: number
  filename: string
  rowCount: number
  headerCount: number
  status: string
}

export function useSaplingAiChatAttachments(
  canUploadImportAttachment: Ref<boolean>,
  activeSessionHandle: () => number | null,
  imageOptions?: {
    canUpload: Ref<boolean>
    target: () => { providerHandle?: string; modelHandle?: string }
    reportError: (key: string) => void
  },
) {
  const pendingAttachments = ref<PendingImportAttachment[]>([])
  const isUploadingImportAttachment = ref(false)
  let generation = 0

  async function uploadImageAttachments(files: File[]) {
    if (!imageOptions?.canUpload.value) {
      imageOptions?.reportError('ai.chatVisionRequired')
      return
    }
    if (isUploadingImportAttachment.value) return
    if (
      files.some(
        (file) =>
          !['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type) ||
          !file.size ||
          file.size > 5 * 1024 * 1024,
      )
    ) {
      imageOptions.reportError('ai.chatImageInvalid')
      return
    }
    if (
      files.length + pendingAttachments.value.filter((item) => item.purpose === 'vision').length >
      5
    ) {
      imageOptions.reportError('ai.chatImageCountLimit')
      return
    }
    const uploadGeneration = generation
    const sessionHandle = activeSessionHandle() ?? undefined
    const target = imageOptions.target()
    isUploadingImportAttachment.value = true
    try {
      for (const file of files) {
        if (uploadGeneration !== generation) break
        const { attachment } = await ApiAiService.createChatImage(file, {
          sessionHandle,
          ...target,
        })
        if (uploadGeneration !== generation) break
        pendingAttachments.value.push({
          handle: attachment.handle!,
          filename: attachment.filename,
          purpose: 'vision',
          rowCount: 0,
          headerCount: 0,
          status: attachment.status,
        })
      }
    } catch {
      // The API service reports upload errors.
    } finally {
      isUploadingImportAttachment.value = false
    }
  }

  async function uploadImportAttachment(file: File) {
    if (!canUploadImportAttachment.value || isUploadingImportAttachment.value) return
    isUploadingImportAttachment.value = true

    try {
      const response = await ApiAiService.createChatAttachment(file, {
        sessionHandle: activeSessionHandle() ?? undefined,
        purpose: 'importAnalysis',
      })
      pendingAttachments.value = [
        ...pendingAttachments.value.filter(
          (attachment) => attachment.handle !== response.attachment.handle,
        ),
        buildPendingImportAttachment(response),
      ]
    } catch {
      // The API service already reports the localized upload error.
    } finally {
      isUploadingImportAttachment.value = false
    }
  }

  function removeImportAttachment(handle: number) {
    pendingAttachments.value = pendingAttachments.value.filter(
      (attachment) => attachment.handle !== handle,
    )
  }

  function resetImportAttachments() {
    generation++
    pendingAttachments.value = []
  }

  return {
    uploadImageAttachments,
    pendingAttachments,
    isUploadingImportAttachment,
    uploadImportAttachment,
    removeImportAttachment,
    resetImportAttachments,
  }
}

function buildPendingImportAttachment(
  response: AiChatAttachmentUploadResponse,
): PendingImportAttachment {
  return {
    handle: response.attachment.handle ?? 0,
    filename: response.attachment.filename,
    rowCount: response.importBatch.rowCount,
    headerCount: response.importBatch.headers.length,
    status: response.importBatch.status,
  }
}
