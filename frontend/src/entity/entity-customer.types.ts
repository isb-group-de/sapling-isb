import type { PersonItem } from './entity-account.types'
import type { SaplingGenericItem } from './entity-base.types'
import type { EventItem, HolidayGroupItem, WorkHourWeekItem } from './entity-calendar.types'
import type { TicketItem } from './entity-service.types'

/**
 * Represents a company entity.
 */
export interface CompanyItem extends SaplingGenericItem {
  /** Unique identifier for the company */
  handle: number
  /** Name of the company */
  name: string
  /** Street address */
  street?: string | null
  /** ZIP code */
  zip?: string | null
  /** City */
  city?: string | null
  /** Phone number */
  phone?: string | null
  /** Email address */
  email?: string | null
  /** Website URL */
  website?: string | null
  /** Whether the company is active */
  isActive: boolean | null
  /** Company country */
  country?: CountryItem | string | null
  /** Assigned holiday group */
  holidayGroup?: HolidayGroupItem | number | null
  /** Assigned work hour week */
  workWeek?: WorkHourWeekItem | number | null
  /** List of persons associated with the company */
  persons?: PersonItem[]
  /** List of contracts associated with the company */
  contracts?: ContractItem[]
  /** Creation date */
  createdAt: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a country entity.
 */
export interface CountryItem extends SaplingGenericItem {
  /** ISO country handle */
  handle: string
  /** Country display name */
  name: string
  /** International dialing code derived from the country handle */
  dialingCode?: string | null
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a contract entity.
 */
export interface ContractItem extends SaplingGenericItem {
  /** Unique identifier for the contract */
  handle: number | null
  /** Title of the contract */
  title: string
  /** Description of the contract */
  description?: string
  /** Start date of the contract */
  startDate: Date
  /** End date of the contract */
  endDate?: Date | null
  /** Whether the contract is active */
  isActive: boolean | null
  /** Associated company */
  company: CompanyItem
  /** List of products associated with the contract */
  products?: ProductItem[]
  /** Creation date */
  createdAt: Date
  /** Last update date */
  updatedAt?: Date
}

/**
 * Represents a product entity.
 */
export interface ProductItem extends SaplingGenericItem {
  /** Unique identifier for the product */
  handle: number | null
  /** Title of the product */
  title: string
  /** Name of the product */
  name: string
  /** Version of the product */
  version?: string | null
  /** Description of the product */
  description?: string
  /** List of contracts associated with the product */
  contracts?: ContractItem[]
  /** Creation date */
  createdAt: Date
  /** Last update date */
  updatedAt?: Date
}

/**
 * Represents a sales opportunity entity.
 */
export interface SalesOpportunityItem extends SaplingGenericItem {
  /** Unique identifier for the sales opportunity */
  handle?: number | null
  /** Title of the sales opportunity */
  title: string
  /** Optional description */
  description?: string | null
  /** Expected revenue for the opportunity */
  expectedRevenue?: number | null
  /** Probability of winning the opportunity */
  probability?: number | null
  /** Expected close date */
  closeDate?: Date | null
  /** Next planned action */
  nextStep?: string | null
  /** Customer pain points */
  painPoints?: string | null
  /** Whether the opportunity is active */
  isActive?: boolean | null
  /** Current stage */
  type?: SalesOpportunityStageItem | null
  /** Forecast classification */
  forecast?: SalesOpportunityForecastItem | null
  /** Lead source */
  source?: SalesOpportunitySourceItem | null
  /** Win/loss result status */
  resultStatus?: SalesOpportunityResultStatusItem | null
  /** Assigned company */
  assigneeCompany?: CompanyItem | null
  /** Assigned person */
  assigneePerson?: PersonItem | null
  /** Creating company */
  creatorCompany?: CompanyItem | null
  /** Creating person */
  creatorPerson?: PersonItem | null
  /** Related tickets */
  tickets?: TicketItem[]
  /** Related events */
  events?: EventItem[]
  /** Related effort estimates */
  effortEstimates?: EffortEstimateItem[]
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a sales opportunity stage.
 */
export interface SalesOpportunityStageItem extends SaplingGenericItem {
  /** Unique identifier for the stage */
  handle: string
  /** Display title */
  title: string
  /** Optional business description */
  description?: string | null
  /** Icon used in the UI */
  icon?: string | null
  /** Accent color */
  color: string
  /** Pipeline ordering */
  sortOrder?: number | null
  /** Suggested probability for this stage */
  defaultProbability?: number | null
  /** Whether the stage closes the opportunity */
  isClosed?: boolean | null
  /** Whether the stage counts as a success */
  isSuccess?: boolean | null
  /** Opportunities in this stage */
  salesOpportunities?: SalesOpportunityItem[]
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a sales opportunity forecast category.
 */
export interface SalesOpportunityForecastItem extends SaplingGenericItem {
  /** Unique identifier for the forecast */
  handle: string
  /** Display title */
  title: string
  /** Optional icon */
  icon?: string | null
  /** Accent color */
  color: string
  /** Opportunities in this forecast */
  salesOpportunities?: SalesOpportunityItem[]
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a sales opportunity win/loss result status.
 */
export interface SalesOpportunityResultStatusItem extends SaplingGenericItem {
  /** Unique identifier for the result status */
  handle: string
  /** Display title */
  title: string
  /** Whether the result closes the opportunity */
  isClosed?: boolean | null
  /** Whether the result counts as a success */
  isSuccess?: boolean | null
  /** Whether opportunities with this result status are treated as open */
  isOpen?: boolean | null
  /** Optional icon */
  icon?: string | null
  /** Accent color */
  color: string
  /** Sort order */
  sortOrder?: number | null
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a sales opportunity source.
 */
export interface SalesOpportunitySourceItem extends SaplingGenericItem {
  /** Unique identifier for the source */
  handle?: number | null
  /** Display title */
  title: string
  /** Technical/source name */
  name: string
  /** Opportunities tied to this source */
  salesOpportunities?: SalesOpportunityItem[]
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents an effort estimate.
 */
export interface EffortEstimateItem extends SaplingGenericItem {
  /** Unique identifier for the effort estimate */
  handle?: number | null
  /** Title of the estimate */
  title: string
  /** Current estimate status */
  status?: EffortEstimateStatusItem | string | null
  /** Expected date for finishing the estimate */
  expectedCompletionDate?: Date | null
  /** Requirements written in markdown */
  requirementsMarkdown?: string | null
  /** Whether the estimate is active */
  isActive?: boolean
  /** Calculated total across positions */
  totalEstimatedHours?: number | null
  /** Responsible company */
  assigneeCompany?: CompanyItem | null
  /** Responsible person */
  assigneePerson?: PersonItem | null
  /** Customer company */
  creatorCompany?: CompanyItem | null
  /** Customer person */
  creatorPerson?: PersonItem | null
  /** Related sales opportunity */
  salesOpportunity?: SalesOpportunityItem | null
  /** Related ticket */
  ticket?: TicketItem | null
  /** Estimate positions */
  positions?: EffortEstimatePositionItem[]
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a status for effort estimates.
 */
export interface EffortEstimateStatusItem extends SaplingGenericItem {
  /** Unique status key */
  handle: string
  /** Display description */
  description: string
  /** UI color */
  color: string
  /** UI icon */
  icon?: string | null
  /** Estimates in this status */
  effortEstimates?: EffortEstimateItem[]
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a single effort estimate position.
 */
export interface EffortEstimatePositionItem extends SaplingGenericItem {
  /** Unique identifier for the position */
  handle?: number | null
  /** Position title */
  title: string
  /** Estimated effort in hours */
  estimatedHours?: number | null
  /** Offer text written in markdown */
  offerTextMarkdown?: string | null
  /** Sort order within the estimate */
  sortOrder?: number | null
  /** Whether the position is optional */
  isOptional?: boolean
  /** Parent estimate */
  estimate: EffortEstimateItem | number
  /** Optional source template */
  template?: EffortEstimatePositionTemplateItem | number | null
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a reusable template for effort estimate positions.
 */
export interface EffortEstimatePositionTemplateItem extends SaplingGenericItem {
  /** Unique identifier for the template */
  handle?: number | null
  /** Template title */
  title: string
  /** Optional description */
  description?: string | null
  /** Suggested effort in hours */
  estimatedHours?: number | null
  /** Offer text written in markdown */
  offerTextMarkdown: string
  /** Whether the template is active */
  isActive?: boolean
  /** Positions created from this template */
  positions?: EffortEstimatePositionItem[]
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}
