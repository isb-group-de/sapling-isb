import type { MailRecipientOption, MailSenderOption } from './SaplingDialogMail.types'

export function normalizeMailRecipients(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .flatMap((entry) => readMailRecipientValue(entry).split(/[;,]/))
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry, index, array) => array.indexOf(entry) === index)
}

export function buildMailSenderTitle(option: MailSenderOption): string {
  const displayName = option.displayName?.trim()
  return displayName && displayName !== option.email
    ? `${displayName} <${option.email}>`
    : option.email
}

export function getMailRecipientCompanyKey(option: MailRecipientOption | undefined): string {
  if (!option) return ''
  return option.companyHandle == null
    ? option.companyName.trim().toLocaleLowerCase()
    : String(option.companyHandle).trim()
}

export function readMailRecipientValue(value: unknown, seen = new Set<object>()): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (!value || typeof value !== 'object' || seen.has(value)) return ''
  seen.add(value)
  const option = value as { value?: unknown; email?: unknown; raw?: unknown }
  for (const candidate of [option.value, option.email, option.raw]) {
    const recipient = readMailRecipientValue(candidate, seen).trim()
    if (recipient) return recipient
  }
  return ''
}

export function clampMailSelection(value: number, max: number): number {
  return Math.max(0, Math.min(value, max))
}
