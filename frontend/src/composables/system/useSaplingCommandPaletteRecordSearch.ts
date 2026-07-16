import { ref, type Ref } from 'vue'
import type { EntityItem } from '@/entity/entity'
import ApiSearchService, { type GlobalSearchResultItem } from '@/services/api.search.service'

const DEBOUNCE_MS = 250
const RESULT_LIMIT = 10
export const COMMAND_PALETTE_RECORD_SEARCH_MIN_LENGTH = 2

export function useSaplingCommandPaletteRecordSearch(
  entities: Ref<EntityItem[]>,
  getEntityLabel: (entity: EntityItem) => string,
) {
  const recordResults = ref<GlobalSearchResultItem[]>([])
  const isRecordSearchLoading = ref(false)
  let timeout: ReturnType<typeof setTimeout> | null = null
  let controller: AbortController | null = null
  let requestId = 0

  function cancelRecordSearch(): void {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
    controller?.abort()
    controller = null
    isRecordSearchLoading.value = false
  }

  function scheduleRecordSearch(rawQuery: string): void {
    if (timeout) clearTimeout(timeout)
    const scope = getRecordSearchScope(rawQuery)
    if (!scope) {
      controller?.abort()
      controller = null
      recordResults.value = []
      isRecordSearchLoading.value = false
      return
    }

    timeout = setTimeout(() => {
      timeout = null
      void runRecordSearch(scope)
    }, DEBOUNCE_MS)
  }

  function getRecordSearchScope(
    rawQuery: string,
  ): { query: string; entityHandles?: string[] } | null {
    const value = rawQuery.trim()
    if (value.length < COMMAND_PALETTE_RECORD_SEARCH_MIN_LENGTH || value.endsWith(':')) return null

    const colonIndex = value.indexOf(':')
    if (colonIndex > 1 && colonIndex < value.length - 1) {
      const entityPart = value.slice(0, colonIndex).trim().toLowerCase()
      const query = value.slice(colonIndex + 1).trim()
      if (query.length < COMMAND_PALETTE_RECORD_SEARCH_MIN_LENGTH) return null

      const matchingEntities = entities.value.filter(
        (entity) =>
          entity.handle.toLowerCase().startsWith(entityPart) ||
          getEntityLabel(entity).toLowerCase().startsWith(entityPart),
      )
      if (matchingEntities.length === 0) return null
      return { query, entityHandles: matchingEntities.map((entity) => entity.handle) }
    }

    return { query: value }
  }

  async function runRecordSearch(scope: {
    query: string
    entityHandles?: string[]
  }): Promise<void> {
    controller?.abort()
    const nextController = new AbortController()
    controller = nextController
    isRecordSearchLoading.value = true
    const nextRequestId = ++requestId

    try {
      const response = await ApiSearchService.global(scope.query, {
        limit: RESULT_LIMIT,
        entityHandles: scope.entityHandles,
        signal: nextController.signal,
      })
      if (nextRequestId === requestId && controller === nextController) {
        recordResults.value = response.items ?? []
      }
    } catch (error) {
      if (!isRequestCanceled(error) && nextRequestId === requestId) recordResults.value = []
    } finally {
      if (controller === nextController) {
        controller = null
        isRecordSearchLoading.value = false
      }
    }
  }

  return { recordResults, isRecordSearchLoading, cancelRecordSearch, scheduleRecordSearch }
}

function isRequestCanceled(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: string; name?: string }
  return candidate.code === 'ERR_CANCELED' || candidate.name === 'CanceledError'
}
