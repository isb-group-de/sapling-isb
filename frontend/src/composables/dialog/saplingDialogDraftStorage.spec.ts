import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearSaplingDialogDraft,
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

  it('keeps at most one latest draft for each supported dialog surface', () => {
    const firstEdit = createContext({ recordHandle: '1' })
    const latestEdit = createContext({ recordHandle: '2' })
    const information = createContext({ detailHandle: '11' })
    const phoneCall = createContext({ mode: 'create', detailHandle: '+4930123456' })

    writeSaplingDialogDraft('edit', firstEdit, { title: 'First' })
    writeSaplingDialogDraft('edit', latestEdit, { title: 'Latest' })
    writeSaplingDialogDraft('information', information, { content: 'Internal' })
    writeSaplingDialogDraft('phoneCall', phoneCall, { note: 'Called back', reached: true })

    expect(readSaplingDialogDraft('edit', firstEdit)).toBeNull()
    expect(readSaplingDialogDraft('edit', latestEdit)).toEqual({ title: 'Latest' })
    expect(readSaplingDialogDraft('information', information)).toEqual({ content: 'Internal' })
    expect(readSaplingDialogDraft('phoneCall', phoneCall)).toEqual({
      note: 'Called back',
      reached: true,
    })
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
