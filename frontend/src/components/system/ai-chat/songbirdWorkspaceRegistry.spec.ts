import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiChatSessionItem } from '@/entity/entity'
import {
  createSongbirdWorkspace,
  ensureSongbirdWidget,
  newSongbirdWorkspace,
  resetSongbirdWorkspaces,
  selectSongbirdSession,
  songbirdSelection,
  songbirdWorkspaces,
  type AiWidget,
} from './songbirdWorkspaceRegistry'

const api = vi.hoisted(() => ({ listSessions: vi.fn() }))
vi.mock('@/services/api.ai.service', () => ({ default: api }))
const widget: AiWidget = {
  id: 'customers',
  title: 'Customer assistant',
  columns: 2,
  rows: 4,
  kind: 'AI',
  config: { instruction: 'Prepare a customer' },
}
describe('Songbird workspace ownership', () => {
  beforeEach(() => {
    resetSongbirdWorkspaces()
    vi.clearAllMocks()
    api.listSessions.mockResolvedValue([])
  })
  it('shares one controller when opening a widget conversation in the panel', async () => {
    const session = {
      handle: 42,
      title: 'Customer',
      sourceWidgetId: widget.id,
    } as AiChatSessionItem
    api.listSessions.mockResolvedValue([session])
    const key = await ensureSongbirdWidget(7, widget)
    selectSongbirdSession(session)
    expect(songbirdSelection.key).toBe(key)
    expect(Object.keys(songbirdWorkspaces)).toHaveLength(1)
    expect(api.listSessions).toHaveBeenCalledWith(false, {
      sourceDashboardHandle: 7,
      sourceWidgetId: widget.id,
    })
  })
  it('coalesces restoration and isolates widgets in different dashboards', async () => {
    const [a, b] = await Promise.all([
      ensureSongbirdWidget(7, widget),
      ensureSongbirdWidget(7, widget),
    ])
    expect(a).toBe(b)
    expect(api.listSessions).toHaveBeenCalledTimes(1)
    expect(await ensureSongbirdWidget(8, widget)).not.toBe(a)
  })
  it('starts a fresh operation without deleting the previous controller', async () => {
    const key = await ensureSongbirdWidget(7, widget)
    const previous = songbirdWorkspaces[key]!
    await ensureSongbirdWidget(7, { ...widget, config: { instruction: 'Updated task' } })
    newSongbirdWorkspace(previous)
    const next = songbirdWorkspaces[songbirdSelection.widgetKeys['7:customers']!]!
    expect(next.key).not.toBe(key)
    expect(next.session).toBeUndefined()
    expect(next.widget?.config.instruction).toBe('Updated task')
    expect(songbirdWorkspaces[key]).toBe(previous)
  })
  it('discards a pending restoration when the principal changes', async () => {
    let resolve!: (value: AiChatSessionItem[]) => void
    api.listSessions.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r
        }),
    )
    const request = ensureSongbirdWidget(7, widget)
    resetSongbirdWorkspaces()
    resolve([])
    await expect(request).rejects.toThrow('principal changed')
    expect(Object.keys(songbirdWorkspaces)).toHaveLength(0)
  })
  it('retains drafts when switching to another controller', () => {
    const a = createSongbirdWorkspace()
    const b = createSongbirdWorkspace()
    songbirdSelection.key = b
    expect(songbirdWorkspaces[a]).toBeDefined()
    expect(songbirdWorkspaces[b]).toBeDefined()
  })
})
