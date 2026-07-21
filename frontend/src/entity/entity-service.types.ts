import type { PersonItem } from './entity-account.types'
import type { SaplingGenericItem } from './entity-base.types'
import type {
  CompanyItem,
  EffortEstimateItem,
  ProductItem,
  SalesOpportunityItem,
} from './entity-customer.types'

/**
 * Represents a curated knowledge-base article.
 */
export interface KnowledgeArticleItem extends SaplingGenericItem {
  /** Unique identifier for the article */
  handle?: number | null
  /** Article title */
  title: string
  /** Current lifecycle status */
  status?: KnowledgeArticleStatusItem | string | null
  /** Intended article visibility */
  visibility?: KnowledgeArticleVisibilityItem | string | null
  /** Optional category */
  category?: KnowledgeArticleCategoryItem | string | null
  /** Optional product */
  product?: ProductItem | number | null
  /** Short summary */
  summary?: string | null
  /** Comma-separated tags */
  tags?: string | null
  /** Stable page or workflow key used for contextual help */
  contextKey?: string | null
  /** Problem or question text written in markdown */
  problemMarkdown?: string | null
  /** Solution or answer text written in markdown */
  solutionMarkdown?: string | null
  /** Documentation text written in markdown */
  documentationMarkdown?: string | null
  /** Whether the article is active */
  isActive?: boolean
  /** Publication timestamp */
  publishedAt?: Date | null
  /** Optional validity date */
  validUntil?: Date | null
  /** Source ticket */
  sourceTicket?: TicketItem | number | null
  /** Source sales opportunity */
  sourceSalesOpportunity?: SalesOpportunityItem | number | null
  /** Source effort estimate */
  sourceEffortEstimate?: EffortEstimateItem | number | null
  /** Author */
  authorPerson?: PersonItem | number | null
  /** Reviewer */
  reviewerPerson?: PersonItem | number | null
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a knowledge article status.
 */
export interface KnowledgeArticleStatusItem extends SaplingGenericItem {
  /** Unique status key */
  handle: string
  /** Display description */
  description: string
  /** UI color */
  color: string
  /** UI icon */
  icon?: string | null
  /** Sort order */
  sortOrder?: number | null
  /** Whether this status means published */
  isPublished?: boolean
  /** Whether this status means archived */
  isArchived?: boolean
  /** Articles in this status */
  articles?: KnowledgeArticleItem[]
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a knowledge article visibility.
 */
export interface KnowledgeArticleVisibilityItem extends SaplingGenericItem {
  /** Unique visibility key */
  handle: string
  /** Display description */
  description: string
  /** UI color */
  color: string
  /** UI icon */
  icon?: string | null
  /** Sort order */
  sortOrder?: number | null
  /** Articles with this visibility */
  articles?: KnowledgeArticleItem[]
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a knowledge article category.
 */
export interface KnowledgeArticleCategoryItem extends SaplingGenericItem {
  /** Unique category key */
  handle: string
  /** Display title */
  title: string
  /** Optional description */
  description?: string | null
  /** UI icon */
  icon: string
  /** UI color */
  color: string
  /** Sort order */
  sortOrder?: number | null
  /** Whether the category is active */
  isActive?: boolean
  /** Articles in this category */
  articles?: KnowledgeArticleItem[]
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents an internal office case.
 */
export interface InternalCaseItem extends SaplingGenericItem {
  /** Unique identifier for the internal case */
  handle?: number | null
  /** Generated visible case number */
  number?: string | null
  /** Short title */
  title: string
  /** Current status */
  status?: InternalCaseStatusItem | string | null
  /** Case category */
  category: InternalCaseCategoryItem | string
  /** Request content */
  requestMarkdown?: string | null
  /** Internal notes and background information */
  internalInformationMarkdown?: string | null
  /** Customer company */
  customerCompany?: CompanyItem | number | null
  /** Customer person */
  customerPerson?: PersonItem | number | null
  /** Responsible company */
  responsibleCompany?: CompanyItem | number | null
  /** Responsible person */
  responsiblePerson?: PersonItem | number | null
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents an internal office case status.
 */
export interface InternalCaseStatusItem extends SaplingGenericItem {
  /** Unique status handle */
  handle: string
  /** Display label */
  description: string
  /** UI color */
  color: string
  /** UI icon */
  icon?: string | null
  /** Whether cases in this status are open tasks */
  isOpen?: boolean | null
  /** Cases using this status */
  internalCases?: InternalCaseItem[]
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents an internal office case category.
 */
export interface InternalCaseCategoryItem extends SaplingGenericItem {
  /** Unique category handle */
  handle: string
  /** Display title */
  title: string
  /** UI icon */
  icon?: string | null
  /** UI color */
  color?: string | null
  /** Cases using this category */
  internalCases?: InternalCaseItem[]
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a ticket entity.
 */
export interface TicketItem extends SaplingGenericItem {
  /** Unique identifier for the ticket */
  handle: number | null
  /** Title of the ticket */
  title: string
  /** Description of the problem */
  problemDescription?: string
  /** Description of the solution */
  solutionDescription?: string
  /** Start date of the ticket */
  startDate?: Date | null
  /** End date of the ticket */
  endDate?: Date | null
  /** Deadline date of the ticket */
  deadlineDate?: Date | null
  /** Person assigned to the ticket */
  assignee?: PersonItem
  /** Person who created the ticket */
  creator?: PersonItem
  /** Status of the ticket */
  status?: TicketStatusItem | null
  /** Priority of the ticket */
  priority?: TicketPriorityItem | null
  /** Related effort estimates */
  effortEstimates?: EffortEstimateItem[]
  /** Creation date */
  createdAt: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a ticket priority entity.
 */
export interface TicketPriorityItem extends SaplingGenericItem {
  /** Unique identifier for the priority */
  handle: string
  /** Description of the priority */
  description: string
  /** Color associated with the priority */
  color: string
  /** List of tickets with this priority */
  tickets?: TicketItem[]
  /** Creation date */
  createdAt: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a ticket status entity.
 */
export interface TicketStatusItem extends SaplingGenericItem {
  /** Unique identifier for the status */
  handle: string
  /** Description of the status */
  description: string
  /** Color associated with the status */
  color: string
  /** Whether tickets with this status are treated as open */
  isOpen?: boolean | null
  /** List of tickets with this status */
  tickets?: TicketItem[]
  /** Creation date */
  createdAt: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a ticket time tracking entry (work log for a ticket).
 */
export interface TicketTimeTrackingItem extends SaplingGenericItem {
  /** Unique identifier for the time tracking entry */
  handle?: number
  /** Title of the time tracking entry */
  title: string
  /** Description of the time tracking entry */
  description: string
  /** Person who performed the work */
  person: PersonItem
  /** Ticket to which this time entry belongs */
  ticket: TicketItem
  /** Start time of the tracked work interval */
  startTime: Date
  /** End time of the tracked work interval */
  endTime: Date
  /** Date and time when the entry was created */
  createdAt?: Date | null
  /** Date and time when the entry was last updated */
  updatedAt?: Date | null
}
