import { ref } from 'vue'
import ApiDocumentService from '@/services/api.document.service'
import type { AttachmentOption } from '@/components/dialog/mail/SaplingDialogMail.types'

export function useMailAttachmentUpload(options: {
  target: () => { entity: string; reference: string; generation: number } | null
  accept: (attachment: AttachmentOption) => void
}) {
  const isUploading = ref(false)
  const failedUploads = ref<string[]>([])

  async function uploadAttachments(files: File[]) {
    const target = options.target()
    if (!target || isUploading.value || !files.length) return
    isUploading.value = true
    failedUploads.value = []
    try {
      for (const file of files) {
        if (options.target()?.generation !== target.generation) break
        const data = new FormData()
        data.append('file', file)
        data.append('typeHandle', 'document')
        try {
          const document = await ApiDocumentService.upload(target.entity, target.reference, data)
          if (options.target()?.generation === target.generation) {
            options.accept({
              handle: document.handle,
              filename: document.filename,
              title: document.filename,
            })
          }
        } catch {
          if (options.target()?.generation === target.generation)
            failedUploads.value.push(file.name)
        }
      }
    } finally {
      isUploading.value = false
    }
  }
  return { isUploading, failedUploads, uploadAttachments }
}
