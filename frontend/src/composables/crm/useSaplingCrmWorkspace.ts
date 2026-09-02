import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { useGenericStore } from '@/stores/genericStore'
import { pushAppRoute } from '@/utils/routerNavigation'
import type {
  CrmCockpitKey,
  CrmCompany,
  CrmOpportunity,
  CrmPerson,
  CrmSignal,
  CrmStageBreakdown,
  CrmWorkspaceItem,
} from '@/components/crm/crmWorkspace.types'
import {
  CRM_COMPANY_ENTITY,
  CRM_OPPORTUNITY_ENTITY,
  CRM_PERSON_ENTITY,
} from '@/components/crm/crmWorkspace.types'
import {
  companyValue,
  diffInDays,
  getOpportunityUrgencyTone,
  getRelationHandle,
  isCustomerCompany,
  isOpportunityOpen,
  normalizeMoney,
  normalizeProbability,
  normalizeText,
  parseDate,
  relationLabel,
  relationObject,
  startOfDay,
  updateLatestDate,
} from '@/components/crm/crmWorkspace.utils'
import { useSaplingCrmWorkspaceData } from './useSaplingCrmWorkspaceData'
import {
  buildContactThresholdOptions,
  buildOpportunityHorizonOptions,
  createCrmSignal,
  formatCrmDate,
  formatCrmMoney,
} from './crmWorkspacePresentation.utils'
import {
  matchesCrmOpportunityHorizon,
  matchesCrmResponsible,
  matchesCrmSearch,
  matchesCrmSegment,
} from './crmWorkspaceFilter.utils'

