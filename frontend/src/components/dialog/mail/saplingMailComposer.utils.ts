import type { MailRecipientOption, MailSenderOption } from './SaplingDialogMail.types'

export type MailRecipientField = 'to' | 'cc' | 'bcc'

export type MailMentionMatch = {
  from: number
  to: number
  query: string
}

export type MailRecipientLists = {
  to: string[]
  cc: string[]
  bcc: string[]
}

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

export function findMailRecipientMention(
  value: string,
  selection: { from: number; to: number },
): MailMentionMatch | null {
  if (selection.from !== selection.to) return null

  const cursor = clampMailSelection(selection.from, value.length)
  const prefix = value.slice(0, cursor)
  const match = /(^|[\s([{>])@([^\n\r@,;:!?()[\]{}<>]{0,80})$/.exec(prefix)
  if (!match) return null

  const query = match[2] ?? ''
  return {
    from: cursor - query.length - 1,
    to: cursor,
    query: query.trim(),
  }
}

export function filterMailMentionRecipients(
  options: MailRecipientOption[],
  query: string,
  limit = 8,
): MailRecipientOption[] {
  const terms = normalizeMentionSearchText(query).split(/\s+/).filter(Boolean)
  return options
    .filter((option) => {
      const haystack = normalizeMentionSearchText(
        [option.name, option.email, option.companyName, option.departmentName].join(' '),
      )
      return terms.every((term) => haystack.includes(term))
    })
    .slice(0, limit)
}

export function assignMailMentionRecipient(
  recipients: MailRecipientLists,
  field: MailRecipientField,
  email: string,
): MailRecipientLists {
  const normalizedEmail = email.trim()
  const key = normalizedEmail.toLocaleLowerCase()
  const next: MailRecipientLists = {
    to: removeRecipient(recipients.to, key),
    cc: removeRecipient(recipients.cc, key),
    bcc: removeRecipient(recipients.bcc, key),
  }

  if (normalizedEmail) next[field].push(normalizedEmail)
  return next
}

function removeRecipient(recipients: string[], excludedKey: string): string[] {
  const distinct = new Map<string, string>()
  for (const recipient of recipients) {
    const value = recipient.trim()
    const key = value.toLocaleLowerCase()
    if (value && key !== excludedKey && !distinct.has(key)) distinct.set(key, value)
  }
  return [...distinct.values()]
}

function normalizeMentionSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim()
}
