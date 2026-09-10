import { reactive, shallowReactive } from 'vue'
import { resetSongbirdFormProposals } from '@/composables/system/songbirdFormRegistry'
import type { AiChatSessionItem } from '@/entity/entity'
import type { DashboardWidget } from '@/entity/dashboard-widget.types'
import ApiAiService from '@/services/api.ai.service'
import type { SongbirdWorkspaceState } from './useSongbirdWorkspace'

export type AiWidget = Extract<DashboardWidget, { kind: 'AI' }>
export interface SongbirdWorkspaceEntry {
  key: string
  session?: AiChatSessionItem
  widget?: AiWidget
  dashboardHandle?: number
  state: SongbirdWorkspaceState | null
}

// Controllers live in the authenticated shell, independently of their visible surfaces.
export const songbirdWorkspaces = shallowReactive<Record<string, SongbirdWorkspaceEntry>>({})
export const songbirdSelection = reactive({ key: '', widgetKeys: {} as Record<string, string> })
const pendingWidgets = new Map<string, Promise<string>>()
let generation = 0

export function createSongbirdWorkspace(
  seed: Omit<SongbirdWorkspaceEntry, 'key' | 'state'> = {},
): string {
  const key = crypto.randomUUID()
  songbirdWorkspaces[key] = shallowReactive({ ...seed, key, state: null })
  return key
}

export function selectSongbirdSession(session: AiChatSessionItem): void {
  const existing = Object.values(songbirdWorkspaces).find(
    (entry) => (entry.state?.activeSession?.handle ?? entry.session?.handle) === session.handle,
  )
  songbirdSelection.key = existing?.key ?? createSongbirdWorkspace({ session })
}

export function newSongbirdWorkspace(entry?: SongbirdWorkspaceEntry): void {
  const key = createSongbirdWorkspace(
    entry?.widget
      ? { widget: JSON.parse(JSON.stringify(entry.widget)), dashboardHandle: entry.dashboardHandle }
      : {},
  )
  if (entry?.widget)
    songbirdSelection.widgetKeys[`${entry.dashboardHandle}:${entry.widget.id}`] = key
  if (!entry || songbirdSelection.key === entry.key) songbirdSelection.key = key
}

export async function ensureSongbirdWidget(
  dashboardHandle: number,
  widget: AiWidget,
): Promise<string> {
  const id = `${dashboardHandle}:${widget.id}`
  const existing = songbirdSelection.widgetKeys[id]
  if (existing && songbirdWorkspaces[existing]) {
    // The current run is frozen; this definition is only used by New operation.
    songbirdWorkspaces[existing]!.widget = JSON.parse(JSON.stringify(widget))
    return existing
  }
  const pending = pendingWidgets.get(id)
  if (pending) return pending
  const token = generation
  const request = (async () => {
    const sessions = await ApiAiService.listSessions(false, {
      sourceDashboardHandle: dashboardHandle,
      sourceWidgetId: widget.id,
    })
    if (token !== generation) throw new Error('Songbird principal changed')
    const session = sessions[0]
    const loaded =
      session &&
      Object.values(songbirdWorkspaces).find(
        (item) =>
          item.state?.activeSession?.handle === session.handle ||
          item.session?.handle === session.handle,
      )
    const key =
      loaded?.key ??
      createSongbirdWorkspace({
        widget: JSON.parse(JSON.stringify(widget)),
        dashboardHandle,
        session,
      })
    songbirdWorkspaces[key]!.widget = JSON.parse(JSON.stringify(widget))
    songbirdWorkspaces[key]!.dashboardHandle = dashboardHandle
    songbirdSelection.widgetKeys[id] = key
    return key
  })().finally(() => pendingWidgets.delete(id))
  pendingWidgets.set(id, request)
  return request
}

export function resetSongbirdWorkspaces(): void {
  resetSongbirdFormProposals()
  generation += 1
  for (const key of Object.keys(songbirdWorkspaces)) delete songbirdWorkspaces[key]
  songbirdSelection.key = ''
  songbirdSelection.widgetKeys = {}
  pendingWidgets.clear()
}

export function registerSongbirdWorkspace(key: string, state: SongbirdWorkspaceState | null): void {
  const entry = songbirdWorkspaces[key]
  if (entry) entry.state = state
}

export function unregisterSongbirdWorkspace(key: string, state: SongbirdWorkspaceState): void {
  const entry = songbirdWorkspaces[key]
  if (entry?.state === state) entry.state = null
}
