import type { PersonItem } from './entity-account.types'
import type { SaplingGenericItem } from './entity-base.types'
import type { CompanyItem } from './entity-customer.types'
import type { TicketItem } from './entity-service.types'

/**
 * Entity representing an event type or category.
 * Used to classify events and provide icons/colors for display.
 */
export class EventAzureItem {
  /** Session number for the session (not primary key). */
  referenceHandle!: string
  /** The event associated with this Azure item.*/
  event!: EventItem
  /** Date and time when the dashboard was created. */
  createdAt?: Date = new Date()
  /** Date and time when the dashboard was last updated. */
  updatedAt?: Date = new Date()
}

/**
 * Represents a webhook delivery entity.
 */
export interface EventDeliveryItem extends SaplingGenericItem {
  /** Unique identifier for the webhook delivery (primary key) */
  handle?: number
  /** Status of the webhook delivery */
  status?: EventDeliveryStatusItem
  /** The event associated with this delivery */
  event: EventItem
  /** Payload of the webhook delivery */
  payload: object
  /** Optional request headers */
  requestHeaders?: object
  /** Response status code of the webhook delivery */
  responseStatusCode?: number
  /** Response body of the webhook delivery */
  responseBody?: object
  /** Optional response headers */
  responseHeaders?: object
  /** Date and time when the delivery was completed */
  completedAt?: Date | null
  /** Number of delivery attempts made */
  attemptCount: number
  /** Date and time for the next retry attempt */
  nextRetryAt?: Date | null
  /** Date and time when the delivery was created */
  createdAt: Date | null
  /** Date and time when the delivery was last updated */
  updatedAt?: Date | null
}

/**
 * Represents a webhook delivery status entity.
 */
export interface EventDeliveryStatusItem extends SaplingGenericItem {
  /** Unique identifier for the webhook delivery status */
  handle: string
  /** Name/description of the webhook delivery status */
  description: string
  /** Icon representing the webhook delivery status */
  icon?: string
  /** Color associated with the webhook delivery status */
  color: string
  /** Whether deliveries with this status belong to the default open view */
  isOpen?: boolean | null
  /** Configurable display order */
  sortOrder?: number | null
  /** Webhook deliveries belonging to this status */
  deliveries?: EventDeliveryItem[]
  /** Date and time when the status was created */
  createdAt?: Date | null
  /** Date and time when the status was last updated */
  updatedAt?: Date | null
}

/**
 * Represents a Google event entity (for Google Calendar integration).
 */
export interface EventGoogleItem extends SaplingGenericItem {
  /** Session number for the session (not primary key) */
  referenceHandle: string
  /** Calendar-wide identifier shared by Google event copies */
  iCalUId?: string | null
  /** The event associated with this Google item */
  event: EventItem
  /** Date and time when the entity was created */
  createdAt?: Date | null
  /** Date and time when the entity was last updated */
  updatedAt?: Date | null
}

/**
 * Represents a calendar event entity.
 */
export interface EventItem extends SaplingGenericItem {
  /** Unique identifier for the event (primary key) */
  handle?: number
  /** Title of the event */
  title: string
  /** The person who created the event */
  creatorPerson: PersonItem
  /** The company that created the event */
  creatorCompany: CompanyItem
  /** Unique transaction handle for the event */
  transactionHandle: string
  /** Description of the event (optional) */
  description?: string
  /** Start date and time of the event */
  startDate: Date
  /** End date and time of the event */
  endDate: Date
  /** Indicates if the event lasts all day */
  isAllDay: boolean
  /** Indicates whether the event is visible only to its creator */
  isPrivate: boolean
  /** Whether the connected calendar should create a Teams or Google Meet link */
  createOnlineMeeting: boolean
  /** Optional RFC5545 recurrence rule for repeating events */
  recurrenceRule?: string | null
  /** Original occurrence starts that have been detached from the series */
  recurrenceExceptionDates?: string[]
  /** Time reserved immediately before the appointment (HH:mm:ss) */
  preparationDuration?: string
  /** Time reserved immediately after the appointment (HH:mm:ss) */
  followUpDuration?: string
  /** URL for the online meeting (optional) */
  onlineMeetingURL?: string
  /** The appointment type of the event */
  type?: EventTypeItem | null
  /** The business category of the event */
  category?: EventCategoryItem | null
  /** The ticket associated with this event (optional) */
  ticket?: TicketItem
  /** Persons participating in this event */
  participants?: PersonItem[]
  /** The current status of the event */
  status?: EventStatusItem | null
  /** The Azure calendar item associated with this event (optional) */
  azure?: EventAzureItem
  /** The Google calendar item associated with this event (optional) */
  google?: EventGoogleItem
  /** Date and time when the event was created */
  createdAt?: Date | null
  /** Date and time when the event was last updated */
  updatedAt?: Date | null
}

