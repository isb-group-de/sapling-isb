import type { AiChatMessageItem } from '@/entity/entity'
import type { SongbirdFormProposal } from '@/composables/system/songbirdForm.types'
export function getSongbirdFormProposals(message: AiChatMessageItem): SongbirdFormProposal[] {
  const payload = message.responsePayload as Record<string, unknown> | null
  if (message.role !== 'assistant' || !Array.isArray(payload?.formProposals)) return []
  return payload.formProposals.filter((value): value is SongbirdFormProposal => {
    if (!value || typeof value !== 'object') return false
    const proposal = value as Record<string, unknown>
    return (
      typeof proposal.id === 'string' &&
      typeof proposal.formId === 'string' &&
      typeof proposal.snapshotId === 'string' &&
      typeof proposal.entityHandle === 'string' &&
      (proposal.recordHandle === null || typeof proposal.recordHandle === 'string') &&
      Array.isArray(proposal.fields) &&
      proposal.fields.every(
        (field) =>
          field &&
          typeof field.name === 'string' &&
          typeof field.label === 'string' &&
          Object.prototype.hasOwnProperty.call(field, 'value'),
      )
    )
  })
}
