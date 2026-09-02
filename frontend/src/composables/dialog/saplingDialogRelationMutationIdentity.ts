import type { SaplingGenericItem } from '@/entity/entity'

export function createDialogRelationMutationIdentityTracker(options: {
  buildIdentity: (item: SaplingGenericItem) => string
  onPersistedItem: (item: SaplingGenericItem) => void
}) {
  let recordIdentity: string | null = null
  let skipsRemaining = 0

  function handlePersistedRelationMutation(item: SaplingGenericItem): void {
    recordIdentity = options.buildIdentity(item)
    skipsRemaining = 2
    options.onPersistedItem(item)
  }

  function consumeRelationMutationIdentity(identity: string): boolean {
    if (identity !== recordIdentity) {
      recordIdentity = null
      skipsRemaining = 0
      return false
    }
    skipsRemaining -= 1
    if (skipsRemaining <= 0) recordIdentity = null
    return true
  }

  return { consumeRelationMutationIdentity, handlePersistedRelationMutation }
}
