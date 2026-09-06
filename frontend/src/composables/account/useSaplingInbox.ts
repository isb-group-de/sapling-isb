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
import { formatDate, formatDateFromTo, formatDateTimeValue } from '@/utils/saplingFormatUtil'
import { useRouter } from 'vue-router'
import {
  getEffortEstimateInboxRoute,
  getInternalCaseInboxRoute,
  getNotificationInboxRoute,
  getSalesOpportunityInboxRoute,
  getTaskInboxRoute,
  getTicketInboxRoute,
} from '@/utils/inboxRoute.util'
import {
  useOpenTaskCountEvents,
  updateOpenTaskSnapshot,
  type OpenTaskSnapshot,
} from '@/composables/system/useOpenTaskCountEvents'
import { getOpenTaskEventOccurrence } from '@/utils/openTaskEvent'
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
  formatInboxCurrency as formatCurrency,
  formatInboxProbability as formatProbability,
  getInboxSectionKey as getSectionKey,
  toInboxDate as toDate,
  type InboxEntry,
  type InboxSection,
  type InboxSectionKey,
  type InboxSummaryCard,
} from './saplingInbox.utils'

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

  function createTicketEntry(ticket: TicketItem): InboxEntry {
    const dateValue = toDate(ticket.deadlineDate)

    return {
      id: `ticket-${ticket.handle ?? ticket.title}`,
      kind: 'ticket',
      kindLabelKey: 'navigation.ticket',
      title: ticket.title,
      description: ticket.problemDescription ?? '',
      dateText: formatDate(ticket.deadlineDate),
      dateValue,
      icon: 'mdi-ticket-confirmation-outline',
      accentColor: ticket.priority?.color ?? ticket.status?.color,
      contextLabel: ticket.priority?.description,
      contextColor: ticket.priority?.color,
      statusLabel: ticket.status?.description,
      statusColor: ticket.status?.color,
      supportLabels: [],
      route: getTicketInboxRoute(ticket),
    }
  }

  function createTaskEntry(task: EventItem): InboxEntry {
    const occurrence = getOpenTaskEventOccurrence(task)
    const dateValue = occurrence?.startDate ?? null

    return {
      id: `event-${task.handle ?? task.title}`,
      kind: 'event',
      kindLabelKey: 'navigation.event',
      title: task.title,
      description: task.description ?? '',
      dateText: occurrence
        ? formatDateFromTo(occurrence.startDate, occurrence.endDate)
        : formatDateFromTo(task.startDate, task.endDate),
      dateValue,
      icon: task.type?.icon || 'mdi-calendar-clock-outline',
      accentColor: task.type?.color ?? task.status?.color,
      contextLabel: task.type?.title,
      contextColor: task.type?.color,
      statusLabel: task.status?.description,
      statusColor: task.status?.color,
      supportLabels: [],
      route: getTaskInboxRoute(task),
    }
  }

  function createSalesOpportunityEntry(opportunity: SalesOpportunityItem): InboxEntry {
    const dateValue = toDate(opportunity.closeDate)
    const supportLabels = [
      formatCurrency(opportunity.expectedRevenue),
      formatProbability(opportunity.probability),
      opportunity.creatorCompany?.name ?? '',
    ].filter((label) => label.length > 0)

    return {
      id: `sales-opportunity-${opportunity.handle ?? opportunity.title}`,
      kind: 'salesOpportunity',
      kindLabelKey: 'navigation.salesOpportunity',
      title: opportunity.title,
      description: opportunity.nextStep ?? opportunity.description ?? opportunity.painPoints ?? '',
      dateText: formatDate(opportunity.closeDate),
      dateValue,
      icon: opportunity.type?.icon || 'mdi-chart-timeline-variant',
      accentColor: opportunity.type?.color ?? opportunity.forecast?.color,
      contextLabel: opportunity.forecast?.title,
      contextColor: opportunity.forecast?.color,
      statusLabel: opportunity.type?.title,
      statusColor: opportunity.type?.color,
      supportLabels,
      route: getSalesOpportunityInboxRoute(opportunity),
    }
  }

  function createEffortEstimateEntry(estimate: EffortEstimateItem): InboxEntry {
    const dateValue = toDate(estimate.expectedCompletionDate)
    const status = typeof estimate.status === 'object' ? estimate.status : null
    const supportLabels = [
      estimate.creatorCompany?.name ?? '',
      estimate.creatorPerson
        ? `${estimate.creatorPerson.firstName ?? ''} ${estimate.creatorPerson.lastName ?? ''}`.trim()
        : '',
      estimate.ticket?.title ?? '',
    ].filter((label) => label.length > 0)

    return {
      id: `effort-estimate-${estimate.handle ?? estimate.title}`,
      kind: 'effortEstimate',
      kindLabelKey: 'navigation.effortEstimate',
      title: estimate.title,
      description: estimate.requirementsMarkdown ?? '',
      dateText: formatDate(estimate.expectedCompletionDate),
      dateValue,
      icon: 'mdi-clipboard-text-clock-outline',
      accentColor: status?.color,
      contextLabel: estimate.salesOpportunity?.title,
      contextColor: 'success',
      statusLabel: status?.description,
      statusColor: status?.color,
      supportLabels,
      route: getEffortEstimateInboxRoute(estimate),
    }
  }

  function createInternalCaseEntry(internalCase: InternalCaseItem): InboxEntry {
    const status = typeof internalCase.status === 'object' ? internalCase.status : null
    const category = typeof internalCase.category === 'object' ? internalCase.category : null
    const customerCompany =
      typeof internalCase.customerCompany === 'object' ? internalCase.customerCompany : null
    const customerPerson =
      typeof internalCase.customerPerson === 'object' ? internalCase.customerPerson : null
    const supportLabels = [
      customerCompany?.name ?? '',
      customerPerson
        ? `${customerPerson.firstName ?? ''} ${customerPerson.lastName ?? ''}`.trim()
        : '',
      internalCase.number ?? '',
    ].filter((label) => label.length > 0)

    return {
      id: `internal-case-${internalCase.handle ?? internalCase.title}`,
      kind: 'internalCase',
      kindLabelKey: 'navigation.internalCase',
      title: internalCase.title,
      description: internalCase.requestMarkdown ?? '',
      dateText: internalCase.createdAt ? formatDateTimeValue(internalCase.createdAt) : '',
      dateValue: null,
      icon: category?.icon || 'mdi-clipboard-text-outline',
      accentColor: category?.color ?? status?.color,
      contextLabel: category?.title,
      contextColor: category?.color,
      statusLabel: status?.description,
      statusColor: status?.color,
      supportLabels,
      route: getInternalCaseInboxRoute(internalCase),
    }
  }

  function createNotificationEntry(notification: InboxNotificationItem): InboxEntry {
    const dateValue = toDate(notification.createdAt)
    const entityHandle =
      typeof notification.entity === 'object'
        ? String(notification.entity.handle ?? '').trim()
        : String(notification.entity ?? '').trim()
    const entityTranslationKey = entityHandle ? `navigation.${entityHandle}` : ''
    const entityLabel =
      entityTranslationKey && t(entityTranslationKey) !== entityTranslationKey
        ? t(entityTranslationKey)
        : entityHandle

    return {
      id: `notification-${notification.handle ?? notification.title}`,
      kind: 'notification',
      kindLabelKey: 'navigation.inboxNotification',
      title: notification.title,
      description: notification.bodyText ?? '',
      dateText: notification.createdAt ? formatDateTimeValue(notification.createdAt) : '',
      dateValue,
      icon:
        typeof notification.entity === 'object'
          ? (notification.entity.icon ?? 'mdi-bell-outline')
          : 'mdi-bell-outline',
      accentColor: null,
      contextLabel: notification.referenceHandle ? `#${notification.referenceHandle}` : undefined,
      contextColor: 'primary',
      statusLabel: entityLabel || undefined,
      statusColor: 'primary',
      supportLabels: [],
      route: getNotificationInboxRoute(notification),
      notificationHandle: notification.handle ?? null,
      dismissible: true,
    }
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
  const notificationEntries = computed(() => notifications.value.map(createNotificationEntry))
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
    dismissEntry,
    closeDialog,
  }
  //#endregion
}
