import { ref, type Ref } from 'vue'
import ApiAiService, { type AiChatAttachmentUploadResponse } from '@/services/api.ai.service'

export interface PendingImportAttachment {
  handle: number
  filename: string
  rowCount: number
  headerCount: number
  status: string
}

export function useSaplingAiChatAttachments(
  canUploadImportAttachment: Ref<boolean>,
  activeSessionHandle: () => number | null,
) {
  const pendingAttachments = ref<PendingImportAttachment[]>([])
  const isUploadingImportAttachment = ref(false)

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
    pendingAttachments.value = []
  }

  return {
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
