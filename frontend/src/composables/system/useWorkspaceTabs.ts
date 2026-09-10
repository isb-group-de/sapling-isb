import { onUnmounted, ref, shallowReactive, watch } from 'vue'
import type { RouteLocationNormalizedLoaded, RouteLocationResolved, Router } from 'vue-router'
import type { WorkspaceRecordLabel } from './workspaceTabContext'
import {
  clearWorkspaceDrafts,
  getWorkspaceDraftKeys,
} from '@/composables/dialog/saplingDialogDraftStorage'

export function workspaceRoute(route: RouteLocationResolved): RouteLocationNormalizedLoaded {
  return { ...route, name: route.name ?? undefined } as RouteLocationNormalizedLoaded
}

export const WORKSPACE_TAB_QUERY = 'workspaceTab'
export interface WorkspaceTab {
  id: string
  route: RouteLocationNormalizedLoaded
  visited: boolean
  dirty: Set<symbol>
  recordLabels: Map<symbol, WorkspaceRecordLabel>
  pageLabels: Map<symbol, string>
  draftCleanups: Map<symbol, () => void>
}

function identity(route: RouteLocationNormalizedLoaded): string {
  return `${route.path}?open=${String(route.query.open ?? '')}`
}

/** Every mounted pane owns a route snapshot, including two panes of the same entity. */
export function useWorkspaceTabs(router: Router, getPrincipal: () => string) {
  const tabs = shallowReactive<WorkspaceTab[]>([])
  const activeId = ref('')
  let storageKey = ''

  function create(route: RouteLocationNormalizedLoaded, id: string = crypto.randomUUID()) {
    const tab = shallowReactive<WorkspaceTab>({
      id,
      route,
      visited: false,
      dirty: shallowReactive(new Set<symbol>()),
      recordLabels: shallowReactive(new Map<symbol, WorkspaceRecordLabel>()),
      pageLabels: shallowReactive(new Map<symbol, string>()),
      draftCleanups: new Map<symbol, () => void>(),
    })
    tabs.push(tab)
    return tab
  }

  function target(tab: WorkspaceTab) {
    return {
      path: tab.route.path,
      query: { ...tab.route.query, [WORKSPACE_TAB_QUERY]: tab.id },
      hash: tab.route.hash,
    }
  }

  function persist() {
    if (!storageKey) return
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify(tabs.map((tab) => router.resolve(target(tab)).fullPath)),
      )
    } catch {
      // Storage may be disabled. The in-memory workspace remains fully usable.
    }
  }

  function accept(route: RouteLocationNormalizedLoaded) {
    if (route.matched.some((record) => record.meta.public) || route.path === '/access-pending')
      return
    const requestedId = route.query[WORKSPACE_TAB_QUERY]
    let tab =
      typeof requestedId === 'string' ? tabs.find((item) => item.id === requestedId) : undefined
    // Never reuse a mounted view for a different route: that would destroy its draft.
    if (tab && tab.route.path !== route.path) tab = undefined
    if (!tab && !requestedId) tab = tabs.find((item) => identity(item.route) === identity(route))
    if (!tab)
      tab = create(
        route,
        typeof requestedId === 'string' &&
          /^[\w-]{1,80}$/.test(requestedId) &&
          !tabs.some((item) => item.id === requestedId)
          ? requestedId
          : undefined,
      )
    // A menu link reactivates the existing worklist, preserving filters and editors.
    if (!requestedId && tab.visited && Object.keys(route.query).length === 0) {
      activeId.value = tab.id
      void router.replace(target(tab))
      return
    }
    tab.route = route
    tab.visited = true
    activeId.value = tab.id
    persist()
    if (requestedId !== tab.id) void router.replace(target(tab))
  }

  function activate(tab: WorkspaceTab) {
    return router.push(target(tab))
  }

  function updateRoute(tab: WorkspaceTab, route: RouteLocationNormalizedLoaded) {
    tab.route = route
    persist()
  }

  function duplicate() {
    const active = tabs.find((tab) => tab.id === activeId.value)
    if (!active) return
    return router.push({
      ...target(active),
      query: { ...active.route.query, [WORKSPACE_TAB_QUERY]: crypto.randomUUID() },
    })
  }

  async function close(tab: WorkspaceTab, confirmDiscard: () => boolean) {
    const personHandle = getPrincipal().split(':')[0] ?? ''
    const hasStoredDraft = getWorkspaceDraftKeys(personHandle, tab.id).length > 0
    if ((tab.dirty.size || hasStoredDraft) && !confirmDiscard()) return
    if (tab.id === activeId.value) {
      const index = tabs.indexOf(tab)
      const next = tabs[index + 1] ?? tabs[index - 1]
      const failure = await (next
        ? activate(next)
        : router.push({ path: '/', query: { [WORKSPACE_TAB_QUERY]: crypto.randomUUID() } }))
      if (failure) return
    }
    const index = tabs.indexOf(tab)
    for (const cleanup of tab.draftCleanups.values()) cleanup()
    clearWorkspaceDrafts(personHandle, tab.id)
    if (index >= 0) tabs.splice(index, 1)
    persist()
  }

  watch(
    getPrincipal,
    (principal, previousPrincipal) => {
      tabs.splice(0)
      activeId.value = ''
      storageKey = principal ? `sapling.workspace-tabs.v1.${principal}` : ''
      if (storageKey) {
        try {
          const paths: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]')
          if (Array.isArray(paths))
            for (const path of paths.slice(0, 30)) {
              if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//'))
                continue
              const route = router.resolve(path)
              const id = route.query[WORKSPACE_TAB_QUERY]
              if (
                !route.matched.length ||
                route.matched.some((record) => record.meta.public) ||
                route.path === '/access-pending' ||
                route.name === 'NotFound'
              )
                continue
              if (
                typeof id === 'string' &&
                /^[\w-]{1,80}$/.test(id) &&
                !tabs.some((tab) => tab.id === id)
              )
                create(workspaceRoute(route), id)
            }
        } catch {
          // A stale session must never prevent the current deep link from opening.
        }
      }
      if (previousPrincipal !== undefined && previousPrincipal !== principal) {
        const current = router.currentRoute.value
        const fresh = workspaceRoute(
          router.resolve({
            path: current.path,
            query: { ...current.query, [WORKSPACE_TAB_QUERY]: crypto.randomUUID() },
            hash: current.hash,
          }),
        )
        accept(fresh)
        void router.replace(fresh.fullPath)
      } else accept(router.currentRoute.value)
    },
    { immediate: true },
  )
  watch(router.currentRoute, accept)

  function beforeUnload(event: BeforeUnloadEvent) {
    if (!tabs.some((tab) => tab.dirty.size)) return
    event.preventDefault()
    event.returnValue = ''
  }
  window.addEventListener('beforeunload', beforeUnload)
  onUnmounted(() => window.removeEventListener('beforeunload', beforeUnload))

  return { tabs, activeId, activate, duplicate, close, updateRoute }
}
