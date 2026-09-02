import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { EntityItem, SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'
import ApiGenericService from '@/services/api.generic.service'
import ApiCustomer360Service, {
  type Customer360ActivityItem,
  type Customer360ActivityKind,
  type Customer360Anchor,
  type Customer360RelatedResult,
  type Customer360Section,
  type Customer360Summary,
} from '@/services/api.customer360.service'
import { useSaplingMailDialog } from '@/composables/dialog/useSaplingMailDialog'
import { useSaplingChipFilters } from '@/composables/filter/useSaplingChipFilters'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import type {
  SaplingChipFilterGroup,
  SaplingChipFilterSelection,
  SaplingFilterHandle,
} from '@/components/filter/saplingWorkFilter.types'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { useGenericStore } from '@/stores/genericStore'
import { relationLabel, textValue } from '@/components/customer360/customer360RelatedPresentation'

export interface SaplingCustomer360Props {
  anchor: Customer360Anchor
  recordHandle: string
}

export function useSaplingCustomer360(props: SaplingCustomer360Props) {
  const { t, d, n, locale } = useI18n()
  useTranslationLoader(
    'global',
    'filter',
    'customer360',
    'ticket',
    'ticketStatus',
    'salesOpportunity',
    'salesOpportunityResultStatus',
    'effortEstimate',
    'contract',
    'person',
    'companyRelationship',
  )
  const router = useRouter()
  const genericStore = useGenericStore()
  const currentPersonStore = useCurrentPersonStore()
  const { openMailDialog } = useSaplingMailDialog()
  const summary = ref<Customer360Summary | null>(null)
  const loading = ref(true)
  const error = ref(false)
  const tab = ref('overview')
  const activityItems = ref<Customer360ActivityItem[]>([])
  const activityKinds = ref<Customer360ActivityKind[]>([])
  const activityDirection = ref<'all' | 'inbound' | 'outbound' | 'none'>('all')
  const activityPeriod = ref<'all' | '30' | '90' | '365'>('all')
  const activityBefore = ref<string>()
  const activityHasMore = ref(false)
  const activityLoading = ref(false)
  const related = reactive<Partial<Record<Customer360Section, Customer360RelatedResult>>>({})
  const relatedLoading = reactive<Partial<Record<Customer360Section, boolean>>>({})
  const createDialog = ref(false)
  const createHandle = ref('')
  const createItem = ref<SaplingGenericItem | null>(null)
  const createEntity = ref<EntityItem | null>(null)
  const createTemplates = ref<EntityTemplate[]>([])
  const briefContent = ref('')
  const briefRecord = ref<SaplingGenericItem | null>(null)
  const briefLoading = ref(false)
  const briefSaving = ref(false)
  const briefCanEdit = ref(false)
  const briefCanRead = ref(false)

  function createRelatedFilterState(entityHandle: string, supportsClosed = false) {
    const entityHandleRef = ref(entityHandle)
    const entityTemplates = computed(
      () => genericStore.getState(entityHandle).entityTemplates ?? [],
    )
    return {
      entityHandle,
      supportsClosed,
      includeClosed: ref(false),
      loaded: false,
      ...useSaplingChipFilters({ entityHandle: entityHandleRef, entityTemplates }),
    }
  }
  const relatedFilterStates = {
    tickets: createRelatedFilterState('ticket'),
    opportunities: createRelatedFilterState('salesOpportunity'),
    effortEstimates: createRelatedFilterState('effortEstimate', true),
    contracts: createRelatedFilterState('contract', true),
  }
  type FilterableRelatedSection = keyof typeof relatedFilterStates
  const isFilterableRelatedSection = (
    section: Customer360Section,
  ): section is FilterableRelatedSection => section in relatedFilterStates

  const anchorTitle = computed(() => {
    const item = summary.value?.anchor ?? {}
    return props.anchor === 'company'
      ? textValue(item.name) || t('customer360.unknownCompany')
      : [textValue(item.firstName), textValue(item.lastName)].filter(Boolean).join(' ') ||
          t('customer360.unknownPerson')
  })
  const anchorSubtitle = computed(() => {
    const item = summary.value?.anchor ?? {}
    return props.anchor === 'company'
      ? [relationLabel(item.segment), relationLabel(item.industry)].filter(Boolean).join(' · ')
      : [textValue(item.position), relationLabel(item.jobFunction), relationLabel(item.company)]
          .filter(Boolean)
          .join(' · ')
  })
  const anchorDetails = computed(() => {
    const item = summary.value?.anchor ?? {}
    const keys =
      props.anchor === 'company'
        ? [
            'email',
            'phone',
            'street',
            'city',
            'accountManager',
            'customerSuccessManager',
            'churnRiskReason',
          ]
        : ['email', 'phone', 'mobile', 'jobTitle', 'decisionRole']
    return keys.map((key) => relationLabel(item[key]) || textValue(item[key])).filter(Boolean)
  })
  const activityKindOptions = computed(() => [
    { value: 'emailInbound' as const, title: t('customer360.kindEmailInbound') },
    { value: 'emailOutbound' as const, title: t('customer360.kindEmailOutbound') },
    { value: 'call' as const, title: t('customer360.kindCall') },
    { value: 'appointment' as const, title: t('customer360.kindAppointment') },
    { value: 'event' as const, title: t('customer360.kindEvent') },
  ])
  const activityDirectionOptions = computed(() => [
    { value: 'all', title: t('customer360.directionAll') },
    { value: 'inbound', title: t('customer360.directionInbound') },
    { value: 'outbound', title: t('customer360.directionOutbound') },
    { value: 'none', title: t('customer360.directionNone') },
  ])
  const activityPeriodOptions = computed(() => [
    { value: 'all', title: t('customer360.periodAll') },
    { value: '30', title: t('customer360.periodDays', { count: 30 }) },
    { value: '90', title: t('customer360.periodDays', { count: 90 }) },
    { value: '365', title: t('customer360.periodDays', { count: 365 }) },
  ])

  const formatDate = (value: string | null | undefined) =>
    value ? d(new Date(value), 'short') : t('global.notAvailable')
  const numberOrDash = (value: number | null | undefined) => (value == null ? '–' : n(value))
  const moneyOrDash = (value: number | null | undefined) =>
    value == null
      ? '–'
      : new Intl.NumberFormat(locale.value, {
          style: 'currency',
          currency: 'EUR',
          maximumFractionDigits: 0,
        }).format(value)
  const hoursOrDash = (value: number | null | undefined) =>
    value == null ? '–' : t('customer360.hours', { count: n(value) })
  const hasSection = (section: Customer360Section) =>
    summary.value?.availableSections.includes(section) ?? false
  const metrics = computed(() => {
    const value = summary.value?.metrics
    if (!value) return []
    return [
      {
        key: 'tickets',
        icon: 'mdi-ticket-outline',
        color: 'error',
        label: t('customer360.openTickets'),
        value: numberOrDash(value.openTickets),
        detail: value.slaCriticalTickets
          ? t('customer360.slaCritical', { count: value.slaCriticalTickets })
          : '',
        tab: 'service',
        section: 'tickets' as Customer360Section,
      },
      {
        key: 'pipeline',
        icon: 'mdi-chart-line',
        color: 'primary',
        label: t('customer360.weightedPipeline'),
        value: moneyOrDash(value.weightedPipeline),
        detail:
          value.openOpportunities == null
            ? ''
            : t('customer360.openItems', { count: value.openOpportunities }),
        tab: 'sales',
        section: 'opportunities' as Customer360Section,
      },
      {
        key: 'estimate',
        icon: 'mdi-timer-sand',
        color: 'info',
        label: t('customer360.estimates'),
        value: hoursOrDash(value.estimatedHours),
        detail:
          value.activeEffortEstimates == null
            ? ''
            : t('customer360.activeItems', { count: value.activeEffortEstimates }),
        tab: 'sales',
        section: 'effortEstimates' as Customer360Section,
      },
      {
        key: 'contracts',
        icon: 'mdi-file-sign',
        color: 'success',
        label: t('customer360.contracts'),
        value: numberOrDash(value.activeContracts),
        detail: formatDate(value.nextContractEndAt),
        tab: 'contracts',
        section: 'contracts' as Customer360Section,
      },
    ].filter((metric) => hasSection(metric.section))
  })

  async function load() {
    loading.value = true
    error.value = false
    Object.keys(related).forEach((key) => delete related[key as Customer360Section])
    activityBefore.value = undefined
    activityHasMore.value = false
    try {
      summary.value = await ApiCustomer360Service.getSummary(props.anchor, props.recordHandle)
      activityItems.value = summary.value.recentActivity
      await loadTab(tab.value)
    } catch {
      error.value = true
    } finally {
      loading.value = false
    }
  }
  async function loadTab(value: string) {
    if (value === 'activity' && activityItems.value.length === 0) await loadActivity(true)
    const sections: Customer360Section[] =
      value === 'service'
        ? ['tickets']
        : value === 'sales'
          ? ['opportunities', 'effortEstimates']
          : value === 'contracts'
            ? ['contracts']
            : value === 'contacts'
              ? ['contacts', 'relationships']
              : value === 'documents'
                ? ['documents']
                : []
    await Promise.all(sections.filter(hasSection).map((section) => loadRelated(section)))
    if (value === 'documents') await loadBrief()
  }
  function activityAfter(): string | undefined {
    if (activityPeriod.value === 'all') return undefined
    const value = new Date()
    value.setDate(value.getDate() - Number(activityPeriod.value))
    return value.toISOString()
  }
  async function loadActivity(reset = false) {
    if (activityLoading.value) return
    activityLoading.value = true
    try {
      const result = await ApiCustomer360Service.getActivity(props.anchor, props.recordHandle, {
        before: reset ? undefined : activityBefore.value,
        after: activityAfter(),
        kinds: activityKinds.value.length ? activityKinds.value : undefined,
        direction: activityDirection.value === 'all' ? undefined : activityDirection.value,
      })
      activityItems.value = reset ? result.items : [...activityItems.value, ...result.items]
      activityBefore.value = result.nextBefore ?? undefined
      activityHasMore.value = result.hasMore
    } finally {
      activityLoading.value = false
    }
  }
  const loadMoreActivity = () => loadActivity(false)
  async function ensureRelatedFilters(section: Customer360Section) {
    if (!isFilterableRelatedSection(section)) return
    const state = relatedFilterStates[section]
    if (state.loaded) return
    try {
      await genericStore.loadGenericMany([
        { entityHandle: state.entityHandle, namespaces: ['global'] },
      ])
      await state.loadChipFilters()
    } catch {
      state.clearChipFilters()
    } finally {
      state.loaded = true
    }
  }
  function buildRelatedFilter(section: Customer360Section): Record<string, unknown> | undefined {
    if (!isFilterableRelatedSection(section)) return undefined
    const state = relatedFilterStates[section]
    const clauses = state.buildChipFilterClauses() as Record<string, unknown>[]
    if (state.supportsClosed && !state.includeClosed.value) clauses.push({ isActive: true })
    return clauses.length === 0 ? undefined : clauses.length === 1 ? clauses[0] : { $and: clauses }
  }
  async function loadRelated(section: Customer360Section, page = 1) {
    if (!hasSection(section) || relatedLoading[section] || (page === 1 && related[section])) return
    relatedLoading[section] = true
    try {
      await ensureRelatedFilters(section)
      const result = await ApiCustomer360Service.getRelated(
        props.anchor,
        props.recordHandle,
        section,
        page,
        20,
        buildRelatedFilter(section),
      )
      if (page > 1 && related[section]) result.data = [...related[section]!.data, ...result.data]
      related[section] = result
    } finally {
      relatedLoading[section] = false
    }
  }
  const loadMoreRelated = (section: Customer360Section) => {
    const result = related[section]
    if (result && result.meta.page < result.meta.totalPages)
      return loadRelated(section, result.meta.page + 1)
  }
  const relatedFilterGroups = (section: FilterableRelatedSection): SaplingChipFilterGroup[] =>
    relatedFilterStates[section].chipFilters.value
  const relatedFilterSelection = (section: FilterableRelatedSection): SaplingChipFilterSelection =>
    relatedFilterStates[section].selectedChipFilters.value
  const relatedIncludeClosed = (section: 'effortEstimates' | 'contracts') =>
    relatedFilterStates[section].includeClosed.value
  async function refreshRelated(section: Customer360Section) {
    delete related[section]
    await loadRelated(section)
  }
  async function toggleRelatedFilter(
    section: FilterableRelatedSection,
    event: { groupKey: string; handle: SaplingFilterHandle },
  ) {
    const state = relatedFilterStates[section]
    const current = state.selectedChipFilters.value[event.groupKey] ?? []
    state.onSelectedChipFiltersUpdate({
      ...state.selectedChipFilters.value,
      [event.groupKey]: current.includes(event.handle)
        ? current.filter((handle) => handle !== event.handle)
        : [...current, event.handle],
    })
    await refreshRelated(section)
  }
  async function toggleRelatedClosed(section: 'effortEstimates' | 'contracts') {
    relatedFilterStates[section].includeClosed.value =
      !relatedFilterStates[section].includeClosed.value
    await refreshRelated(section)
  }
  function writeMail() {
    const email = textValue(summary.value?.anchor.email)
    openMailDialog({
      entityHandle: props.anchor,
      itemHandle: props.recordHandle,
      initialTo: email ? [email] : undefined,
    })
  }
  function createDefaults(
    entityHandle: string,
    variant?: 'call' | 'appointment',
  ): SaplingGenericItem {
    const anchor = summary.value?.anchor ?? {}
    const company = props.anchor === 'company' ? anchor : summary.value?.companyContext
    const person = props.anchor === 'person' ? anchor : null
    const defaults: SaplingGenericItem = {}
    if (entityHandle === 'contract') defaults.company = company
    else {
      defaults.creatorCompany = company
      defaults.creatorPerson = person
    }
    if (entityHandle === 'event') {
      const start = new Date()
      const end = new Date(start.getTime() + (variant === 'call' ? 5 : 60) * 60_000)
      Object.assign(defaults, {
        title:
          variant === 'call'
            ? t('customer360.defaultCallTitle', { customer: anchorTitle.value })
            : '',
        startDate: start,
        endDate: end,
        isAllDay: false,
        type: variant === 'call' ? { handle: 'call' } : undefined,
        status: variant === 'call' ? { handle: 'completed' } : undefined,
      })
    }
    if (entityHandle === 'ticket' || entityHandle === 'contract') defaults.startDate = new Date()
    return defaults
  }
  async function openCreate(entityHandle: string, variant?: 'call' | 'appointment') {
    await genericStore.loadGenericMany([{ entityHandle, namespaces: ['global'] }])
    const state = genericStore.getState(entityHandle)
    createHandle.value = entityHandle
    createEntity.value = state.entity
    createTemplates.value = state.entityTemplates
    createItem.value = createDefaults(entityHandle, variant)
    createDialog.value = true
  }
  async function saveCreate(value: SaplingGenericItem) {
    await ApiGenericService.create(createHandle.value, value)
    createDialog.value = false
    await load()
  }
  async function loadBrief() {
    if (briefLoading.value) return
    briefLoading.value = true
    try {
      await genericStore.loadGenericMany([{ entityHandle: 'information', namespaces: ['global'] }])
      const state = genericStore.getState('information')
      briefCanRead.value = Boolean(state.entityPermission?.allowRead)
      briefCanEdit.value = Boolean(
        state.entityPermission?.allowInsert || state.entityPermission?.allowUpdate,
      )
      if (!briefCanRead.value) return
      const result = await ApiGenericService.find<SaplingGenericItem>('information', {
        filter: { entity: props.anchor, reference: props.recordHandle },
        relations: ['entity', 'person'],
        limit: 1,
      })
      briefRecord.value = result.data[0] ?? null
      briefContent.value = textValue(briefRecord.value?.content)
    } finally {
      briefLoading.value = false
    }
  }
  async function saveBrief() {
    briefSaving.value = true
    try {
      const content = briefContent.value.trim()
      if (briefRecord.value?.handle != null)
        briefRecord.value = await ApiGenericService.update(
          'information',
          briefRecord.value.handle,
          { content },
        )
      else if (content) {
        await currentPersonStore.fetchCurrentPerson()
        briefRecord.value = await ApiGenericService.create('information', {
          content,
          entity: props.anchor,
          reference: props.recordHandle,
          person: currentPersonStore.person?.handle,
        })
      }
    } finally {
      briefSaving.value = false
    }
  }
  function openRecord(entityHandle: string, handle: string | number) {
    return entityHandle === 'company' || entityHandle === 'person'
      ? router.push({ name: 'customer360', params: { entityHandle, handle } })
      : router.push({
          name: 'table',
          params: { entity: entityHandle },
          query: { open: String(handle) },
        })
  }
  const displayValue = (value: unknown) =>
    textValue(value) ||
    relationLabel(value) ||
    (value && typeof value === 'object'
      ? textValue((value as Record<string, unknown>).description)
      : '')
  const warningText = (warning: Customer360Summary['warnings'][number]) =>
    t(`customer360.warning.${warning.key}`, { value: displayValue(warning.value) })

  watch(
    () => [props.anchor, props.recordHandle],
    () => void load(),
  )
  watch(activityKinds, () => void loadActivity(true), { deep: true })
  watch([activityDirection, activityPeriod], () => void loadActivity(true))
  watch(tab, (value) => void loadTab(value))
  onMounted(load)

  return {
    t,
    summary,
    loading,
    error,
    tab,
    activityItems,
    activityKinds,
    activityDirection,
    activityPeriod,
    activityHasMore,
    activityLoading,
    related,
    relatedLoading,
    createDialog,
    createItem,
    createEntity,
    createTemplates,
    briefContent,
    briefLoading,
    briefSaving,
    briefCanEdit,
    briefCanRead,
    anchorTitle,
    anchorSubtitle,
    anchorDetails,
    activityKindOptions,
    activityDirectionOptions,
    activityPeriodOptions,
    metrics,
    load,
    loadMoreActivity,
    loadMoreRelated,
    relatedFilterGroups,
    relatedFilterSelection,
    relatedIncludeClosed,
    toggleRelatedFilter,
    toggleRelatedClosed,
    hasSection,
    writeMail,
    openCreate,
    saveCreate,
    saveBrief,
    openRecord,
    formatDate,
    warningText,
  }
}
