import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSaplingDialogDraft,
  clearWorkspaceDrafts,
  getWorkspaceDraftKeys,
  readSaplingDialogDraft,
  writeSaplingDialogDraft,
  type SaplingDialogDraftContext,
} from './saplingDialogDraftStorage'

function createContext(overrides: Partial<SaplingDialogDraftContext> = {}) {
  return {
    route: '/table/ticket',
    personHandle: '7',
    entityHandle: 'ticket',
    mode: 'edit',
    recordHandle: '42',
    recordVersion: '2026-09-02T08:00:00.000Z',
    parentEntityHandle: '',
    parentRecordHandle: '',
    detailHandle: '',
    detailVersion: '',
    ...overrides,
  }
}

describe('saplingDialogDraftStorage', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('clears a closed workspace without affecting other users or tabs, even beside corrupt data', () => {
    window.localStorage.setItem('sapling.dialogDrafts.v2.corrupt', '{invalid')
    const first = createContext({ route: '/table/ticket?workspaceTab=one' })
    const otherTab = { ...first, route: '/table/ticket?workspaceTab=two' }
    const otherUser = { ...first, personHandle: '8' }
    for (const context of [first, otherTab, otherUser])
      writeSaplingDialogDraft('edit', context, { title: 'Draft' })
    expect(getWorkspaceDraftKeys('7', 'one')).toHaveLength(1)
    clearWorkspaceDrafts('7', 'one')
    expect(readSaplingDialogDraft('edit', first)).toBeNull()
    expect(readSaplingDialogDraft('edit', otherTab)).toEqual({ title: 'Draft' })
    expect(readSaplingDialogDraft('edit', otherUser)).toEqual({ title: 'Draft' })
  })

  it('restores a draft only for the exact user, route, entity, record, and version context', () => {
    const context = createContext()
    writeSaplingDialogDraft('edit', context, { title: 'Recovered title' })

    expect(readSaplingDialogDraft('edit', context)).toEqual({ title: 'Recovered title' })
    expect(readSaplingDialogDraft('edit', createContext({ route: '/partner/ticket' }))).toBeNull()
    expect(readSaplingDialogDraft('edit', createContext({ personHandle: '8' }))).toBeNull()
    expect(readSaplingDialogDraft('edit', createContext({ recordHandle: '43' }))).toBeNull()
    expect(
      readSaplingDialogDraft('edit', createContext({ recordVersion: '2026-09-02T09:00:00.000Z' })),
    ).toBeNull()
  })

  it('keeps independent drafts for every record and supported dialog surface', () => {
    const firstEdit = createContext({ recordHandle: '1' })
    const latestEdit = createContext({ recordHandle: '2' })
    const information = createContext({ detailHandle: '11' })
    const phoneCall = createContext({ mode: 'create', detailHandle: '+4930123456' })

    writeSaplingDialogDraft('edit', firstEdit, { title: 'First' })
    writeSaplingDialogDraft('edit', latestEdit, { title: 'Latest' })
    writeSaplingDialogDraft('information', information, { content: 'Internal' })
    writeSaplingDialogDraft('phoneCall', phoneCall, { note: 'Called back', reached: true })

    expect(readSaplingDialogDraft('edit', firstEdit)).toEqual({ title: 'First' })
    expect(readSaplingDialogDraft('edit', latestEdit)).toEqual({ title: 'Latest' })
    expect(readSaplingDialogDraft('information', information)).toEqual({ content: 'Internal' })
    expect(readSaplingDialogDraft('phoneCall', phoneCall)).toEqual({
      note: 'Called back',
      reached: true,
    })
  })

  it('isolates the same record by workspace and user and ignores changing table filters', async () => {
    const first = createContext({ route: '/table/ticket?workspaceTab=one&search=first' })
    const second = createContext({ route: '/table/ticket?workspaceTab=two&open=42' })
    const otherUser = { ...first, personHandle: '8' }
    writeSaplingDialogDraft('edit', first, { title: 'First tab draft' })
    writeSaplingDialogDraft('edit', second, { title: 'Second tab draft' })
    writeSaplingDialogDraft('edit', otherUser, { title: 'Other user draft' })
    vi.resetModules()
    const reloaded = await import('./saplingDialogDraftStorage')
    expect(
      reloaded.readSaplingDialogDraft('edit', {
        ...first,
        route: '/table/ticket?open=42&workspaceTab=one&search=changed',
      }),
    ).toEqual({ title: 'First tab draft' })
    expect(reloaded.readSaplingDialogDraft('edit', second)).toEqual({ title: 'Second tab draft' })
    reloaded.clearSaplingDialogDraft('edit', first)
    expect(reloaded.readSaplingDialogDraft('edit', first)).toBeNull()
    expect(reloaded.readSaplingDialogDraft('edit', second)).toEqual({ title: 'Second tab draft' })
    expect(reloaded.readSaplingDialogDraft('edit', otherUser)).toEqual({
      title: 'Other user draft',
    })
  })

  it('keeps unsaved new records separate from existing records and other tabs', () => {
    const first = createContext({
      route: '/table/ticket?workspaceTab=one',
      mode: 'create',
      recordHandle: '',
      recordVersion: '',
    })
    const second = { ...first, route: '/table/ticket?workspaceTab=two' }
    const existing = { ...first, mode: 'edit', recordHandle: '42', recordVersion: 'v1' }
    writeSaplingDialogDraft('edit', first, { title: 'New one' })
    writeSaplingDialogDraft('edit', second, { title: 'New two' })
    writeSaplingDialogDraft('edit', existing, { title: 'Existing' })
    expect(readSaplingDialogDraft('edit', first)).toEqual({ title: 'New one' })
    expect(readSaplingDialogDraft('edit', second)).toEqual({ title: 'New two' })
    expect(readSaplingDialogDraft('edit', existing)).toEqual({ title: 'Existing' })
  })

  it('does not restore outdated values over a newer server version or delete another version', () => {
    const old = createContext()
    const updated = { ...old, recordVersion: 'new-version' }
    writeSaplingDialogDraft('edit', old, { title: 'Old draft' })
    expect(readSaplingDialogDraft('edit', updated)).toBeNull()
    writeSaplingDialogDraft('edit', updated, { title: 'New draft' })
    clearSaplingDialogDraft('edit', old)
    expect(readSaplingDialogDraft('edit', updated)).toEqual({ title: 'New draft' })
    expect(readSaplingDialogDraft('edit', old)).toBeNull()
  })

  it('migrates matching legacy drafts without removing unrelated legacy entries', () => {
    const context = createContext()
    const entry = { context, values: { title: 'Legacy' }, savedAt: '2026-09-10T12:00:00Z' }
    window.localStorage.setItem(
      'sapling.dialogDrafts.v1',
      JSON.stringify({
        version: 1,
        entries: { edit: entry, information: { ...entry, values: { content: 'Keep' } } },
      }),
    )
    expect(readSaplingDialogDraft('edit', context)).toEqual({ title: 'Legacy' })
    expect(
      JSON.parse(window.localStorage.getItem('sapling.dialogDrafts.v1')!).entries.edit,
    ).toBeUndefined()
    expect(readSaplingDialogDraft('information', context)).toEqual({ content: 'Keep' })
    expect(window.localStorage.getItem('sapling.dialogDrafts.v1')).toBeNull()
    expect(readSaplingDialogDraft('edit', context)).toEqual({ title: 'Legacy' })
  })

  it('preserves a legacy draft if migration cannot write to storage', () => {
    const context = createContext()
    const legacy = JSON.stringify({
      version: 1,
      entries: { edit: { context, values: { title: 'Keep' }, savedAt: '2026-09-10T12:00:00Z' } },
    })
    window.localStorage.setItem('sapling.dialogDrafts.v1', legacy)
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded')
    })
    expect(readSaplingDialogDraft('edit', context)).toEqual({ title: 'Keep' })
    expect(window.localStorage.getItem('sapling.dialogDrafts.v1')).toBe(legacy)
  })

  it('clears only the draft whose context was deliberately discarded', () => {
    const storedContext = createContext()
    writeSaplingDialogDraft('edit', storedContext, { title: 'Keep until discarded' })

    clearSaplingDialogDraft('edit', createContext({ recordHandle: '99' }))
    expect(readSaplingDialogDraft('edit', storedContext)).not.toBeNull()

    clearSaplingDialogDraft('edit', storedContext)
    expect(readSaplingDialogDraft('edit', storedContext)).toBeNull()
  })
})
