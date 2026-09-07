import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChangeLogDialogStore } from '@/stores/changeLogDialogStore'
import type { OpenTaskSnapshot } from '@/composables/system/useOpenTaskCountEvents'
import type { InboxEntry } from './saplingInbox.utils'

const { markRead, publish, navigate, state } = vi.hoisted(() => ({
  markRead: vi.fn(),
  publish: vi.fn(),
  navigate: vi.fn(),
  state: { snapshot: {} as OpenTaskSnapshot },
}))
vi.mock('@/services/api.current.service', () => ({
  default: { markInboxNotificationRead: markRead },
}))
vi.mock('@/composables/generic/useTranslationLoader', () => ({
  useTranslationLoader: () => ({ isLoading: { value: false } }),
}))
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRouter: () => ({ push: navigate }),
}))
vi.mock('@/composables/system/useSaplingMessageCenter', () => ({
  useSaplingMessageCenter: () => ({}),
}))
vi.mock('@/composables/system/useOpenTaskCountEvents', () => ({
  useOpenTaskCountEvents: (receive: (snapshot: OpenTaskSnapshot) => void) => {
    receive(state.snapshot)
    return { streamError: { value: null } }
  },
  updateOpenTaskSnapshot: publish,
}))
import { useSaplingInbox } from './useSaplingInbox'

describe('inbox read actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    markRead.mockReset()
    publish.mockReset()
    navigate.mockReset()
    state.snapshot = {
      count: 1,
      tickets: [],
      tasks: [],
      salesOpportunities: [],
      effortEstimates: [],
      internalCases: [],
      notifications: [{ handle: 7, title: 'Notice', isRead: false }],
    } as unknown as OpenTaskSnapshot
  })
  it('shares a pending acknowledgement and removes the entry once after success', async () => {
    let finish!: () => void
    markRead.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve
      }),
    )
    const inbox = useSaplingInbox(vi.fn())
    const entry = { notificationHandle: 7 } as InboxEntry
    const first = inbox.dismissEntry(entry)
    const second = inbox.dismissEntry(entry)
    expect(markRead).toHaveBeenCalledTimes(1)
    expect(publish).not.toHaveBeenCalled()
    finish()
    await Promise.all([first, second])
    expect(publish).toHaveBeenCalledTimes(1)
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ count: 0, notifications: [] }))
  })
  it('keeps the notification after failure and allows retry', async () => {
    markRead.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({})
    const inbox = useSaplingInbox(vi.fn())
    const entry = { notificationHandle: 7 } as InboxEntry
    await expect(inbox.dismissEntry(entry)).rejects.toThrow('offline')
    expect(publish).not.toHaveBeenCalled()
    await inbox.dismissEntry(entry)
    expect(markRead).toHaveBeenCalledTimes(2)
    expect(publish).toHaveBeenCalledTimes(1)
  })

  it('exposes the source entity for both populated and scalar notification references', () => {
    state.snapshot.notifications = [
      {
        handle: 1,
        title: 'Ticket',
        entity: { handle: 'ticket' },
        bodyText: 'Plain text',
        bodyMarkdown: '**Plain text**',
      },
      { handle: 2, title: 'Event', entity: 'event' },
    ] as unknown as OpenTaskSnapshot['notifications']
    const inbox = useSaplingInbox(vi.fn())
    expect(inbox.notificationEntries.value.map((entry) => entry.sourceEntity)).toEqual([
      'ticket',
      'event',
    ])
    expect(inbox.notificationEntries.value[0]).toMatchObject({
      description: 'Plain text',
      descriptionMarkdown: '**Plain text**',
    })
  })

  it.each([{ handle: 'ticket' }, 'event'])(
    'opens the referenced record history on demand and keeps the inbox unread and open (%j)',
    (entity) => {
      state.snapshot.notifications = [
        { handle: 7, title: 'Changed', entity, referenceHandle: ' 76 ', isRead: false },
      ] as unknown as OpenTaskSnapshot['notifications']
      const emit = vi.fn()
      const inbox = useSaplingInbox(emit)
      const history = useChangeLogDialogStore()
      const entry = inbox.notificationEntries.value[0]!
      expect(history.dialog).toBe(false)
      inbox.openEntryChangeLog(entry)
      expect(history.dialog).toBe(true)
      expect(history.entityHandle).toBe(typeof entity === 'string' ? entity : entity.handle)
      expect(history.recordHandle).toBe('76')
      history.closeChangeLog()
      expect(inbox.dialog.value).toBe(true)
      expect(inbox.notificationEntries.value).toHaveLength(1)
      expect(markRead).not.toHaveBeenCalled()
      expect(publish).not.toHaveBeenCalled()
      expect(navigate).not.toHaveBeenCalled()
      expect(emit).not.toHaveBeenCalled()
    },
  )

  it.each([
    { entity: 'ticket', referenceHandle: undefined },
    { entity: 'ticket', referenceHandle: '   ' },
    { entity: undefined, referenceHandle: '76' },
  ])('does not fall back to the notification record history for missing targets (%j)', (target) => {
    state.snapshot.notifications = [
      { handle: 7, title: 'Notice', ...target },
    ] as unknown as OpenTaskSnapshot['notifications']
    const inbox = useSaplingInbox(vi.fn())
    inbox.openEntryChangeLog(inbox.notificationEntries.value[0]!)
    expect(useChangeLogDialogStore().dialog).toBe(false)
  })
})
