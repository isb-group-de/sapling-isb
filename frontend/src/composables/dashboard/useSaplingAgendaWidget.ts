import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { DashboardWidget } from '@/entity/dashboard-widget.types'
import type { EventItem } from '@/entity/entity'
import ApiGenericService from '@/services/api.generic.service'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import {
  buildCalendarAgendaEntries,
  type SaplingKpiCalendarEntry,
} from '@/composables/kpi/useSaplingKpiCalendar'
import { pushAppRoute } from '@/utils/routerNavigation'

export function useSaplingAgendaWidget(
  config: () => Extract<DashboardWidget, { kind: 'AGENDA' }>['config'],
) {
  const person = useCurrentPersonStore()
  const router = useRouter()
  const entries = ref<SaplingKpiCalendarEntry[]>([])
  const loading = ref(false)
  const hasError = ref(false)
  let request = 0
  onBeforeUnmount(() => {
    request++
  })
  async function refresh() {
    const currentRequest = ++request
    loading.value = true
    hasError.value = false
    try {
      await person.fetchCurrentPerson()
      if (!person.person?.handle) return
      const start = new Date()
      const end = new Date(start)
      end.setDate(end.getDate() + config().days)
      const response = await ApiGenericService.findAll<EventItem>('event', {
        relations: ['participants', 'type', 'category'],
        filter: {
          $and: [
            { participants: [person.person.handle] },
            config().filter,
            {
              $or: [
                {
                  $and: [
                    { startDate: { $lte: end.toISOString() } },
                    { endDate: { $gte: start.toISOString() } },
                  ],
                },
                { $and: [{ recurrenceRule: { $ne: null } }, { recurrenceRule: { $ne: '' } }] },
              ],
            },
          ],
        },
        orderBy: { startDate: 'ASC' },
      })
      if (currentRequest === request)
        entries.value = buildCalendarAgendaEntries(response, start, end, config().limit)
    } catch {
      if (currentRequest === request) {
        entries.value = []
        hasError.value = true
      }
    } finally {
      if (currentRequest === request) loading.value = false
    }
  }
  onMounted(() => void refresh())
  const hasData = computed(() => entries.value.length > 0)
  function openEvent(entry: SaplingKpiCalendarEntry) {
    if (entry.handle != null) return pushAppRoute(router, `/event?open=${entry.handle}`)
  }
  return { entries, loading, hasError, hasData, refresh, openEvent }
}
