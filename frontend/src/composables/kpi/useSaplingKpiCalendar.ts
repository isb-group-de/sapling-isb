import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import { useRouter } from 'vue-router'
import ApiGenericService, { type FilterQuery } from '@/services/api.generic.service'
import type { EventItem, KPIItem } from '@/entity/entity'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { expandRecurringEvent } from '@/utils/eventRecurrence'
import { buildKpiEntityFilter, getKpiTargetEntityHandle } from '@/utils/saplingKpiNavigation'
import { pushAppRoute } from '@/utils/routerNavigation'
import { useSaplingKpiLoader } from '@/composables/kpi/useSaplingKpiLoader'

export const CALENDAR_KPI_TYPE_HANDLE = 'CALENDAR'
export const CALENDAR_KPI_AGENDA_DAYS = 90
export const CALENDAR_KPI_AGENDA_LIMIT = 5

const EVENT_AGENDA_FIELDS = [
  'handle',
  'title',
  'startDate',
  'endDate',
  'isAllDay',
  'isPrivate',
  'recurrenceRule',
  'type',
  'type.title',
  'type.icon',
  'type.color',
  'category',
  'category.title',
  'category.icon',
  'category.color',
  'participants',
]

const EVENT_AGENDA_RELATIONS = ['participants', 'type', 'category']
const DEFAULT_EVENT_COLOR = '#2196F3'

export interface SaplingKpiCalendarEntry {
  key: string
  handle: number | null
  title: string
  start: Date
  end: Date
  isAllDay: boolean
  icon: string
  color: string
  metaLabel: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/** Builds the permission-aware generic Event query used by calendar KPI cards. */
export function buildCalendarAgendaFilter(
  kpi: KPIItem,
  personHandle: number,
  rangeStart: Date,
  rangeEnd: Date,
): FilterQuery {
  const configuredFilter = buildKpiEntityFilter(kpi)
  const clauses: FilterQuery[] = [
    { participants: [personHandle] },
    {
      $or: [
        {
          $and: [
            { startDate: { $lte: rangeEnd.toISOString() } },
            { endDate: { $gte: rangeStart.toISOString() } },
          ],
        },
        {
          $and: [{ recurrenceRule: { $ne: null } }, { recurrenceRule: { $ne: '' } }],
        },
      ],
    },
  ]

  if (isRecord(configuredFilter) && Object.keys(configuredFilter).length > 0) {
    clauses.splice(1, 0, configuredFilter)
  }

  return { $and: clauses }
}

/** Expands, sorts and limits event records into the compact dashboard agenda. */
export function buildCalendarAgendaEntries(
  events: EventItem[],
  rangeStart: Date,
  rangeEnd: Date,
  limit = CALENDAR_KPI_AGENDA_LIMIT,
): SaplingKpiCalendarEntry[] {
  return events
    .flatMap((event) =>
      expandRecurringEvent(event, rangeStart, rangeEnd).map((occurrence) => {
        const start = new Date(Number(occurrence.start))
        const end = new Date(Number(occurrence.end))
        const handle = typeof event.handle === 'number' ? event.handle : null
        const occurrenceIndex = occurrence.recurrenceOccurrenceIndex ?? 0

        return {
          key: `${handle ?? 'event'}-${start.getTime()}-${occurrenceIndex}`,
          handle,
          title: event.title,
          start,
          end,
          isAllDay: event.isAllDay === true,
          icon: event.type?.icon?.trim() || event.category?.icon?.trim() || 'mdi-calendar-outline',
          color: event.type?.color?.trim() || event.category?.color?.trim() || DEFAULT_EVENT_COLOR,
          metaLabel: [event.type?.title, event.category?.title].filter(Boolean).join(' · '),
        }
      }),
    )
    .filter(
      (entry) =>
        !Number.isNaN(entry.start.getTime()) &&
        !Number.isNaN(entry.end.getTime()) &&
        entry.end.getTime() >= rangeStart.getTime() &&
        entry.start.getTime() <= rangeEnd.getTime(),
    )
    .sort((left, right) =>
      left.start.getTime() === right.start.getTime()
        ? left.end.getTime() - right.end.getTime()
        : left.start.getTime() - right.start.getTime(),
    )
    .slice(0, Math.max(0, limit))
}

/** Loads and exposes the signed-in person's compact calendar KPI agenda. */
export function useSaplingKpiCalendar(kpi: MaybeRefOrGetter<KPIItem | null | undefined>) {
  const router = useRouter()
  const currentPersonStore = useCurrentPersonStore()
  const entries = ref<SaplingKpiCalendarEntry[]>([])
  const targetEntityHandle = computed(() =>
    getKpiTargetEntityHandle(toValue(kpi)?.targetEntity ?? null),
  )
  const hasConfigurationError = computed(() => targetEntityHandle.value !== 'event')
  const hasData = computed(() => entries.value.length > 0)

  const { loading, hasError, isLoaded, loadKpiValue } = useSaplingKpiLoader(kpi, {
    load: async (currentKpi) => {
      if (getKpiTargetEntityHandle(currentKpi.targetEntity ?? null) !== 'event') {
        entries.value = []
        return
      }

      await currentPersonStore.fetchCurrentPerson()
      const personHandle = currentPersonStore.person?.handle
      if (typeof personHandle !== 'number') {
        throw new Error('The current person is unavailable for the calendar KPI.')
      }

      const rangeStart = new Date()
      const rangeEnd = addDays(rangeStart, CALENDAR_KPI_AGENDA_DAYS)
      const events = await ApiGenericService.findAll<EventItem>('event', {
        relations: EVENT_AGENDA_RELATIONS,
        fields: EVENT_AGENDA_FIELDS,
        filter: buildCalendarAgendaFilter(currentKpi, personHandle, rangeStart, rangeEnd),
        orderBy: { startDate: 'ASC' },
      })

      entries.value = buildCalendarAgendaEntries(events, rangeStart, rangeEnd)
    },
    reset: () => {
      entries.value = []
    },
  })

  async function openEvent(entry: SaplingKpiCalendarEntry) {
    if (entry.handle == null) {
      return
    }

    await pushAppRoute(router, `/event?open=${encodeURIComponent(String(entry.handle))}`)
  }

  return {
    entries,
    loading,
    hasError,
    isLoaded,
    hasData,
    hasConfigurationError,
    loadKpiValue,
    refresh: loadKpiValue,
    openEvent,
  }
}
