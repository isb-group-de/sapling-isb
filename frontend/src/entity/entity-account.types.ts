import type { SaplingGenericItem } from './entity-base.types'
import type { HolidayGroupItem, WorkHourWeekItem } from './entity-calendar.types'
import type { CompanyItem } from './entity-customer.types'
import type { DashboardItem, EntityItem, FavoriteItem, LanguageItem } from './entity-platform.types'
import type { TicketItem } from './entity-service.types'

/**
 * Represents a reusable Sapling inbox template.
 */
export interface InboxTemplateItem extends SaplingGenericItem {
  /** Numeric primary key */
  handle?: number | null
  /** Internal display name for admins */
  name: string
  /** Optional description */
  description?: string | null
  /** Title template rendered for each notification */
  titleTemplate: string
  /** Markdown body template rendered for each notification */
  bodyMarkdown: string
  /** Whether the template is the default choice */
  isDefault: boolean
  /** Whether the template is active */
  isActive: boolean
  /** Linked entity */
  entity: EntityItem | string
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a configurable Sapling inbox subscription.
 */
export interface InboxSubscriptionItem extends SaplingGenericItem {
  /** Numeric primary key */
  handle?: number | null
  /** Visible description */
  description: string
  /** Recipient field path resolved from the entity context */
  recipientField: string
  /** Also notify the actor when selected by the recipient field */
  notifyActor: boolean
  /** Whether the subscription is active */
  isActive: boolean
  /** Linked entity */
  entity: EntityItem | string
  /** Trigger type such as afterInsert */
  type: SaplingGenericItem | string
  /** Associated template */
  template: InboxTemplateItem | number
  /** Optional loaded notifications */
  notifications?: InboxNotificationItem[]
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a Sapling inbox notification stored for a recipient.
 */
export interface InboxNotificationItem extends SaplingGenericItem {
  /** Numeric primary key */
  handle?: number | null
  /** Linked entity */
  entity: EntityItem | string
  /** Origin subscription */
  subscription: InboxSubscriptionItem | number
  /** Optional source template */
  template?: InboxTemplateItem | number | null
  /** Recipient */
  recipientPerson: PersonItem | number
  /** Triggering user */
  createdBy: PersonItem | number
  /** Handle of the referenced domain record */
  referenceHandle?: string | null
  /** Rendered notification title */
  title: string
  /** Rendered markdown body */
  bodyMarkdown: string
  /** Rendered plain-text body */
  bodyText: string
  /** Stored request metadata */
  requestPayload?: Record<string, unknown> | null
  /** Whether the notification has been read */
  isRead: boolean
  /** Read timestamp */
  readAt?: Date | null
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a logged phone call attached to a record.
 */
export interface PhoneCallItem extends SaplingGenericItem {
  /** Unique identifier for the phone call record */
  handle: number | null
  /** Dialed phone number */
  phoneNumber: string
  /** Optional note for the call */
  note?: string | null
  /** Whether the target was reached */
  reached: boolean
  /** Associated parent entity */
  entity: EntityItem | string
  /** Parent record handle stored as string reference */
  reference: string
  /** Person who placed the call */
  person: PersonItem | number | null
  /** Creation date */
  createdAt: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a group of notes.
 */
export interface NoteGroupItem extends SaplingGenericItem {
  /** Unique identifier for the note group */
  handle: string
  /** Icon for the note group */
  icon: string | null
  /** List of notes in the group */
  notes?: NoteItem[]
  /** Creation date */
  createdAt: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a note entity.
 */
export interface NoteItem extends SaplingGenericItem {
  /** Unique identifier for the note */
  handle: number | null
  /** Title of the note */
  title: string
  /** Description of the note */
  description?: string
  /** Associated person (object or ID) */
  person?: PersonItem | number | null
  /** Associated note group (object or ID) */
  group?: NoteGroupItem | string | null
  /** Creation date */
  createdAt: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a permission for an entity and associated roles.
 */
export interface PermissionItem extends SaplingGenericItem {
  /** Permission to read */
  allowRead: boolean | null
  /** Permission to insert */
  allowInsert: boolean | null
  /** Permission to update */
  allowUpdate: boolean | null
  /** Permission to delete */
  allowDelete: boolean | null
  /** Permission to show */
  allowShow: boolean | null
  /** Associated entity */
  entity: EntityItem | string
  /** Associated roles */
  roles?: (RoleItem | number)[]
  /** Optional per-field restrictions */
  fieldPermissions?: FieldPermissionItem[]
  /** Creation date */
  createdAt: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

export interface FieldPermissionItem extends SaplingGenericItem {
  handle?: number | null
  permission: PermissionItem | number
  fieldName: string
  allowRead: boolean
  allowInsert: boolean
  allowUpdate: boolean
  createdAt?: Date | null
  updatedAt?: Date | null
}

/**
 * Represents a person entity.
 */
export interface PersonItem extends SaplingGenericItem {
  /** Unique identifier for the person */
  handle: number | null
  /** First name */
  firstName?: string | null
  /** Last name */
  lastName: string
  /** Login name */
  loginName?: string | null
  /** Login password */
  loginPassword?: string | null
  /** Phone number */
  phone?: string | null
  /** Mobile number */
  mobile?: string | null
  /** Email address */
  email?: string | null
  /** Birthday */
  birthDay?: Date | null
  /** Whether password change is required */
  requirePasswordChange: boolean | null
  /** Whether the person is active */
  isActive: boolean | null
  /** Associated company */
  company?: CompanyItem | null
  /** Assigned holiday group */
  holidayGroup?: HolidayGroupItem | number | null
  /** Preferred language */
  language?: LanguageItem | null
  /** Assigned work hour week */
  workWeek?: WorkHourWeekItem | number | null
  /** Authentication/provider type for this person */
  type?: PersonTypeItem | string | null
  /** List of roles assigned to the person */
  roles?: (RoleItem | string)[]
  /** Tickets assigned to the person */
  assignedTickets?: TicketItem[]
  /** Tickets created by the person */
  createdTickets?: TicketItem[]
  /** Notes created by the person */
  notes?: NoteItem[]
  /** Dashboards owned by this person */
  dashboards?: DashboardItem[]
  /** Shared mailbox groups this person may use as sender pools */
  sharedMailboxGroups?: SharedMailboxGroupItem[]
  /** List of favorites referencing this person */
  favorites?: FavoriteItem[]
  /** Passkeys registered for local Sapling login */
  passkeys?: PersonPasskeyItem[]
  /** Preferred color */
  color?: string | null
  /** Creation date */
  createdAt: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a local Sapling passkey credential.
 */
export interface PersonPasskeyItem extends SaplingGenericItem {
  /** Unique identifier for the passkey */
  handle: number | null
  /** Human-readable passkey label */
  label: string
  /** WebAuthn credential ID */
  credentialId?: string
  /** WebAuthn credential public key */
  publicKey?: string
  /** WebAuthn signature counter */
  counter: number
  /** Authenticator transports */
  transports?: string[]
  /** WebAuthn credential device type */
  credentialDeviceType?: string | null
  /** Whether the credential is backed up by the authenticator ecosystem */
  credentialBackedUp: boolean
  /** Last successful passkey use */
  lastUsedAt?: Date | null
  /** The person this passkey belongs to */
  person: PersonItem | number
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a person session entity (authentication session for a person).
 */
export interface PersonSessionItem extends SaplingGenericItem {
  /** Session number for the session (not primary key) */
  number: string
  /** Access token for the session */
  accessToken: string
  /** Refresh token for the session */
  refreshToken: string
  /** The person this session belongs to */
  person: PersonItem
  /** Date and time when the session was created */
  createdAt?: Date | null
  /** Date and time when the session was last updated */
  updatedAt?: Date | null
}

/**
 * Represents a person type entity (classification for persons).
 */
export interface PersonTypeItem extends SaplingGenericItem {
  /** Unique identifier for the person type (primary key) */
  handle: string
  /** Icon representing the person type */
  icon?: string
  /** Color used for displaying the person type */
  color: string
  /** Persons belonging to this type */
  persons?: PersonItem[]
  /** Date and time when the type was created */
  createdAt?: Date | null
  /** Date and time when the type was last updated */
  updatedAt?: Date | null
}

export interface SharedMailboxGroupItem extends SaplingGenericItem {
  /** Unique identifier for the shared mailbox group */
  handle?: number | null
  /** Visible title */
  title: string
  /** Optional description */
  description?: string | null
  /** Icon used in the UI */
  icon: string
  /** Accent color */
  color: string
  /** Whether the group is active */
  isActive: boolean
  /** Mailboxes in this group */
  items?: SharedMailboxItem[]
  /** Assigned persons */
  persons?: (PersonItem | number)[]
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

export interface SharedMailboxItem extends SaplingGenericItem {
  /** Unique identifier for the shared mailbox */
  handle?: number | null
  /** Visible title */
  title: string
  /** Sender email address */
  email: string
  /** Optional description */
  description?: string | null
  /** Mail provider reference, for example azure or google */
  provider: PersonTypeItem | string
  /** Whether the mailbox is active */
  isActive: boolean
  /** Optional group */
  group?: SharedMailboxGroupItem | number | null
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a role entity.
 */
export interface RoleItem extends SaplingGenericItem {
  /** Unique identifier for the role */
  handle: number | null
  /** Title of the role */
  title: string
  /** Whether the role grants administrator access */
  isAdministrator: boolean
  /** List of persons assigned to the role */
  persons?: PersonItem[]
  /** List of permissions for the role */
  permissions?: PermissionItem[]
  /** Associated stage */
  stage: RoleStageItem
  /** Creation date */
  createdAt: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a stage for a role.
 */
export interface RoleStageItem extends SaplingGenericItem {
  /** Unique identifier for the stage */
  handle: string
  /** Title of the stage */
  title: string
  /** List of roles in this stage */
  roles?: RoleItem[]
  /** Creation date */
  createdAt: Date | null
  /** Last update date */
  updatedAt?: Date | null
}
