import { ref } from 'vue'

export type MailDraft = {
  subject: string
  bodyMarkdown: string
  to: string[]
  cc: string[]
  bcc: string[]
  senderEmail: string
  templateHandle: number | null
  attachmentHandles: number[]
  signatureRotation: boolean
  signatureHandle: number | null
}

export function useMailDraft() {
  const draftStatus = ref<'none' | 'saved' | 'restored' | 'failed'>('none')
  let key: string | null = null

  function openDraft(identity: unknown[]): MailDraft | null {
    key = `sapling:mail-draft:v1:${JSON.stringify(identity)}`
    draftStatus.value = 'none'
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const value = JSON.parse(raw) as MailDraft
      if (
        typeof value.subject !== 'string' ||
        typeof value.bodyMarkdown !== 'string' ||
        typeof value.senderEmail !== 'string' ||
        typeof value.signatureRotation !== 'boolean' ||
        ![value.to, value.cc, value.bcc].every(
          (items) => Array.isArray(items) && items.every((item) => typeof item === 'string'),
        ) ||
        !Array.isArray(value.attachmentHandles) ||
        !value.attachmentHandles.every(Number.isSafeInteger) ||
        ![value.templateHandle, value.signatureHandle].every(
          (handle) => handle === null || Number.isSafeInteger(handle),
        )
      )
        throw new Error('Invalid draft')
      draftStatus.value = 'restored'
      return value
    } catch {
      draftStatus.value = 'failed'
      return null
    }
  }

  function saveDraft(draft: MailDraft) {
    if (!key) return
    try {
      localStorage.setItem(key, JSON.stringify(draft))
      draftStatus.value = 'saved'
    } catch {
      draftStatus.value = 'failed'
    }
  }

  function clearDraft(expected?: MailDraft) {
    if (!key) return
    try {
      // A different tab or a newly opened composer may already have saved a newer draft.
      if (expected && localStorage.getItem(key) !== JSON.stringify(expected)) return
      localStorage.removeItem(key)
      draftStatus.value = 'none'
    } catch {
      draftStatus.value = 'failed'
    }
  }

  function detachDraft() {
    key = null
  }
  return { draftStatus, openDraft, saveDraft, clearDraft, detachDraft }
}
