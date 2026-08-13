import type { EventItem, PersonItem } from '@/entity/entity'
import ApiGenericService from '@/services/api.generic.service'

const pendingEvents = new Map<string, Promise<EventItem | null>>()

export type TutorialWelcomeEventContent = {
  title: string
  description: string
}

export function ensureTutorialWelcomeEvent(
  person: PersonItem,
  content: TutorialWelcomeEventContent,
): Promise<EventItem | null> {
  const title = content.title.trim()
  const description = content.description.trim()
  if (!title || !description) {
    return Promise.resolve(null)
  }

  const personHandle = person.handle
  const companyHandle = person.company?.handle
  if (typeof personHandle !== 'number' || typeof companyHandle !== 'number') {
    return Promise.resolve(null)
  }

  const dayStart = startOfLocalDay(new Date())
  const dayEndExclusive = new Date(dayStart)
  dayEndExclusive.setDate(dayEndExclusive.getDate() + 1)
  const requestKey = `${personHandle}:${dayStart.toISOString()}`
  const pendingEvent = pendingEvents.get(requestKey)
  if (pendingEvent) {
    return pendingEvent
  }

  const request = findOrCreateTutorialEvent(
    personHandle,
    companyHandle,
    dayStart,
    dayEndExclusive,
    {
      title,
      description,
    },
  ).finally(() => pendingEvents.delete(requestKey))
  pendingEvents.set(requestKey, request)
  return request
}

async function findOrCreateTutorialEvent(
  personHandle: number,
  companyHandle: number,
  dayStart: Date,
  dayEndExclusive: Date,
  content: TutorialWelcomeEventContent,
) {
  const existing = await ApiGenericService.find<EventItem>('event', {
    filter: {
      $and: [
        { title: content.title },
        {
          startDate: { $gte: dayStart.toISOString(), $lt: dayEndExclusive.toISOString() },
        },
        { participants: { handle: personHandle } },
      ],
    },
    limit: 1,
    fields: ['handle'],
  })

  if (existing.data[0]) {
    return existing.data[0]
  }

  return ApiGenericService.create<EventItem>('event', {
    title: content.title,
    description: content.description,
    startDate: dayStart.toISOString(),
    endDate: new Date(dayEndExclusive.getTime() - 1).toISOString(),
    isAllDay: true,
    isPrivate: false,
    status: 'scheduled',
    category: 'internal',
    assigneeCompany: companyHandle,
    assigneePerson: personHandle,
    creatorCompany: companyHandle,
    creatorPerson: personHandle,
    participants: [personHandle],
  } as unknown as Partial<EventItem>)
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
