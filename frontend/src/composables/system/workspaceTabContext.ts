import { getCurrentInstance, inject, onUnmounted, watch, type InjectionKey } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

export interface WorkspaceTabContext {
  id: string
  readonly active: boolean
  readonly fullPath: string
  readonly route: RouteLocationNormalizedLoaded
  state: Map<string, unknown>
  replaceUrl: (path: string) => void
  setDirty: (key: symbol, dirty: boolean) => void
  setRecordLabel: (key: symbol, record: WorkspaceRecordLabel | null) => void
  setPageLabel: (key: symbol, label: string | null) => void
  setDraftCleanup: (key: symbol, cleanup: (() => void) | null) => void
}

export interface WorkspaceRecordLabel {
  entityHandle: string | null
  recordHandle: string | null
  label: string
}

export const workspaceTabKey: InjectionKey<WorkspaceTabContext> = Symbol('workspace-tab')

export function useWorkspaceTab() {
  return getCurrentInstance() ? inject(workspaceTabKey, null) : null
}

/** Keeps a view's current selection visible in its application tab, including while hidden. */
export function useWorkspaceLabel(getLabel: () => string | null | undefined) {
  const tab = useWorkspaceTab()
  if (!tab) return
  const key = Symbol('workspace-page-label')
  watch(getLabel, (label) => tab.setPageLabel(key, label?.trim() || null), { immediate: true })
  onUnmounted(() => tab.setPageLabel(key, null))
}

/** Discard drafts only when a user closes the tab, not when a reload unmounts it. */
export function useWorkspaceDraftCleanup(cleanup: () => void) {
  const tab = useWorkspaceTab()
  if (!tab) return
  const key = Symbol('workspace-draft-cleanup')
  tab.setDraftCleanup(key, cleanup)
  onUnmounted(() => tab.setDraftCleanup(key, null))
}

/** Editors keep their own drafts; the shell only receives an unsaved-change flag. */
export function useWorkspaceDirty(getDirty: () => boolean) {
  const tab = useWorkspaceTab()
  const key = Symbol('workspace-editor')
  if (!tab) return
  watch(getDirty, (dirty) => tab.setDirty(key, dirty), { immediate: true })
  onUnmounted(() => tab.setDirty(key, false))
}
