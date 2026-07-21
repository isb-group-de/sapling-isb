import type { AiChatSessionItem } from '@/entity/entity'

type RuntimeReference =
  AiChatSessionItem['agent'] | AiChatSessionItem['provider'] | AiChatSessionItem['model']

export function formatSessionRuntimeSummary(session: AiChatSessionItem): string {
  return [session.agent, session.provider, session.model]
    .map(getRuntimeReferenceLabel)
    .filter((part) => part.length > 0)
    .join(' / ')
}

function getRuntimeReferenceLabel(reference: RuntimeReference): string {
  if (!reference) {
    return ''
  }

  if (typeof reference === 'string') {
    return reference
  }

  return reference.title?.trim() || String(reference.handle ?? '')
}
