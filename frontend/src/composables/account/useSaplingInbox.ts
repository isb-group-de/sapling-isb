import { computed, ref } from 'vue'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import { useI18n } from 'vue-i18n'
import type {
  EffortEstimateItem,
  EventItem,
  InboxNotificationItem,
  InternalCaseItem,
  SalesOpportunityItem,
  TicketItem,
} from '@/entity/entity'
import ApiCurrentService from '@/services/api.current.service'
import ApiCalendarService from '@/services/api.calendar.service'
import ApiGenericService from '@/services/api.generic.service'
import { useRouter } from 'vue-router'
import { useChangeLogDialogStore } from '@/stores/changeLogDialogStore'
import {
  useOpenTaskCountEvents,
  updateOpenTaskSnapshot,
  type OpenTaskSnapshot,
} from '@/composables/system/useOpenTaskCountEvents'
import {
  appendEventRecurrenceExceptions,
  buildEventCompletionPlan,
  buildEventCompletionTargetChunks,
  getEventExpectedUpdatedAt,
  getDefaultEventCompletionCutoff,
  isValidEventCompletionCutoff,
} from '@/utils/inboxEventCompletion'
import { findFirstGeneratedRecurrenceOccurrence } from '@/utils/eventRecurrence'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import {
  compareInboxEntriesByDate as compareEntriesByDate,
  getInboxSectionKey as getSectionKey,
  type InboxEntry,
  type InboxSection,
  type InboxSectionKey,
  type InboxSummaryCard,
} from './saplingInbox.utils'
import {
  createEffortEstimateEntry,
  createInternalCaseEntry,
  createNotificationEntry,
  createSalesOpportunityEntry,
  createTaskEntry,
  createTicketEntry,
} from './saplingInboxEntries'

export type {
  InboxEntry,
  InboxEntryKind,
  InboxSection,
  InboxSectionKey,
  InboxSummaryCard,
} from './saplingInbox.utils'

type CloseEmitter = (event: 'close') => void
const EVENT_OCCURRENCE_BATCH_SIZE = 200

