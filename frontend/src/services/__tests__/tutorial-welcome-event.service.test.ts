import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventItem, PersonItem } from '@/entity/entity'
import ApiGenericService from '@/services/api.generic.service'
import { ensureTutorialWelcomeEvent } from '@/services/tutorial-welcome-event.service'

vi.mock('@/services/api.generic.service', () => ({
  default: {
    find: vi.fn(),
    create: vi.fn(),
  },
}))

const person = {
  handle: 7,
  company: { handle: 11 },
} as PersonItem

describe('tutorial welcome event service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-13T10:30:00+02:00'))
  })

  it('reuses an existing tutorial event for the current participant and day', async () => {
    const existing = { handle: 42 } as EventItem
    vi.mocked(ApiGenericService.find).mockResolvedValue({
      data: [existing],
      meta: { page: 1, limit: 1, total: 1, totalPages: 1, executionTime: 0 },
    })

    await expect(
      ensureTutorialWelcomeEvent(person, { title: 'Willkommen', description: 'Beschreibung' }),
    ).resolves.toBe(existing)
    expect(ApiGenericService.create).not.toHaveBeenCalled()
  })

  it('creates an all-day internal event whose participant receives the normal inbox lifecycle', async () => {
    vi.mocked(ApiGenericService.find).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 1, total: 0, totalPages: 0, executionTime: 0 },
    })
    vi.mocked(ApiGenericService.create).mockResolvedValue({ handle: 43 } as EventItem)

    await ensureTutorialWelcomeEvent(person, {
      title: 'Willkommen bei Sapling',
      description: 'Tutorial-Termin',
    })

    expect(ApiGenericService.create).toHaveBeenCalledWith(
      'event',
      expect.objectContaining({
        title: 'Willkommen bei Sapling',
        isAllDay: true,
        status: 'scheduled',
        category: 'internal',
        creatorPerson: 7,
        creatorCompany: 11,
        participants: [7],
      }),
    )
    const payload = vi.mocked(ApiGenericService.create).mock.calls[0]?.[1] as Partial<EventItem>
    expect(payload.description).toBe('Tutorial-Termin')
    expect(payload.description).not.toContain('sapling:tutorial')
  })

  it('does not create an event before translated content is available', async () => {
    await expect(
      ensureTutorialWelcomeEvent(person, { title: '', description: '' }),
    ).resolves.toBeNull()

    expect(ApiGenericService.find).not.toHaveBeenCalled()
    expect(ApiGenericService.create).not.toHaveBeenCalled()
  })
})