export function useSaplingCrmWorkspace() {
  const { t, d, n, locale } = useI18n()
  const router = useRouter()
  const genericStore = useGenericStore()
  const currentPersonStore = useCurrentPersonStore()
  const data = useSaplingCrmWorkspaceData()

  const activeCockpit = ref<CrmCockpitKey>('sales')
  const contactThresholdDays = ref(45)
  const opportunityHorizonDays = ref<number | null>(null)
  const search = ref('')
  const selectedResponsibleHandle = ref<string | null>(null)
  const selectedSegmentHandle = ref<string | null>(null)
  const defaultResponsibleHandle = ref<string | null>(null)
  const isPreparing = ref(true)

  const contactThresholdOptions = computed(() => buildContactThresholdOptions(t))
  const opportunityHorizonOptions = computed(() => buildOpportunityHorizonOptions(t))
  const companyByHandle = computed(
    () => new Map(data.companies.value.map((company) => [String(company.handle), company])),
  )
  const personByHandle = computed(
    () =>
      new Map(
        data.people.value
          .filter((person) => person.handle != null)
          .map((person) => [String(person.handle), person]),
      ),
  )
  const responsiblePersonOptions = computed(() => [
    { title: t('crmWorkspace.allResponsible'), value: null },
    ...data.people.value
      .filter((person) => person.handle != null)
      .map((person) => ({ title: personLabel(person), value: String(person.handle) }))
      .sort((left, right) => left.title.localeCompare(right.title)),
  ])
  const segmentOptions = computed(() => {
    const values = new Map<string, string>()
    data.companies.value.forEach((company) => {
      const handle = getRelationHandle(company.segment)
      if (handle == null) return
      values.set(String(handle), relationLabel(company.segment) || String(handle))
    })
    return [
      { title: t('crmWorkspace.allSegments'), value: null },
      ...[...values.entries()]
        .map(([value, title]) => ({ title, value }))
        .sort((left, right) => left.title.localeCompare(right.title)),
    ]
  })
  const normalizedSearch = computed(() => normalizeText(search.value))

  const filteredCompanies = computed(() =>
    data.companies.value.filter(
      (company) =>
        matchesCrmSearch(
          normalizedSearch.value,
          company.name,
          relationLabel(company.segment),
          relationLabel(company.industry),
          accountOwnerLabel(company),
          csOwnerLabel(company),
        ) &&
        matchesCrmResponsible(
          selectedResponsibleHandle.value,
          company.accountManager,
          company.customerSuccessManager,
        ) &&
        matchesCrmSegment(company, activeCockpit.value, selectedSegmentHandle.value),
    ),
  )
  const filteredOpenOpportunities = computed(() =>
    data.opportunities.value
      .filter(isOpportunityOpen)
      .filter(
        (opportunity) =>
          matchesCrmSearch(
            normalizedSearch.value,
            opportunity.title,
            opportunity.nextStep,
            companyLabel(opportunity.assigneeCompany ?? opportunity.creatorCompany),
            personLabel(opportunity.assigneePerson ?? opportunity.creatorPerson),
          ) &&
          matchesCrmResponsible(
            selectedResponsibleHandle.value,
            opportunity.assigneePerson,
            opportunity.creatorPerson,
          ) &&
          matchesCrmOpportunityHorizon(
            opportunity,
            activeCockpit.value,
            opportunityHorizonDays.value,
          ),
      ),
  )

  const opportunityFutureActivity = computed(() => {
    const today = startOfDay(new Date())
    const result = new Set<string>()
    data.opportunities.value.forEach((opportunity) => {
      const hasFutureEvent = (opportunity.events ?? []).some((event) => {
        const startDate = parseDate(event.startDate)
        return Boolean(startDate && startOfDay(startDate) >= today)
      })
      if (hasFutureEvent && opportunity.handle != null) result.add(String(opportunity.handle))
    })
    data.events.value.forEach((event) => {
      const startDate = parseDate(event.startDate)
      const opportunityHandle = getRelationHandle(event.salesOpportunity)
      if (startDate && startOfDay(startDate) >= today && opportunityHandle != null) {
        result.add(String(opportunityHandle))
      }
    })
    return result
  })

  const lastCompanyContact = computed(() => {
    const result = new Map<string, Date>()
    data.phoneCalls.value.forEach((phoneCall) => {
      if (getRelationHandle(phoneCall.entity) === CRM_COMPANY_ENTITY) {
        updateLatestDate(result, String(phoneCall.reference), parseDate(phoneCall.createdAt))
      }
    })
    data.events.value.forEach((event) => {
      const eventDate = parseDate(event.endDate) ?? parseDate(event.startDate)
      if (!eventDate || eventDate > new Date()) return
      ;[event.assigneeCompany, event.creatorCompany].forEach((company) => {
        const handle = getRelationHandle(company)
        if (handle != null) updateLatestDate(result, String(handle), eventDate)
      })
    })
    data.people.value.forEach((person) => {
      const companyHandle = getRelationHandle(person.company)
      if (companyHandle == null || person.handle == null) return
      data.phoneCalls.value.forEach((phoneCall) => {
        if (
          getRelationHandle(phoneCall.entity) === CRM_PERSON_ENTITY &&
          String(phoneCall.reference) === String(person.handle)
        ) {
          updateLatestDate(result, String(companyHandle), parseDate(phoneCall.createdAt))
        }
      })
    })
    return result
  })

  const customersWithoutContact = computed(() => {
    const today = startOfDay(new Date())
    return filteredCompanies.value
      .filter(isCustomerCompany)
      .map((company) => {
        const lastContact = lastCompanyContact.value.get(String(company.handle)) ?? null
        return {
          company,
          days: lastContact ? diffInDays(today, startOfDay(lastContact)) : Number.POSITIVE_INFINITY,
        }
      })
      .filter((entry) => entry.days >= contactThresholdDays.value)
      .sort(
        (left, right) =>
          right.days - left.days || companyValue(right.company) - companyValue(left.company),
      )
  })
  const opportunitiesWithoutNextActivity = computed(() =>
    filteredOpenOpportunities.value
      .filter(
        (opportunity) =>
          opportunity.handle != null &&
          !opportunityFutureActivity.value.has(String(opportunity.handle)),
      )
      .sort((left, right) => {
        const leftDate = parseDate(left.closeDate)?.getTime() ?? Number.MAX_SAFE_INTEGER
        const rightDate = parseDate(right.closeDate)?.getTime() ?? Number.MAX_SAFE_INTEGER
        return (
          leftDate - rightDate ||
          normalizeMoney(right.expectedRevenue) - normalizeMoney(left.expectedRevenue)
        )
      }),
  )

  const customersWithoutContactItems = computed<CrmWorkspaceItem[]>(() =>
    customersWithoutContact.value.slice(0, 12).map(({ company, days }) => ({
      id: `company-contact-${company.handle}`,
      entity: CRM_COMPANY_ENTITY,
      handle: company.handle,
      title: company.name,
      subtitle: relationLabel(company.segment) || relationLabel(company.industry),
      owner: accountOwnerLabel(company),
      value: Number.isFinite(days)
        ? t('crmWorkspace.daysAgo', { count: days })
        : t('crmWorkspace.noContact'),
      badge: relationLabel(company.segment),
      tone: days >= 90 ? 'error' : 'warning',
      icon: 'mdi-account-clock-outline',
    })),
  )
  const opportunitiesWithoutNextActivityItems = computed<CrmWorkspaceItem[]>(() =>
    opportunitiesWithoutNextActivity.value.slice(0, 12).map((opportunity) => ({
      id: `opportunity-activity-${opportunity.handle}`,
      entity: CRM_OPPORTUNITY_ENTITY,
      handle: opportunity.handle,
      title: opportunity.title,
      subtitle: companyLabel(opportunity.assigneeCompany ?? opportunity.creatorCompany),
      owner: opportunityOwnerLabel(opportunity),
      value: formatMoney(opportunity.expectedRevenue),
      badge: formatDate(opportunity.closeDate),
      tone: getOpportunityUrgencyTone(opportunity),
      icon: 'mdi-calendar-alert-outline',
    })),
  )
  const atRiskCustomerItems = computed<CrmWorkspaceItem[]>(() =>
    filteredCompanies.value
      .filter(
        (company) =>
          isCustomerCompany(company) &&
          (company.churnRiskReason || isCompanyContactOverdue(company)),
      )
      .sort((left, right) => companyRiskScore(right) - companyRiskScore(left))
      .slice(0, 12)
      .map((company) => ({
        id: `company-risk-${company.handle}`,
        entity: CRM_COMPANY_ENTITY,
        handle: company.handle,
        title: company.name,
        subtitle: relationLabel(company.churnRiskReason) || t('crmWorkspace.contactRisk'),
        owner: csOwnerLabel(company),
        value: formatMoney(company.annualRecurringRevenue ?? company.contractValue),
        badge: relationLabel(company.segment),
        tone: company.churnRiskReason ? 'error' : 'warning',
        icon: 'mdi-alert-decagram-outline',
      })),
  )
  const topAccountItems = computed<CrmWorkspaceItem[]>(() =>
    filteredCompanies.value
      .filter(isCustomerCompany)
      .sort((left, right) => companyValue(right) - companyValue(left))
      .slice(0, 12)
      .map((company) => ({
        id: `account-${company.handle}`,
        entity: CRM_COMPANY_ENTITY,
        handle: company.handle,
        title: company.name,
        subtitle: relationLabel(company.industry) || relationLabel(company.segment),
        owner: accountOwnerLabel(company),
        value: formatMoney(company.annualRecurringRevenue ?? company.contractValue),
        badge: relationLabel(company.size) || relationLabel(company.segment),
        tone: company.churnRiskReason ? 'warning' : 'default',
        icon: 'mdi-domain',
      })),
  )
  const todayContactItems = computed<CrmWorkspaceItem[]>(() => {
    const opportunities = opportunitiesWithoutNextActivity.value.slice(0, 7).map((item) => {
      const person = resolvePerson(item.assigneePerson ?? item.creatorPerson)
      return {
        id: `contact-opportunity-${item.handle}`,
        entity: person?.handle ? CRM_PERSON_ENTITY : CRM_OPPORTUNITY_ENTITY,
        handle: person?.handle ?? item.handle,
        title: person ? personLabel(person) : item.title,
        subtitle: [companyLabel(item.assigneeCompany ?? item.creatorCompany), item.title]
          .filter(Boolean)
          .join(' · '),
        owner: opportunityOwnerLabel(item),
        value: formatMoney(item.expectedRevenue),
        badge: t('crmWorkspace.noNextActivity'),
        tone: getOpportunityUrgencyTone(item),
        icon: 'mdi-phone-outgoing-outline',
      } satisfies CrmWorkspaceItem
    })
    const accounts = customersWithoutContact.value.slice(0, 7).map(
      ({ company, days }) =>
        ({
          id: `contact-account-${company.handle}`,
          entity: CRM_COMPANY_ENTITY,
          handle: company.handle,
          title: company.name,
          subtitle: relationLabel(company.segment) || relationLabel(company.industry),
          owner: accountOwnerLabel(company),
          value: Number.isFinite(days)
            ? t('crmWorkspace.daysAgo', { count: days })
            : t('crmWorkspace.noContact'),
          badge: t('crmWorkspace.customerContactGap'),
          tone: days >= 90 ? 'error' : 'warning',
          icon: 'mdi-phone-sync-outline',
        }) satisfies CrmWorkspaceItem,
    )
    return [...opportunities, ...accounts]
      .filter(
        (item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index,
      )
      .slice(0, 10)
  })

  const salesStageBreakdown = computed<CrmStageBreakdown[]>(() => {
    const stages = new Map<string, CrmStageBreakdown>()
    filteredOpenOpportunities.value.forEach((opportunity) => {
      const stage = relationObject(opportunity.type)
      const key = String(stage?.handle ?? 'unknown')
      const current = stages.get(key) ?? {
        key,
        label: stage?.title || t('crmWorkspace.noStage'),
        count: 0,
        value: 0,
        color: stage?.color || '#93C5FD',
      }
      current.count += 1
      current.value += normalizeMoney(opportunity.expectedRevenue)
      stages.set(key, current)
    })
    return [...stages.values()].sort((left, right) => right.value - left.value)
  })
  const heroMetrics = computed(() => {
    const openPipeline = filteredOpenOpportunities.value.reduce(
      (sum, item) => sum + normalizeMoney(item.expectedRevenue),
      0,
    )
    const weightedPipeline = filteredOpenOpportunities.value.reduce(
      (sum, item) =>
        sum + normalizeMoney(item.expectedRevenue) * (normalizeProbability(item.probability) / 100),
      0,
    )
    const totalArr = filteredCompanies.value.reduce(
      (sum, company) => sum + normalizeMoney(company.annualRecurringRevenue),
      0,
    )
    return [
      {
        key: 'openPipeline',
        label: t('crmWorkspace.openPipeline'),
        value: formatMoney(openPipeline),
        cockpit: 'sales' as const,
      },
      {
        key: 'weightedPipeline',
        label: t('crmWorkspace.weightedPipeline'),
        value: formatMoney(weightedPipeline),
        cockpit: 'sales' as const,
      },
      {
        key: 'totalArr',
        label: t('crmWorkspace.totalArr'),
        value: formatMoney(totalArr),
        cockpit: 'account' as const,
      },
      {
        key: 'contactToday',
        label: t('crmWorkspace.contactToday'),
        value: n(todayContactItems.value.length),
        cockpit: 'customerSuccess' as const,
      },
    ]
  })
  const cockpitCounts = computed<Record<CrmCockpitKey, number>>(() => ({
    sales: filteredOpenOpportunities.value.length,
    account: filteredCompanies.value.filter(isCustomerCompany).length,
    customerSuccess: atRiskCustomerItems.value.length,
  }))
  const activeFilterCount = computed(
    () =>
      Number(Boolean(String(search.value ?? '').trim())) +
      Number(selectedResponsibleHandle.value !== defaultResponsibleHandle.value) +
      Number(activeCockpit.value !== 'sales' && Boolean(selectedSegmentHandle.value)) +
      Number(activeCockpit.value === 'sales' && Boolean(opportunityHorizonDays.value)) +
      Number(activeCockpit.value !== 'sales' && contactThresholdDays.value !== 45),
  )
  const signals = computed<CrmSignal[]>(() => [
    signal(
      'noActivity',
      'mdi-calendar-alert-outline',
      'opportunitiesWithoutNextActivity',
      opportunitiesWithoutNextActivity.value.length,
    ),
    signal(
      'contactGaps',
      'mdi-account-clock-outline',
      'customersWithoutContact',
      customersWithoutContact.value.length,
    ),
    signal(
      'risks',
      'mdi-alert-decagram-outline',
      'atRiskCustomers',
      atRiskCustomerItems.value.length,
    ),
  ])

  function signal(key: CrmSignal['key'], icon: string, labelKey: string, value: number): CrmSignal {
    return createCrmSignal(key, icon, t(`crmWorkspace.${labelKey}`), n(value))
  }
  function resolvePerson(value: unknown): CrmPerson | null {
    const handle = getRelationHandle(value)
    return handle == null
      ? null
      : (personByHandle.value.get(String(handle)) ?? (relationObject(value) as CrmPerson | null))
  }
  function companyLabel(value: unknown): string {
    const handle = getRelationHandle(value)
    const company = handle != null ? companyByHandle.value.get(String(handle)) : null
    return company?.name || relationObject(value)?.name || t('crmWorkspace.noCompany')
  }
  function personLabel(value: unknown): string {
    const person = resolvePerson(value)
    const name = [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim()
    return name || relationLabel(value) || t('crmWorkspace.noPerson')
  }
  function accountOwnerLabel(company: CrmCompany): string {
    return personLabel(company.accountManager) || t('crmWorkspace.noOwner')
  }
  function csOwnerLabel(company: CrmCompany): string {
    return personLabel(company.customerSuccessManager) || t('crmWorkspace.noOwner')
  }
  function opportunityOwnerLabel(opportunity: CrmOpportunity): string {
    return personLabel(opportunity.assigneePerson ?? opportunity.creatorPerson)
  }
  function isCompanyContactOverdue(company: CrmCompany): boolean {
    const lastContact = lastCompanyContact.value.get(String(company.handle))
    return (
      !lastContact ||
      diffInDays(startOfDay(new Date()), startOfDay(lastContact)) >= contactThresholdDays.value
    )
  }
  function companyRiskScore(company: CrmCompany): number {
    return (
      (company.churnRiskReason ? 1000 : 0) +
      (isCompanyContactOverdue(company) ? 500 : 0) +
      companyValue(company) / 1000
    )
  }
  const formatMoney = (value: unknown) => formatCrmMoney(value, locale.value)
  const formatDate = (value: unknown) => formatCrmDate(value, d, t('crmWorkspace.noDate'))

  async function openFilteredEntity(
    entity: CrmWorkspaceItem['entity'],
    filter: Record<string, unknown>,
  ): Promise<void> {
    await pushAppRoute(
      router,
      `/table/${entity}?filter=${encodeURIComponent(JSON.stringify(filter))}`,
    )
  }
  async function openWorkspaceItem(item: CrmWorkspaceItem): Promise<void> {
    if (item.handle == null) return
    if (item.entity === CRM_COMPANY_ENTITY || item.entity === CRM_PERSON_ENTITY) {
      await router.push({
        name: 'customer360',
        params: { entityHandle: item.entity, handle: String(item.handle) },
      })
      return
    }
    await openFilteredEntity(item.entity, { handle: item.handle })
  }
  async function openOpportunityStage(stage: CrmStageBreakdown): Promise<void> {
    const opportunities = filteredOpenOpportunities.value.filter(
      (item) => String(relationObject(item.type)?.handle ?? 'unknown') === stage.key,
    )
    if (opportunities.length === 1) {
      await openWorkspaceItem({
        id: `stage-opportunity-${opportunities[0].handle}`,
        entity: CRM_OPPORTUNITY_ENTITY,
        handle: opportunities[0].handle,
        title: opportunities[0].title,
        subtitle: companyLabel(opportunities[0].assigneeCompany ?? opportunities[0].creatorCompany),
      })
    } else if (stage.key === 'unknown') {
      await pushAppRoute(router, `/table/${CRM_OPPORTUNITY_ENTITY}`)
    } else {
      await openFilteredEntity(CRM_OPPORTUNITY_ENTITY, { type: { handle: stage.key } })
    }
  }
  function openSignal(item: CrmSignal): void {
    activeCockpit.value =
      item.key === 'noActivity'
        ? 'sales'
        : item.key === 'contactGaps'
          ? 'account'
          : 'customerSuccess'
  }

  function resetFilters(): void {
    search.value = ''
    selectedResponsibleHandle.value = defaultResponsibleHandle.value
    selectedSegmentHandle.value = null
    opportunityHorizonDays.value = null
    contactThresholdDays.value = 45
  }

  onMounted(async () => {
    try {
      await Promise.all([
        genericStore.loadGenericMany([
          {
            entityHandle: CRM_COMPANY_ENTITY,
            namespaces: ['global', 'navigation', 'crmWorkspace'],
          },
          { entityHandle: CRM_PERSON_ENTITY, namespaces: ['global', 'navigation', 'crmWorkspace'] },
          {
            entityHandle: CRM_OPPORTUNITY_ENTITY,
            namespaces: ['global', 'navigation', 'crmWorkspace'],
          },
        ]),
        currentPersonStore.fetchCurrentPerson(),
      ])
      if (!selectedResponsibleHandle.value && currentPersonStore.person?.handle != null) {
        defaultResponsibleHandle.value = String(currentPersonStore.person.handle)
        selectedResponsibleHandle.value = defaultResponsibleHandle.value
      }
      await data.loadData()
    } finally {
      isPreparing.value = false
    }
  })

  return {
    activeCockpit,
    activeFilterCount,
    atRiskCustomerItems,
    cockpitCounts,
    contactThresholdDays,
    contactThresholdOptions,
    customersWithoutContactItems,
    filteredCompanies,
    filteredOpenOpportunities,
    formatMoney,
    hasLoadedOnce: data.hasLoadedOnce,
    heroMetrics,
    isLoading: data.isLoading,
    isPreparing,
    loadData: data.loadData,
    openOpportunityStage,
    openSignal,
    openWorkspaceItem,
    opportunityHorizonDays,
    opportunityHorizonOptions,
    opportunitiesWithoutNextActivityItems,
    responsiblePersonOptions,
    resetFilters,
    salesStageBreakdown,
    search,
    selectedResponsibleHandle,
    selectedSegmentHandle,
    segmentOptions,
    signals,
    todayContactItems,
    topAccountItems,
  }
}
