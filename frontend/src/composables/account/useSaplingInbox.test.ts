import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OpenTaskSnapshot } from '@/composables/system/useOpenTaskCountEvents'
import type { InboxEntry } from './saplingInbox.utils'

const { markRead, publish, state } = vi.hoisted(() => ({
  markRead: vi.fn(),
  publish: vi.fn(),
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
  useRouter: () => ({ push: vi.fn() }),
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
    markRead.mockReset()
    publish.mockReset()
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
})