/**
 * Represents a holiday entry that is rendered as a read-only calendar block.
 */
export interface HolidayItem extends SaplingGenericItem {
  /** Unique identifier for the holiday */
  handle?: number
  /** Title displayed in the calendar */
  title: string
  /** Optional description */
  description?: string
  /** Assigned holiday group */
  group?: HolidayGroupItem | number | null
  /** Start date and time */
  startDate: Date
  /** End date and time */
  endDate: Date
  /** Whether the holiday is shown as an all-day entry */
  isAllDay: boolean
  /** Icon used for visual identification */
  icon?: string
  /** Accent color used in the calendar */
  color: string
  /** Date and time when the holiday was created */
  createdAt?: Date | null
  /** Date and time when the holiday was last updated */
  updatedAt?: Date | null
}

/**
 * Represents a named holiday group that can be assigned to people or companies.
 */
export interface HolidayGroupItem extends SaplingGenericItem {
  /** Unique identifier for the holiday group */
  handle?: number
  /** Visible group name */
  title: string
  /** Holidays in this group */
  holidays?: HolidayItem[]
  /** Assigned persons */
  persons?: PersonItem[]
  /** Assigned companies */
  companies?: CompanyItem[]
  /** Date and time when the group was created */
  createdAt?: Date | null
  /** Date and time when the group was last updated */
  updatedAt?: Date | null
}

/**
 * Represents an event status entity.
 */
export interface EventStatusItem extends SaplingGenericItem {
  /** Unique handle for the event status (e.g., 'scheduled', 'completed'). */
  handle: string
  /** Description of the status (display name). */
  description: string
  /** Color code (e.g., hex or color name) for UI representation. */
  color: string
  /** Indicates whether events with this status are treated as open. */
  isOpen?: boolean
  /** Configurable display order. */
  sortOrder?: number | null
  /** All events that have this status. */
  events?: EventItem[]
  /** Date and time when the status was created. */
  createdAt: Date | null
  /** Date and time when the status was last updated. */
  updatedAt?: Date | null
}

/**
 * Represents an event appointment type entity.
 */
export interface EventTypeItem extends SaplingGenericItem {
  /** Unique identifier for the event type */
  handle: string
  /** Title or name of the event type */
  title: string
  /** Icon representing the event type */
  icon: string | null
  /** Color used for displaying the event type */
  color: string
  /** Indicates whether events of this type belong in the standard calendar view */
  isStandardCalendar?: boolean
  /** Indicates whether events of this type are shown in the default calendar view and synchronized externally */
  showInDefaultCalendar?: boolean
  /** Events belonging to this event type */
  events?: EventItem[]
  /** Date and time when the event type was created */
  createdAt: Date | null
  /** Date and time when the event type was last updated */
  updatedAt?: Date | null
}

/**
 * Represents a business category that can be combined with an event type.
 */
export interface EventCategoryItem extends SaplingGenericItem {
  /** Unique identifier for the event category */
  handle: string
  /** Title or name of the event category */
  title: string
  /** Icon representing the event category */
  icon: string
  /** Color used for displaying the event category */
  color: string
  /** Events belonging to this category */
  events?: EventItem[]
  /** Date and time when the category was created */
  createdAt?: Date | null
  /** Date and time when the category was last updated */
  updatedAt?: Date | null
}

/**
 * Represents a work hour interval entity.
 */
export interface WorkHourItem extends SaplingGenericItem {
  /** Unique identifier for the work hour interval */
  handle: number | null
  /** Title of the work hour entry */
  title: string
  /** Start time of the work interval (HH:mm:ss) */
  timeFrom: string
  /** End time of the work interval (HH:mm:ss) */
  timeTo: string
  /** Date and time when the entry was created */
  createdAt: Date | null
  /** Date and time when the entry was last updated */
  updatedAt?: Date | null
}

/**
 * Represents a work hour week entity.
 */
export interface WorkHourWeekItem extends SaplingGenericItem {
  /** Unique identifier for the work hour week */
  handle: number | null
  /** Title of the work hour week */
  title: string
  /** Work hours for Monday */
  monday?: WorkHourItem | null
  /** Work hours for Tuesday */
  tuesday?: WorkHourItem | null
  /** Work hours for Wednesday */
  wednesday?: WorkHourItem | null
  /** Work hours for Thursday */
  thursday?: WorkHourItem | null
  /** Work hours for Friday */
  friday?: WorkHourItem | null
  /** Work hours for Saturday */
  saturday?: WorkHourItem | null
  /** Work hours for Sunday */
  sunday?: WorkHourItem | null
  /** List of companies using this work hour week */
  companies?: CompanyItem[]
  /** List of persons using this work hour week */
  persons?: PersonItem[]
  /** Date and time when the entry was created */
  createdAt: Date | null
  /** Date and time when the entry was last updated */
  updatedAt?: Date | null
}
