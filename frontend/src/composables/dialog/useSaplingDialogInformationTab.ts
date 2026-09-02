import { ref } from 'vue'

export interface SaplingDialogInformationTabHandle {
  discardChanges: () => void
  save: () => Promise<boolean>
}

export function useSaplingDialogInformationTab() {
  const informationTabRef = ref<SaplingDialogInformationTabHandle | null>(null)
  const informationDirty = ref(false)

  function handleInformationDirtyUpdate(dirty: boolean): void {
    informationDirty.value = dirty
  }

  async function persistInformationChanges(): Promise<boolean> {
    if (!informationDirty.value) return true
    return (await informationTabRef.value?.save()) ?? false
  }

  function resetInformationChanges(): void {
    informationTabRef.value?.discardChanges()
    informationDirty.value = false
  }

  return {
    informationTabRef,
    informationDirty,
    handleInformationDirtyUpdate,
    persistInformationChanges,
    resetInformationChanges,
  }
}
