import { computed, getCurrentScope, onScopeDispose, ref } from 'vue'
import type { MailPreviewResult } from '@/services/api.mail.service'

export type MailSendIssue = { key: string; detail?: string; blocking?: boolean }

export function inspectMail(preview: MailPreviewResult): MailSendIssue[] {
  const issues: MailSendIssue[] = []
  const recipients = [...preview.to, ...preview.cc, ...preview.bcc]
  if (!preview.to.length) issues.push({ key: 'mail.checkRecipients', blocking: true })
  if (recipients.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) {
    issues.push({ key: 'mail.checkInvalidRecipients', blocking: true })
  }
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const email of recipients) {
    const normalized = email.trim().toLowerCase()
    if (seen.has(normalized)) duplicates.add(normalized)
    seen.add(normalized)
  }
  if (duplicates.size)
    issues.push({ key: 'mail.checkDuplicates', detail: [...duplicates].join(', '), blocking: true })
  if (!preview.subject.trim()) issues.push({ key: 'mail.checkSubject' })
  const missing = preview.unresolvedPlaceholders ?? []
  if (missing.length) issues.push({ key: 'mail.checkPlaceholders', detail: missing.join(', ') })
  if (
    !preview.attachmentHandles?.length &&
    /\b(anhang|anbei|beigefügt|angehängt|attachment|attached|enclosed)\b/i.test(
      preview.bodyMarkdown,
    )
  ) {
    issues.push({ key: 'mail.checkAttachments' })
  }
  return issues
}

export function useMailSendGuard() {
  const remainingSeconds = ref(0)
  const isHolding = computed(() => remainingSeconds.value > 0)
  const sendIssues = ref<MailSendIssue[]>([])
  let timer: ReturnType<typeof setInterval> | undefined
  let pendingSend: (() => Promise<void>) | undefined

  function cancelPendingSend() {
    if (timer) clearInterval(timer)
    timer = undefined
    pendingSend = undefined
    remainingSeconds.value = 0
    sendIssues.value = []
  }

  function sendPendingNow() {
    const send = pendingSend
    cancelPendingSend()
    if (send) void send()
  }

  function holdSend(send: () => Promise<void>) {
    cancelPendingSend()
    pendingSend = send
    const deadline = Date.now() + 10_000
    remainingSeconds.value = 10
    timer = setInterval(() => {
      remainingSeconds.value = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      if (remainingSeconds.value === 0) {
        sendPendingNow()
      }
    }, 250)
  }

  if (getCurrentScope()) {
    window.addEventListener('pagehide', cancelPendingSend)
    onScopeDispose(() => {
      cancelPendingSend()
      window.removeEventListener('pagehide', cancelPendingSend)
    })
  }
  return { remainingSeconds, isHolding, sendIssues, holdSend, cancelPendingSend, sendPendingNow }
}