export function useSaplingInbox(emit: CloseEmitter) {
  //#region State
  const { t } = useI18n()
  const { isLoading: isTranslationLoading } = useTranslationLoader(
    'global',
    'inbox',
    'navigation',
    'exception',
  )
  const dialog = ref(true)
  const isDataLoading = ref(true)
  const tickets = ref<TicketItem[]>([])
  const tasks = ref<EventItem[]>([])
  const salesOpportunities = ref<SalesOpportunityItem[]>([])
  const effortEstimates = ref<EffortEstimateItem[]>([])
  const internalCases = ref<InternalCaseItem[]>([])
  const notifications = ref<InboxNotificationItem[]>([])
  const pendingDismissals = new Map<number, Promise<void>>()
  const completeEventsDialog = ref(false)
  const completeEventsCutoffDate = ref<string | null>(getDefaultEventCompletionCutoff())
  const isCompletingEvents = ref(false)
  const router = useRouter()
  const changeLogDialogStore = useChangeLogDialogStore()
  const messageCenter = useSaplingMessageCenter()
  const isLoading = computed(
    () => isTranslationLoading.value || (isDataLoading.value && !streamError.value),
  )
  //#endregion

  const { streamError } = useOpenTaskCountEvents((snapshot) => {
    applyOpenTaskSnapshot(snapshot)
  })

  //#region Utility Functions
  function openEntry(entry: InboxEntry) {
    closeDialog()
    void router.push(entry.route)
  }

  function openEntryChangeLog(entry: InboxEntry) {
    if (entry.kind !== 'notification' || !entry.sourceEntity || !entry.referenceHandle) return
    changeLogDialogStore.openChangeLog(entry.sourceEntity, entry.referenceHandle)
  }

  function applyOpenTaskSnapshot(snapshot: OpenTaskSnapshot) {
    tickets.value = snapshot.tickets
    tasks.value = snapshot.tasks
    salesOpportunities.value = snapshot.salesOpportunities
    effortEstimates.value = snapshot.effortEstimates ?? []
    internalCases.value = snapshot.internalCases ?? []
    notifications.value = snapshot.notifications
    isDataLoading.value = false
  }

  function publishOpenTaskSnapshot() {
    updateOpenTaskSnapshot({
      count:
        tickets.value.length +
        tasks.value.length +
        salesOpportunities.value.length +
        effortEstimates.value.length +
        internalCases.value.length +
        notifications.value.length,
      tickets: [...tickets.value],
      tasks: [...tasks.value],
      salesOpportunities: [...salesOpportunities.value],
      effortEstimates: [...effortEstimates.value],
      internalCases: [...internalCases.value],
      notifications: [...notifications.value],
    })
  }

  async function dismissEntry(entry: InboxEntry) {
    if (entry.notificationHandle == null) {
      return
    }

    const handle = entry.notificationHandle
    const existing = pendingDismissals.get(handle)
    if (existing) return existing
    const pending = ApiCurrentService.markInboxNotificationRead(handle)
      .then(() => {
        notifications.value = notifications.value.filter(
          (notification) => notification.handle !== handle,
        )
        publishOpenTaskSnapshot()
      })
      .finally(() => pendingDismissals.delete(handle))
    pendingDismissals.set(handle, pending)
    await pending
  }

  function openCompleteEventsDialog() {
    completeEventsCutoffDate.value = getDefaultEventCompletionCutoff()
    completeEventsDialog.value = true
  }

  function closeCompleteEventsDialog() {
    if (!isCompletingEvents.value) {
      completeEventsDialog.value = false
    }
  }

  function validateCompleteEventsCutoff(value: string | null): boolean | string {
    return value != null && isValidEventCompletionCutoff(value)
      ? true
      : t('inbox.completeEventsCutoffInvalid')
  }

  async function completeOverdueEvents() {
    const plan = completeEventsPlan.value
    if (plan.completionCount === 0 || isCompletingEvents.value) {
      return
    }
    if (!plan.isComplete) {
      messageCenter.pushMessage(
        'warning',
        'inbox.completeEventsTooManyOccurrences',
        'inbox.completeEventsTooManyOccurrencesDescription',
        'event',
      )
      return
    }

    isCompletingEvents.value = true
    try {
      const retainedSeries = new Map<string | number, EventItem>()
      const exhaustedSeries: EventItem[] = []

      for (const recurringTarget of plan.recurringEvents) {
        const handle = recurringTarget.event.handle
        if (handle == null) {
          continue
        }
        let updatedSeries = recurringTarget.event

        for (
          let index = 0;
          index < recurringTarget.occurrenceStarts.length;
          index += EVENT_OCCURRENCE_BATCH_SIZE
        ) {
          const occurrenceStarts = recurringTarget.occurrenceStarts.slice(
            index,
            index + EVENT_OCCURRENCE_BATCH_SIZE,
          )
          const expectedUpdatedAt = getEventExpectedUpdatedAt(updatedSeries)
          const result = await ApiCalendarService.detachEventOccurrences(handle, {
            occurrenceStarts,
            event: { status: 'completed' },
            ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
          })
          updatedSeries = {
            ...appendEventRecurrenceExceptions(updatedSeries, occurrenceStarts),
            updatedAt: result.seriesEvent.updatedAt,
          }
          tasks.value = tasks.value.map((event) =>
            event.handle === handle ? updatedSeries : event,
          )
          publishOpenTaskSnapshot()
        }

        const nextOccurrence = findFirstGeneratedRecurrenceOccurrence(updatedSeries)
        if (nextOccurrence.occurrence) {
          retainedSeries.set(handle, updatedSeries)
        } else if (nextOccurrence.isComplete) {
          exhaustedSeries.push(updatedSeries)
        }
      }

      const completedRecords = [...plan.standaloneEvents, ...exhaustedSeries]
      for (const targets of buildEventCompletionTargetChunks(completedRecords)) {
        await ApiGenericService.bulkUpdate('event', {
          targets,
          changes: { status: 'completed' },
        })
      }

      const completedHandles = new Set(completedRecords.map((event) => event.handle))
      tasks.value = tasks.value
        .filter((event) => !completedHandles.has(event.handle))
        .map((event) =>
          event.handle == null ? event : (retainedSeries.get(event.handle) ?? event),
        )
      publishOpenTaskSnapshot()
      completeEventsDialog.value = false
      messageCenter.pushMessage(
        'success',
        'inbox.completeEventsSuccess',
        'inbox.completeEventsSuccessDescription',
        'event',
        undefined,
        { count: plan.completionCount },
      )
    } finally {
      isCompletingEvents.value = false
    }
  }

  //#endregion

  //#region Derived State
  const ticketEntries = computed(() => tickets.value.map(createTicketEntry))
  const taskEntries = computed(() => tasks.value.map(createTaskEntry))
  const salesOpportunityEntries = computed(() =>
    salesOpportunities.value.map(createSalesOpportunityEntry),
  )
  const effortEstimateEntries = computed(() => effortEstimates.value.map(createEffortEstimateEntry))
  const internalCaseEntries = computed(() => internalCases.value.map(createInternalCaseEntry))
  const notificationEntries = computed(() =>
    notifications.value.map((notification) => createNotificationEntry(notification, t)),
  )
  const actionableEntries = computed(() =>
    [
      ...ticketEntries.value,
      ...taskEntries.value,
      ...salesOpportunityEntries.value,
      ...effortEstimateEntries.value,
      ...internalCaseEntries.value,
    ].sort(compareEntriesByDate),
  )
  const allEntries = computed(() =>
    [...notificationEntries.value, ...actionableEntries.value].sort(compareEntriesByDate),
  )

  function getSectionItems(sectionKey: InboxSectionKey) {
    return actionableEntries.value.filter((entry) => getSectionKey(entry.dateValue) === sectionKey)
  }

  const overdueEntries = computed(() => getSectionItems('overdue'))
  const overdueEventCount = computed(
    () => taskEntries.value.filter((entry) => getSectionKey(entry.dateValue) === 'overdue').length,
  )
  const completeEventsPlan = computed(() =>
    buildEventCompletionPlan(tasks.value, completeEventsCutoffDate.value ?? ''),
  )
  const todayEntries = computed(() => getSectionItems('today'))
  const upcomingEntries = computed(() => getSectionItems('upcoming'))
  const laterEntries = computed(() => getSectionItems('later'))
  const unplannedEntries = computed(() => getSectionItems('unplanned'))

  const totalEntries = computed(() => allEntries.value.length)
  const hasInboxItems = computed(() => totalEntries.value > 0)

  const summaryCards = computed<InboxSummaryCard[]>(() => [
    {
      key: 'effortEstimate',
      labelKey: 'navigation.effortEstimate',
      icon: 'mdi-clipboard-text-clock-outline',
      count: effortEstimateEntries.value.length,
      tone: 'success',
    },
    {
      key: 'ticket',
      labelKey: 'navigation.ticket',
      icon: 'mdi-ticket-outline',
      count: ticketEntries.value.length,
      tone: 'info',
    },
    {
      key: 'event',
      labelKey: 'navigation.event',
      icon: 'mdi-calendar-star',
      count: taskEntries.value.length,
      tone: 'primary',
    },
    {
      key: 'salesOpportunity',
      labelKey: 'navigation.salesOpportunity',
      icon: 'mdi-cash-multiple',
      count: salesOpportunityEntries.value.length,
      tone: 'success',
    },
    {
      key: 'internalCase',
      labelKey: 'navigation.internalCase',
      icon: 'mdi-clipboard-text-outline',
      count: internalCaseEntries.value.length,
      tone: 'warning',
    },
  ])

  const sections = computed<InboxSection[]>(() => [
    {
      key: 'overdue',
      titleKey: 'inbox.overdue',
      subtitleKey: 'inbox.overdueSummary',
      emptyKey: 'inbox.overdueEmpty',
      icon: 'mdi-alert-circle-outline',
      tone: 'warning',
      count: overdueEntries.value.length,
      items: overdueEntries.value,
      empty: overdueEntries.value.length === 0,
    },
    {
      key: 'today',
      titleKey: 'inbox.today',
      subtitleKey: 'inbox.todaySummary',
      emptyKey: 'inbox.todayEmpty',
      icon: 'mdi-calendar-today',
      tone: 'info',
      count: todayEntries.value.length,
      items: todayEntries.value,
      empty: todayEntries.value.length === 0,
    },
    {
      key: 'upcoming',
      titleKey: 'inbox.upcoming',
      subtitleKey: 'inbox.upcomingSummary',
      emptyKey: 'inbox.upcomingEmpty',
      icon: 'mdi-calendar-range-outline',
      tone: 'success',
      count: upcomingEntries.value.length,
      items: upcomingEntries.value,
      empty: upcomingEntries.value.length === 0,
    },
    {
      key: 'later',
      titleKey: 'inbox.later',
      subtitleKey: 'inbox.laterSummary',
      emptyKey: 'inbox.laterEmpty',
      icon: 'mdi-timeline-clock-outline',
      tone: 'primary',
      count: laterEntries.value.length,
      items: laterEntries.value,
      empty: laterEntries.value.length === 0,
    },
    {
      key: 'unplanned',
      titleKey: 'inbox.unplanned',
      subtitleKey: 'inbox.unplannedSummary',
      emptyKey: 'inbox.unplannedEmpty',
      icon: 'mdi-calendar-question-outline',
      tone: 'secondary',
      count: unplannedEntries.value.length,
      items: unplannedEntries.value,
      empty: unplannedEntries.value.length === 0,
    },
  ])
  //#endregion

  //#region Dialog Management
  function closeDialog() {
    dialog.value = false
    emit('close')
  }
  //#endregion

  //#region Return
  return {
    isLoading,
    streamError,
    dialog,
    notificationEntries,
    ticketEntries,
    taskEntries,
    salesOpportunityEntries,
    effortEstimateEntries,
    internalCaseEntries,
    totalEntries,
    hasInboxItems,
    summaryCards,
    sections,
    overdueEventCount,
    completeEventsDialog,
    completeEventsCutoffDate,
    completeEventsCandidateCount: computed(() => completeEventsPlan.value.completionCount),
    isCompletingEvents,
    openCompleteEventsDialog,
    closeCompleteEventsDialog,
    validateCompleteEventsCutoff,
    completeOverdueEvents,
    openEntry,
    openEntryChangeLog,
    dismissEntry,
    closeDialog,
  }
  //#endregion
}
