import { ref } from 'vue'
import type { PhoneCallItem } from '@/entity/entity'
import { DEFAULT_ENTITY_ITEMS_COUNT } from '@/constants/project.constants'
import ApiGenericService from '@/services/api.generic.service'
import type {
  CrmCompany,
  CrmEvent,
  CrmOpportunity,
  CrmPerson,
} from '@/components/crm/crmWorkspace.types'
import {
  CRM_COMPANY_ENTITY,
  CRM_EVENT_ENTITY,
  CRM_OPPORTUNITY_ENTITY,
  CRM_PERSON_ENTITY,
  CRM_PHONE_CALL_ENTITY,
} from '@/components/crm/crmWorkspace.types'

const RELATIONS = {
  company: [
    'accountManager',
    'customerSuccessManager',
    'industry',
    'segment',
    'size',
    'annualRevenueClass',
    'churnRiskReason',
    'persons',
  ],
  person: ['company', 'salutation', 'title', 'jobTitle', 'jobFunction', 'decisionRole'],
  opportunity: [
    'type',
    'forecast',
    'source',
    'assigneeCompany',
    'assigneePerson',
    'creatorCompany',
    'creatorPerson',
    'events',
    'resultStatus',
    'lossReason',
    'competitors',
  ],
  event: [
    'type',
    'status',
    'assigneeCompany',
    'assigneePerson',
    'creatorCompany',
    'creatorPerson',
    'participants',
    'salesOpportunity',
  ],
  phoneCall: ['entity', 'person'],
}

export function useSaplingCrmWorkspaceData() {
  const companies = ref<CrmCompany[]>([])
  const people = ref<CrmPerson[]>([])
  const opportunities = ref<CrmOpportunity[]>([])
  const events = ref<CrmEvent[]>([])
  const phoneCalls = ref<PhoneCallItem[]>([])
  const isLoading = ref(false)
  const hasLoadedOnce = ref(false)

  async function loadData(): Promise<void> {
    isLoading.value = true
    try {
      const [company, person, opportunity, event, phoneCall] = await Promise.all([
        ApiGenericService.find<CrmCompany>(CRM_COMPANY_ENTITY, {
          orderBy: { annualRecurringRevenue: 'DESC', name: 'ASC' },
          limit: DEFAULT_ENTITY_ITEMS_COUNT,
          relations: RELATIONS.company,
        }),
        ApiGenericService.find<CrmPerson>(CRM_PERSON_ENTITY, {
          orderBy: { lastName: 'ASC', firstName: 'ASC' },
          limit: DEFAULT_ENTITY_ITEMS_COUNT,
          relations: RELATIONS.person,
        }),
        ApiGenericService.find<CrmOpportunity>(CRM_OPPORTUNITY_ENTITY, {
          orderBy: { closeDate: 'ASC', expectedRevenue: 'DESC' },
          limit: DEFAULT_ENTITY_ITEMS_COUNT,
          relations: RELATIONS.opportunity,
        }),
        ApiGenericService.find<CrmEvent>(CRM_EVENT_ENTITY, {
          orderBy: { startDate: 'DESC' },
          limit: DEFAULT_ENTITY_ITEMS_COUNT,
          relations: RELATIONS.event,
        }),
        ApiGenericService.find<PhoneCallItem>(CRM_PHONE_CALL_ENTITY, {
          orderBy: { createdAt: 'DESC' },
          limit: DEFAULT_ENTITY_ITEMS_COUNT,
          relations: RELATIONS.phoneCall,
        }),
      ])

      companies.value = company.data
      people.value = person.data
      opportunities.value = opportunity.data
      events.value = event.data
      phoneCalls.value = phoneCall.data
      hasLoadedOnce.value = true
    } finally {
      isLoading.value = false
    }
  }

  return {
    companies,
    events,
    hasLoadedOnce,
    isLoading,
    loadData,
    opportunities,
    people,
    phoneCalls,
  }
}
