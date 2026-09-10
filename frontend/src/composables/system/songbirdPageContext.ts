import { computed, onUnmounted, shallowReactive, watch } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { useWorkspaceTab } from './workspaceTabContext'

export interface SongbirdPageContext {
  entityHandle: string | null
  recordHandle: string | null
  label: string
  fullPath?: string
  formId?: string
}
const dialogs = shallowReactive(new Map<symbol, SongbirdPageContext>())
const openDialogs = shallowReactive(new Set<symbol>())
const globalDialogs = shallowReactive(new Set<symbol>())
export const hasSongbirdRecordDialog = computed(() => openDialogs.size > 0)
export const hasSongbirdGlobalRecordDialog = computed(() => globalDialogs.size > 0)
export function useSongbirdRecordContext(
  getContext: () => SongbirdPageContext | null,
  isOpen: () => boolean = () => getContext() !== null,
) {
  const key = Symbol('record-dialog')
  const tab = useWorkspaceTab()
  // Saved record labels remain available to the tab strip while its pane is hidden.
  watch(getContext, (context) => tab?.setRecordLabel(key, context), { immediate: true, deep: true })
  watch(
    () => isOpen() && (tab?.active ?? true),
    (open) => {
      if (open) openDialogs.add(key)
      else openDialogs.delete(key)
      if (open && !tab) globalDialogs.add(key)
      else globalDialogs.delete(key)
    },
    { immediate: true },
  )
  watch(
    () => (tab?.active === false ? null : getContext()),
    (context) => {
      if (context) dialogs.set(key, context)
      else dialogs.delete(key)
    },
    { immediate: true, deep: true },
  )
  onUnmounted(() => {
    tab?.setRecordLabel(key, null)
    dialogs.delete(key)
    openDialogs.delete(key)
    globalDialogs.delete(key)
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
