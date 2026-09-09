import type {
  EffortEstimateItem,
  EventItem,
  InboxNotificationItem,
  InternalCaseItem,
  SalesOpportunityItem,
  TicketItem,
} from '@/entity/entity'
import { formatDate, formatDateFromTo, formatDateTimeValue } from '@/utils/saplingFormatUtil'
import {
  getEffortEstimateInboxRoute,
  getInternalCaseInboxRoute,
  getNotificationInboxRoute,
  getSalesOpportunityInboxRoute,
  getTaskInboxRoute,
  getTicketInboxRoute,
} from '@/utils/inboxRoute.util'
import { getOpenTaskEventOccurrence } from '@/utils/openTaskEvent'
import {
  formatInboxCurrency,
  formatInboxProbability,
  toInboxDate,
  type InboxEntry,
} from './saplingInbox.utils'

type Translate = (key: string) => string

export function createTicketEntry(ticket: TicketItem): InboxEntry {
  return {
    id: `ticket-${ticket.handle ?? ticket.title}`,
    kind: 'ticket',
    kindLabelKey: 'navigation.ticket',
    title: ticket.title,
    description: ticket.problemDescription ?? '',
    dateText: formatDate(ticket.deadlineDate),
    dateValue: toInboxDate(ticket.deadlineDate),
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

export function createTaskEntry(task: EventItem): InboxEntry {
  const occurrence = getOpenTaskEventOccurrence(task)
  return {
    id: `event-${task.handle ?? task.title}`,
    kind: 'event',
    kindLabelKey: 'navigation.event',
    title: task.title,
    description: task.description ?? '',
    dateText: occurrence
      ? formatDateFromTo(occurrence.startDate, occurrence.endDate)
      : formatDateFromTo(task.startDate, task.endDate),
    dateValue: occurrence?.startDate ?? null,
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

export function createSalesOpportunityEntry(opportunity: SalesOpportunityItem): InboxEntry {
  return {
    id: `sales-opportunity-${opportunity.handle ?? opportunity.title}`,
    kind: 'salesOpportunity',
    kindLabelKey: 'navigation.salesOpportunity',
    title: opportunity.title,
    description: opportunity.nextStep ?? opportunity.description ?? opportunity.painPoints ?? '',
    dateText: formatDate(opportunity.closeDate),
    dateValue: toInboxDate(opportunity.closeDate),
    icon: opportunity.type?.icon || 'mdi-chart-timeline-variant',
    accentColor: opportunity.type?.color ?? opportunity.forecast?.color,
    contextLabel: opportunity.forecast?.title,
    contextColor: opportunity.forecast?.color,
    statusLabel: opportunity.type?.title,
    statusColor: opportunity.type?.color,
    supportLabels: [
      formatInboxCurrency(opportunity.expectedRevenue),
      formatInboxProbability(opportunity.probability),
      opportunity.creatorCompany?.name ?? '',
    ].filter(Boolean),
    route: getSalesOpportunityInboxRoute(opportunity),
  }
}

export function createEffortEstimateEntry(estimate: EffortEstimateItem): InboxEntry {
  const status = typeof estimate.status === 'object' ? estimate.status : null
  return {
    id: `effort-estimate-${estimate.handle ?? estimate.title}`,
    kind: 'effortEstimate',
    kindLabelKey: 'navigation.effortEstimate',
    title: estimate.title,
    description: estimate.requirementsMarkdown ?? '',
    dateText: formatDate(estimate.expectedCompletionDate),
    dateValue: toInboxDate(estimate.expectedCompletionDate),
    icon: 'mdi-clipboard-text-clock-outline',
    accentColor: status?.color,
    contextLabel: estimate.salesOpportunity?.title,
    contextColor: 'success',
    statusLabel: status?.description,
    statusColor: status?.color,
    supportLabels: [
      estimate.creatorCompany?.name ?? '',
      estimate.creatorPerson
        ? `${estimate.creatorPerson.firstName ?? ''} ${estimate.creatorPerson.lastName ?? ''}`.trim()
        : '',
      estimate.ticket?.title ?? '',
    ].filter(Boolean),
    route: getEffortEstimateInboxRoute(estimate),
  }
}

export function createInternalCaseEntry(internalCase: InternalCaseItem): InboxEntry {
  const status = typeof internalCase.status === 'object' ? internalCase.status : null
  const category = typeof internalCase.category === 'object' ? internalCase.category : null
  const company =
    typeof internalCase.customerCompany === 'object' ? internalCase.customerCompany : null
  const person =
    typeof internalCase.customerPerson === 'object' ? internalCase.customerPerson : null
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
    supportLabels: [
      company?.name ?? '',
      person ? `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() : '',
      internalCase.number ?? '',
    ].filter(Boolean),
    route: getInternalCaseInboxRoute(internalCase),
  }
}

export function createNotificationEntry(
  notification: InboxNotificationItem,
  translate: Translate,
): InboxEntry {
  const entityHandle =
    typeof notification.entity === 'object'
      ? String(notification.entity.handle ?? '').trim()
      : String(notification.entity ?? '').trim()
  const translationKey = entityHandle ? `navigation.${entityHandle}` : ''
  const translatedEntity = translationKey ? translate(translationKey) : ''
  return {
    id: `notification-${notification.handle ?? notification.title}`,
    kind: 'notification',
    sourceEntity: entityHandle,
    referenceHandle: notification.referenceHandle?.trim() || undefined,
    kindLabelKey: 'navigation.inboxNotification',
    title: notification.title,
    description: notification.bodyText ?? '',
    descriptionMarkdown: notification.bodyMarkdown ?? undefined,
    dateText: notification.createdAt ? formatDateTimeValue(notification.createdAt) : '',
    dateValue: toInboxDate(notification.createdAt),
    icon:
      typeof notification.entity === 'object'
        ? (notification.entity.icon ?? 'mdi-bell-outline')
        : 'mdi-bell-outline',
    accentColor: null,
    contextLabel: notification.referenceHandle ? `#${notification.referenceHandle}` : undefined,
    contextColor: 'primary',
    statusLabel:
      translatedEntity && translatedEntity !== translationKey
        ? translatedEntity
        : entityHandle || undefined,
    statusColor: 'primary',
    supportLabels: [],
    route: getNotificationInboxRoute(notification),
    notificationHandle: notification.handle ?? null,
    dismissible: true,
  }
}
