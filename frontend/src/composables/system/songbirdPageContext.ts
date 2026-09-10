import { computed, onUnmounted, shallowReactive, watch } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

export interface SongbirdPageContext {
  entityHandle: string | null
  recordHandle: string | null
  label: string
  fullPath?: string
  formId?: string
}
const dialogs = shallowReactive(new Map<symbol, SongbirdPageContext>())
const openDialogs = shallowReactive(new Set<symbol>())
export const hasSongbirdRecordDialog = computed(() => openDialogs.size > 0)
export function useSongbirdRecordContext(
  getContext: () => SongbirdPageContext | null,
  isOpen: () => boolean = () => getContext() !== null,
) {
  const key = Symbol('record-dialog')
  watch(
    isOpen,
    (open) => {
      if (open) openDialogs.add(key)
      else openDialogs.delete(key)
    },
    { immediate: true },
  )
  watch(
    getContext,
    (context) => {
      if (context) dialogs.set(key, context)
      else dialogs.delete(key)
    },
    { immediate: true, deep: true },
  )
  onUnmounted(() => {
    dialogs.delete(key)
    openDialogs.delete(key)
  })
}
export function useSongbirdPageContext(route: RouteLocationNormalizedLoaded) {
  return computed<SongbirdPageContext>(() => {
    const values = [...dialogs.values()]
    const dialog = values[values.length - 1]
    if (dialog) return { ...dialog, fullPath: route.fullPath }
    const entity = typeof route.params.entity === 'string' ? route.params.entity : null
    return {
      entityHandle: entity,
      recordHandle: null,
      label: entity ?? String(route.name ?? route.path),
      fullPath: route.fullPath,
    }
  })
}
