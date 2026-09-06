import { computed, reactive } from 'vue'
import type { EntityTemplate } from '@/entity/structure'
import { useSaplingMailDialog } from './useSaplingMailDialog'

export type SaplingPhoneDialogContext = {
  phoneNumber: string
  entityHandle?: string
  itemHandle?: string | number
  draftValues?: Record<string, unknown>
  recordLabel?: string
  entityTemplates?: EntityTemplate[]
}

/** Only addresses owned by this record qualify; projected relation addresses do not. */
export function resolvePhoneDialogEmails(context: SaplingPhoneDialogContext | null): string[] {
  const emails = new Map<string, string>()
  for (const template of context?.entityTemplates ?? []) {
    if (!template.options?.includes('isMail') || template.isPersistent === false) continue
    const value = context?.draftValues?.[template.name]
    if (typeof value !== 'string' || !value.trim()) continue
    const email = value.trim()
    if (!emails.has(email.toLowerCase())) emails.set(email.toLowerCase(), email)
  }
  return [...emails.values()]
}

export function resolvePhoneDialogSubject(context: SaplingPhoneDialogContext | null): string {
  return context?.recordLabel?.trim() ?? ''
}

const state = reactive<{
  open: boolean
  context: SaplingPhoneDialogContext | null
}>({
  open: false,
  context: null,
})

export function useSaplingPhoneDialog() {
  const { openMailDialog } = useSaplingMailDialog()
  const emailRecipients = computed(() => resolvePhoneDialogEmails(state.context))

  function composeEmail(email: string) {
    const context = state.context
    if (!context?.entityHandle || !emailRecipients.value.includes(email)) return

    openMailDialog({
      entityHandle: context.entityHandle,
      itemHandle: context.itemHandle,
      draftValues: context.draftValues,
      recordLabel: context.recordLabel,
      initialTo: [email],
    })
  }

  function openPhoneDialog(context: SaplingPhoneDialogContext) {
    state.context = context
    state.open = true
  }

  function closePhoneDialog() {
    state.open = false
    state.context = null
  }

  return {
    state,
    isOpen: computed(() => state.open),
    context: computed(() => state.context),
    openPhoneDialog,
    closePhoneDialog,
    emailRecipients,
    composeEmail,
  }
}
