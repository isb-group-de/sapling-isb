import { computed, ref } from 'vue'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'

const isSaplingSearchIndexRebuildOpen = ref(false)

export function useSaplingSearchIndexRebuild() {
  const currentPersonStore = useCurrentPersonStore()

  const hasSaplingSearchIndexRebuildAccess = computed(
    () =>
      currentPersonStore.person?.roles?.some((role) => {
        if (!role || typeof role === 'string') {
          return false
        }

        return role.isAdministrator === true
      }) ?? false,
  )

  async function ensureSaplingSearchIndexRebuildAccess() {
    await currentPersonStore.fetchCurrentPerson()

    if (!hasSaplingSearchIndexRebuildAccess.value) {
      isSaplingSearchIndexRebuildOpen.value = false
    }

    return hasSaplingSearchIndexRebuildAccess.value
  }

  async function openSaplingSearchIndexRebuild() {
    if (!(await ensureSaplingSearchIndexRebuildAccess())) {
      return false
    }

    isSaplingSearchIndexRebuildOpen.value = true
    return true
  }

  function closeSaplingSearchIndexRebuild() {
    isSaplingSearchIndexRebuildOpen.value = false
  }

  return {
    isOpen: isSaplingSearchIndexRebuildOpen,
    hasAccess: hasSaplingSearchIndexRebuildAccess,
    openSaplingSearchIndexRebuild,
    closeSaplingSearchIndexRebuild,
  }
}
