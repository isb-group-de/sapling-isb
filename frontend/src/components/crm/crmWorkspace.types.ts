import type { CompanyItem, EventItem, PersonItem, SalesOpportunityItem } from '@/entity/entity'

export type CrmCockpitKey = 'sales' | 'account' | 'customerSuccess'
export type CrmSignalKey = 'noActivity' | 'contactGaps' | 'risks'

export interface CrmRelationHandle {
  handle?: string | number | null
  title?: string | null
  name?: string | null
  firstName?: string | null
  lastName?: string | null
  color?: string | null
  icon?: string | null
  isClosed?: boolean | null
  isSuccess?: boolean | null
}

export interface CrmCompany extends CompanyItem {
  accountManager?: PersonItem | number | null
  customerSuccessManager?: PersonItem | number | null
  segment?: CrmRelationHandle | string | null
  industry?: CrmRelationHandle | string | null
  size?: CrmRelationHandle | string | null
  annualRevenueClass?: CrmRelationHandle | string | null
  churnRiskReason?: CrmRelationHandle | string | null
  annualRecurringRevenue?: number | null
  monthlyRecurringRevenue?: number | null
  contractValue?: number | null
  dataPrivacyConsentGiven?: boolean | null
  dataPrivacyConsentAt?: Date | string | null
}

export interface CrmPerson extends PersonItem {
  salutation?: CrmRelationHandle | string | null
  title?: CrmRelationHandle | string | null
  jobTitle?: CrmRelationHandle | string | null
  jobFunction?: CrmRelationHandle | string | null
  decisionRole?: CrmRelationHandle | string | null
}

export interface CrmOpportunity extends Omit<SalesOpportunityItem, 'events'> {
  resultStatus?: CrmRelationHandle | string | null
  lossReason?: CrmRelationHandle | string | null
  competitors?: CrmCompany[] | number[]
  events?: CrmEvent[]
}

export interface CrmEvent extends Omit<
  EventItem,
  'creatorCompany' | 'creatorPerson' | 'participants'
> {
  assigneeCompany?: CrmCompany | number | null
  assigneePerson?: CrmPerson | number | null
  creatorCompany?: CrmCompany | number | null
  creatorPerson?: CrmPerson | number | null
  salesOpportunity?: CrmOpportunity | number | null
  participants?: CrmPerson[]
}

export interface CrmWorkspaceItem {
  id: string
  entity: 'company' | 'person' | 'salesOpportunity'
  handle: string | number | null | undefined
  title: string
  subtitle: string
  value?: string
  badge?: string
  owner?: string
  tone?: 'default' | 'info' | 'success' | 'warning' | 'error'
  icon?: string
}

export interface CrmStageBreakdown {
  key: string
  label: string
  count: number
  value: number
  color: string
}

export interface CrmSignal {
  key: CrmSignalKey
  icon: string
  label: string
  value: string
}

export const CRM_COMPANY_ENTITY = 'company'
export const CRM_PERSON_ENTITY = 'person'
export const CRM_OPPORTUNITY_ENTITY = 'salesOpportunity'
export const CRM_EVENT_ENTITY = 'event'
export const CRM_PHONE_CALL_ENTITY = 'phoneCall'
