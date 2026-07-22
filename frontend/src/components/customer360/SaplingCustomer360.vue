<template>
  <v-container
    class="sapling-page-shell sapling-page-shell--panel sapling-page-shell--fill sapling-page-shell--uniform-inset sapling-dashboard-page sapling-dashboard-page--flow-xl customer360"
    fluid
  >
    <section
      v-if="loading"
      class="sapling-page-hero sapling-page-hero--workspace customer360__hero glass-panel"
    >
      <v-skeleton-loader type="heading, paragraph" />
      <div class="sapling-stat-grid customer360__stat-grid">
        <v-skeleton-loader v-for="item in 4" :key="item" type="article" />
      </div>
    </section>

    <v-alert v-else-if="error" type="error" variant="tonal" class="mb-4">
      {{ $t('customer360.loadError') }}
      <template #append
        ><v-btn variant="text" @click="load">{{ $t('customer360.retry') }}</v-btn></template
      >
    </v-alert>

    <template v-else-if="summary">
      <SaplingPageHero
        class="customer360__hero glass-panel"
        variant="workspace"
        :eyebrow="$t('customer360.eyebrow')"
        :title="anchorTitle"
      >
        <template #title-prefix>
          <v-icon size="28">{{ props.anchor === 'company' ? 'mdi-domain' : 'mdi-account' }}</v-icon>
        </template>

        <template #meta>
          <p v-if="anchorSubtitle" class="customer360__subtitle">{{ anchorSubtitle }}</p>
          <div class="sapling-chip-row customer360__details">
            <v-chip v-for="detail in anchorDetails" :key="detail" size="small" variant="tonal">
              {{ detail }}
            </v-chip>
          </div>
        </template>

        <template #side>
          <div class="sapling-stack-md customer360__hero-side">
            <div class="sapling-stat-grid customer360__stat-grid">
              <button
                v-for="metric in metrics"
                :key="metric.key"
                type="button"
                class="sapling-detail-card customer360__stat-card"
                @click="metric.tab && (tab = metric.tab)"
              >
                <span class="customer360__stat-row">
                  <span class="customer360__stat-label">
                    <v-icon :icon="metric.icon" :color="metric.color" size="18" />
                    {{ metric.label }}
                  </span>
                  <strong>{{ metric.value }}</strong>
                </span>
                <small v-if="metric.detail">{{ metric.detail }}</small>
              </button>
            </div>

            <div class="sapling-action-cluster customer360__actions">
              <v-btn
                v-if="summary.actions.mail"
                prepend-icon="mdi-email-outline"
                color="primary"
                @click="writeMail"
                >{{ $t('customer360.actionMail') }}</v-btn
              >
              <v-btn
                v-if="summary.actions.call"
                prepend-icon="mdi-phone-log-outline"
                variant="tonal"
                @click="openCreate('event', 'call')"
                >{{ $t('customer360.actionCall') }}</v-btn
              >
              <v-menu>
                <template #activator="{ props: menuProps }">
                  <v-btn v-bind="menuProps" prepend-icon="mdi-plus" variant="outlined">
                    {{ $t('customer360.moreActions') }}
                  </v-btn>
                </template>
                <v-list density="compact" class="glass-panel">
                  <v-list-item
                    v-if="summary.actions.appointment"
                    prepend-icon="mdi-calendar-plus"
                    @click="openCreate('event', 'appointment')"
                    :title="$t('customer360.actionAppointment')"
                  />
                  <v-list-item
                    v-if="summary.actions.ticket"
                    prepend-icon="mdi-ticket-outline"
                    @click="openCreate('ticket')"
                    :title="$t('customer360.actionTicket')"
                  />
                  <v-list-item
                    v-if="summary.actions.opportunity"
                    prepend-icon="mdi-chart-line"
                    @click="openCreate('salesOpportunity')"
                    :title="$t('customer360.actionOpportunity')"
                  />
                  <v-list-item
                    v-if="summary.actions.effortEstimate"
                    prepend-icon="mdi-timer-sand"
                    @click="openCreate('effortEstimate')"
                    :title="$t('customer360.actionEstimate')"
                  />
                  <v-list-item
                    v-if="summary.actions.contract"
                    prepend-icon="mdi-file-sign"
                    @click="openCreate('contract')"
                    :title="$t('customer360.actionContract')"
                  />
                </v-list>
              </v-menu>
            </div>
          </div>
        </template>
      </SaplingPageHero>

      <section v-if="summary.warnings.length" class="customer360__warnings">
        <v-alert
          v-for="warning in summary.warnings"
          :key="warning.key"
          :type="warning.severity"
          variant="tonal"
          density="compact"
          class="customer360__warning"
          >{{ warningText(warning) }}</v-alert
        >
      </section>

      <section class="sapling-workspace-panel customer360__workspace glass-panel">
        <v-tabs v-model="tab" class="customer360__tabs" show-arrows>
          <v-tab value="overview">{{ $t('customer360.tabOverview') }}</v-tab>
          <v-tab value="activity">{{ $t('customer360.tabActivity') }}</v-tab>
          <v-tab v-if="hasSection('tickets')" value="service">{{
            $t('customer360.tabService')
          }}</v-tab>
          <v-tab
            v-if="hasSection('opportunities') || hasSection('effortEstimates')"
            value="sales"
            >{{ $t('customer360.tabSales') }}</v-tab
          >
          <v-tab v-if="hasSection('contracts')" value="contracts">{{
            $t('customer360.tabContracts')
          }}</v-tab>
          <v-tab v-if="hasSection('contacts') || hasSection('relationships')" value="contacts">{{
            $t('customer360.tabContacts')
          }}</v-tab>
          <v-tab v-if="hasSection('documents')" value="documents">{{
            $t('customer360.tabDocuments')
          }}</v-tab>
        </v-tabs>

        <v-window v-model="tab" class="customer360__window">
          <v-window-item value="overview">
            <div class="customer360__grid">
              <section
                class="sapling-section-panel sapling-panel-shell customer360__panel customer360__panel--wide"
                :class="{ 'customer360__panel--full': !briefCanRead }"
              >
                <h2>{{ $t('customer360.recentActivity') }}</h2>
                <ActivityList :items="summary.recentActivity" @open="openRecord" />
                <v-btn variant="text" class="mt-2" @click="tab = 'activity'">{{
                  $t('customer360.showAll')
                }}</v-btn>
              </section>
              <section
                v-if="briefCanRead"
                class="sapling-section-panel sapling-panel-shell customer360__panel"
              >
                <h2>{{ $t('customer360.nextSteps') }}</h2>
                <div class="customer360__facts">
                  <div>
                    <span>{{ $t('customer360.lastContact') }}</span
                    ><strong>{{ formatDate(summary.metrics.lastContactAt) }}</strong>
                  </div>
                  <div>
                    <span>{{ $t('customer360.nextAppointment') }}</span
                    ><strong>{{ formatDate(summary.metrics.nextAppointmentAt) }}</strong>
                  </div>
                  <div>
                    <span>{{ $t('customer360.nextContractEnd') }}</span
                    ><strong>{{ formatDate(summary.metrics.nextContractEndAt) }}</strong>
                  </div>
                </div>
              </section>
            </div>
          </v-window-item>

          <v-window-item value="activity">
            <section class="sapling-section-panel sapling-panel-shell customer360__panel">
              <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-4">
                <h2>{{ $t('customer360.activity') }}</h2>
                <v-chip-group v-model="activityKinds" multiple filter column>
                  <v-chip
                    v-for="kind in activityKindOptions"
                    :key="kind.value"
                    :value="kind.value"
                    size="small"
                    >{{ kind.title }}</v-chip
                  >
                </v-chip-group>
                <div class="d-flex ga-2 customer360__activity-filters">
                  <v-select
                    v-model="activityDirection"
                    :items="activityDirectionOptions"
                    density="compact"
                    hide-details
                    variant="outlined"
                  />
                  <v-select
                    v-model="activityPeriod"
                    :items="activityPeriodOptions"
                    density="compact"
                    hide-details
                    variant="outlined"
                  />
                </div>
              </div>
              <v-progress-linear v-if="activityLoading" indeterminate class="mb-3" />
              <ActivityList :items="activityItems" @open="openRecord" />
              <v-btn
                v-if="activityHasMore"
                :loading="activityLoading"
                variant="outlined"
                class="mt-4"
                @click="loadMoreActivity"
              >
                {{ $t('customer360.loadMore') }}
              </v-btn>
            </section>
          </v-window-item>

          <v-window-item value="service"
            ><RelatedPanel
              section="tickets"
              :result="related.tickets"
              :loading="relatedLoading.tickets"
              :filters="relatedFilterGroups('tickets')"
              :selected-filters="relatedFilterSelection('tickets')"
              @load-more="loadMoreRelated('tickets')"
              @toggle-filter="toggleRelatedFilter('tickets', $event)"
              @open="openRecord"
          /></v-window-item>
          <v-window-item value="sales">
            <div class="customer360__grid">
              <RelatedPanel
                v-if="hasSection('opportunities')"
                section="opportunities"
                :result="related.opportunities"
                :loading="relatedLoading.opportunities"
                :filters="relatedFilterGroups('opportunities')"
                :selected-filters="relatedFilterSelection('opportunities')"
                @load-more="loadMoreRelated('opportunities')"
                @toggle-filter="toggleRelatedFilter('opportunities', $event)"
                @open="openRecord"
              />
              <RelatedPanel
                v-if="hasSection('effortEstimates')"
                section="effortEstimates"
                :result="related.effortEstimates"
                :loading="relatedLoading.effortEstimates"
                :filters="relatedFilterGroups('effortEstimates')"
                :selected-filters="relatedFilterSelection('effortEstimates')"
                :show-closed-filter="true"
                :include-closed="relatedIncludeClosed('effortEstimates')"
                @load-more="loadMoreRelated('effortEstimates')"
                @toggle-filter="toggleRelatedFilter('effortEstimates', $event)"
                @toggle-closed="toggleRelatedClosed('effortEstimates')"
                @open="openRecord"
              />
            </div>
          </v-window-item>
          <v-window-item value="contracts"
            ><RelatedPanel
              section="contracts"
              :result="related.contracts"
              :loading="relatedLoading.contracts"
              :filters="relatedFilterGroups('contracts')"
              :selected-filters="relatedFilterSelection('contracts')"
              :show-closed-filter="true"
              :include-closed="relatedIncludeClosed('contracts')"
              @load-more="loadMoreRelated('contracts')"
              @toggle-filter="toggleRelatedFilter('contracts', $event)"
              @toggle-closed="toggleRelatedClosed('contracts')"
              @open="openRecord"
          /></v-window-item>
          <v-window-item value="contacts">
            <div class="customer360__grid">
              <RelatedPanel
                v-if="hasSection('contacts')"
                section="contacts"
                :result="related.contacts"
                :loading="relatedLoading.contacts"
                @load-more="loadMoreRelated('contacts')"
                @open="openRecord"
              />
              <RelatedPanel
                v-if="hasSection('relationships')"
                section="relationships"
                :result="related.relationships"
                :loading="relatedLoading.relationships"
                @load-more="loadMoreRelated('relationships')"
                @open="openRecord"
              />
            </div>
          </v-window-item>
          <v-window-item value="documents">
            <div class="customer360__grid">
              <RelatedPanel
                section="documents"
                :result="related.documents"
                :loading="relatedLoading.documents"
                @load-more="loadMoreRelated('documents')"
                @open="openRecord"
              />
              <section class="sapling-section-panel sapling-panel-shell customer360__panel">
                <h2>{{ $t('customer360.brief') }}</h2>
                <v-textarea
                  v-model="briefContent"
                  :loading="briefLoading"
                  auto-grow
                  rows="8"
                  variant="outlined"
                  :readonly="!briefCanEdit"
                />
                <v-btn
                  v-if="briefCanEdit"
                  :loading="briefSaving"
                  color="primary"
                  @click="saveBrief"
                  >{{ $t('global.save') }}</v-btn
                >
              </section>
            </div>
          </v-window-item>
        </v-window>
      </section>
    </template>

    <SaplingDialogEdit
      v-if="createEntity"
      v-model="createDialog"
      mode="create"
      :item="createItem"
      :templates="createTemplates"
      :entity="createEntity"
      :force-dirty="true"
      @save="saveCreate"
      @cancel="createDialog = false"
    />
  </v-container>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import SaplingDialogEdit from '@/components/dialog/SaplingDialogEdit.vue'
import SaplingPageHero from '@/components/common/SaplingPageHero.vue'
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

const props = defineProps<{ anchor: Customer360Anchor; recordHandle: string }>()
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

const relatedFilterStates = {
  tickets: createRelatedFilterState('ticket'),
  opportunities: createRelatedFilterState('salesOpportunity'),
  effortEstimates: createRelatedFilterState('effortEstimate', true),
  contracts: createRelatedFilterState('contract', true),
}

const summary = ref<Customer360Summary | null>(null)
const loading = ref(true)
const error = ref(false)
const tab = ref('overview')
const activityItems = ref<Customer360ActivityItem[]>([])
const activityKinds = ref<Customer360ActivityKind[]>([])
const activityDirection = ref<'all' | 'inbound' | 'outbound' | 'none'>('all')
const activityPeriod = ref<'all' | '30' | '90' | '365'>('all')
const activityBefore = ref<string | undefined>()
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

const anchorTitle = computed(() => {
  const item = summary.value?.anchor ?? {}
  return props.anchor === 'company'
    ? textValue(item.name) || t('customer360.unknownCompany')
    : [textValue(item.firstName), textValue(item.lastName)].filter(Boolean).join(' ') ||
        t('customer360.unknownPerson')
})
const anchorSubtitle = computed(() => {
  const item = summary.value?.anchor ?? {}
  if (props.anchor === 'company')
    return [relationLabel(item.segment), relationLabel(item.industry)].filter(Boolean).join(' · ')
  return [textValue(item.position), relationLabel(item.jobFunction), relationLabel(item.company)]
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

watch(
  () => [props.anchor, props.recordHandle],
  () => void load(),
)
watch(activityKinds, () => void loadActivity(true), { deep: true })
watch([activityDirection, activityPeriod], () => void loadActivity(true))
watch(tab, (value) => void loadTab(value))
onMounted(load)

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

function loadMoreActivity() {
  return loadActivity(false)
}

function activityAfter(): string | undefined {
  if (activityPeriod.value === 'all') return undefined
  const value = new Date()
  value.setDate(value.getDate() - Number(activityPeriod.value))
  return value.toISOString()
}

async function loadRelated(section: Customer360Section, page = 1) {
  if (!hasSection(section) || relatedLoading[section]) return
  if (page === 1 && related[section]) return
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

function loadMoreRelated(section: Customer360Section) {
  const result = related[section]
  if (result && result.meta.page < result.meta.totalPages)
    return loadRelated(section, result.meta.page + 1)
}

function createRelatedFilterState(entityHandle: string, supportsClosed = false) {
  const entityHandleRef = ref(entityHandle)
  const entityTemplates = computed(() => genericStore.getState(entityHandle).entityTemplates ?? [])
  const chipState = useSaplingChipFilters({ entityHandle: entityHandleRef, entityTemplates })
  return {
    entityHandle,
    supportsClosed,
    includeClosed: ref(false),
    loaded: false,
    ...chipState,
  }
}

type FilterableRelatedSection = keyof typeof relatedFilterStates

function isFilterableRelatedSection(
  section: Customer360Section,
): section is FilterableRelatedSection {
  return section in relatedFilterStates
}

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

function relatedFilterGroups(section: FilterableRelatedSection): SaplingChipFilterGroup[] {
  return relatedFilterStates[section].chipFilters.value
}

function relatedFilterSelection(section: FilterableRelatedSection): SaplingChipFilterSelection {
  return relatedFilterStates[section].selectedChipFilters.value
}

function relatedIncludeClosed(section: 'effortEstimates' | 'contracts'): boolean {
  return relatedFilterStates[section].includeClosed.value
}

function buildRelatedFilter(section: Customer360Section): Record<string, unknown> | undefined {
  if (!isFilterableRelatedSection(section)) return undefined
  const state = relatedFilterStates[section]
  const clauses = state.buildChipFilterClauses() as Record<string, unknown>[]
  if (state.supportsClosed && !state.includeClosed.value) clauses.push({ isActive: true })
  if (clauses.length === 0) return undefined
  return clauses.length === 1 ? clauses[0] : { $and: clauses }
}

async function toggleRelatedFilter(
  section: FilterableRelatedSection,
  event: { groupKey: string; handle: SaplingFilterHandle },
) {
  const state = relatedFilterStates[section]
  const current = state.selectedChipFilters.value[event.groupKey] ?? []
  const next = current.includes(event.handle)
    ? current.filter((handle) => handle !== event.handle)
    : [...current, event.handle]
  state.onSelectedChipFiltersUpdate({
    ...state.selectedChipFilters.value,
    [event.groupKey]: next,
  })
  await refreshRelated(section)
}

async function toggleRelatedClosed(section: 'effortEstimates' | 'contracts') {
  const state = relatedFilterStates[section]
  state.includeClosed.value = !state.includeClosed.value
  await refreshRelated(section)
}

async function refreshRelated(section: Customer360Section) {
  delete related[section]
  await loadRelated(section)
}

function hasSection(section: Customer360Section) {
  return summary.value?.availableSections.includes(section) ?? false
}

function writeMail() {
  const email = textValue(summary.value?.anchor.email)
  openMailDialog({
    entityHandle: props.anchor,
    itemHandle: props.recordHandle,
    initialTo: email ? [email] : undefined,
  })
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
  if (entityHandle === 'ticket') defaults.startDate = new Date()
  if (entityHandle === 'contract') defaults.startDate = new Date()
  return defaults
}

async function saveCreate(value: SaplingGenericItem) {
  await ApiGenericService.create(createHandle.value, value)
  createDialog.value = false
  Object.keys(related).forEach((key) => delete related[key as Customer360Section])
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
    if (briefRecord.value?.handle != null) {
      briefRecord.value = await ApiGenericService.update('information', briefRecord.value.handle, {
        content,
      })
    } else if (content) {
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
  if (entityHandle === 'company' || entityHandle === 'person') {
    return router.push({ name: 'customer360', params: { entityHandle, handle } })
  }
  return router.push({
    name: 'table',
    params: { entity: entityHandle },
    query: { open: String(handle) },
  })
}

function textValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}
function relationLabel(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const item = value as Record<string, unknown>
  return (
    textValue(item.name) ||
    textValue(item.title) ||
    textValue(item.description) ||
    [textValue(item.firstName), textValue(item.lastName)].filter(Boolean).join(' ')
  )
}
function displayValue(value: unknown): string {
  return (
    textValue(value) ||
    relationLabel(value) ||
    (value && typeof value === 'object'
      ? textValue((value as Record<string, unknown>).description)
      : '')
  )
}
function formatDate(value: string | null | undefined) {
  return value ? d(new Date(value), 'short') : t('global.notAvailable')
}
function numberOrDash(value: number | null | undefined) {
  return value == null ? '–' : n(value)
}
function moneyOrDash(value: number | null | undefined) {
  return value == null
    ? '–'
    : new Intl.NumberFormat(locale.value, {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(value)
}
function hoursOrDash(value: number | null | undefined) {
  return value == null ? '–' : t('customer360.hours', { count: n(value) })
}
function warningText(warning: Customer360Summary['warnings'][number]) {
  return t(`customer360.warning.${warning.key}`, { value: displayValue(warning.value) })
}

const ActivityList = defineComponent({
  props: { items: { type: Array as () => Customer360ActivityItem[], required: true } },
  emits: ['open'],
  setup(listProps, { emit }) {
    return () =>
      listProps.items.length
        ? h(
            'div',
            { class: 'customer360__list' },
            listProps.items.map((item) =>
              h(
                'button',
                {
                  class: 'sapling-panel-shell-muted customer360__list-item',
                  type: 'button',
                  onClick: () => emit('open', item.entityHandle, item.recordHandle),
                },
                [
                  h('i', { class: `mdi ${activityIcon(item.kind)}` }),
                  h('span', [
                    h('strong', item.title),
                    h('small', [
                      formatDate(item.occurredAt),
                      item.participants.length ? ` · ${item.participants.join(', ')}` : '',
                    ]),
                    item.summary ? h('p', item.summary) : null,
                  ]),
                ],
              ),
            ),
          )
        : h(
            'div',
            {
              class:
                'sapling-empty-state-panel sapling-empty-state-panel--compact customer360__empty',
            },
            t('customer360.noEntries'),
          )
  },
})

const RelatedPanel = defineComponent({
  props: {
    section: { type: String as () => Customer360Section, required: true },
    result: { type: Object as () => Customer360RelatedResult, default: undefined },
    loading: Boolean,
    filters: { type: Array as () => SaplingChipFilterGroup[], default: () => [] },
    selectedFilters: {
      type: Object as () => SaplingChipFilterSelection,
      default: () => ({}),
    },
    showClosedFilter: Boolean,
    includeClosed: Boolean,
  },
  emits: ['loadMore', 'open', 'toggleFilter', 'toggleClosed'],
  setup(panelProps, { emit }) {
    return () =>
      h('section', { class: 'sapling-section-panel sapling-panel-shell customer360__panel' }, [
        h('div', { class: 'customer360__panel-title' }, [
          h('h2', t(`customer360.section.${panelProps.section}`)),
          panelProps.result ? h('span', String(panelProps.result.meta.total)) : null,
        ]),
        panelProps.filters.length || panelProps.showClosedFilter
          ? h('div', { class: 'customer360__related-filters', 'aria-label': t('filter.filter') }, [
              ...panelProps.filters.map((filter) =>
                h('div', { class: 'customer360__filter-group' }, [
                  h('small', filter.label),
                  h(
                    'span',
                    { class: 'customer360__filter-options' },
                    filter.options.map((option) => {
                      const selected =
                        panelProps.selectedFilters[filter.key]?.includes(option.handle) === true
                      return h(
                        'button',
                        {
                          type: 'button',
                          class: [
                            'customer360__filter-chip',
                            selected ? 'customer360__filter-chip--selected' : '',
                          ],
                          disabled: panelProps.loading,
                          'aria-pressed': selected,
                          onClick: () =>
                            emit('toggleFilter', {
                              groupKey: filter.key,
                              handle: option.handle,
                            }),
                        },
                        [
                          option.color
                            ? h('span', {
                                class: 'customer360__filter-swatch',
                                style: { backgroundColor: option.color },
                              })
                            : option.icon
                              ? h('i', { class: `mdi ${option.icon}` })
                              : null,
                          option.label,
                        ],
                      )
                    }),
                  ),
                ]),
              ),
              panelProps.showClosedFilter
                ? h('div', { class: 'customer360__filter-group' }, [
                    h('small', t('filter.filter')),
                    h('span', { class: 'customer360__filter-options' }, [
                      h(
                        'button',
                        {
                          type: 'button',
                          class: [
                            'customer360__filter-chip',
                            panelProps.includeClosed ? 'customer360__filter-chip--selected' : '',
                          ],
                          disabled: panelProps.loading,
                          'aria-pressed': panelProps.includeClosed,
                          onClick: () => emit('toggleClosed'),
                        },
                        [h('i', { class: 'mdi mdi-archive-outline' }), closedLabel()],
                      ),
                    ]),
                  ])
                : null,
            ])
          : null,
        panelProps.loading && !panelProps.result
          ? h(
              'div',
              {
                class:
                  'sapling-empty-state-panel sapling-empty-state-panel--compact customer360__empty',
              },
              t('global.loading'),
            )
          : panelProps.result?.data.length
            ? h(
                'div',
                { class: 'customer360__related' },
                panelProps.result.data.map((item) => {
                  const presentation = relatedPresentation(panelProps.section, item)
                  return h(
                    'button',
                    {
                      type: 'button',
                      class: 'sapling-panel-shell-muted customer360__related-card',
                      onClick: () =>
                        emit(
                          'open',
                          panelProps.result!.entityHandle,
                          item.handle as string | number,
                        ),
                    },
                    [
                      h('span', { class: 'customer360__related-header' }, [
                        h('span', { class: 'customer360__related-title' }, [
                          presentation.eyebrow
                            ? h('small', { class: 'sapling-label' }, presentation.eyebrow)
                            : null,
                          h('strong', presentation.title),
                        ]),
                        presentation.badges.length
                          ? h(
                              'span',
                              { class: 'customer360__related-badges' },
                              presentation.badges.map((badge) =>
                                h(
                                  'span',
                                  {
                                    class: [
                                      'customer360__status-badge',
                                      `customer360__status-badge--${badge.tone}`,
                                    ],
                                  },
                                  badge.text,
                                ),
                              ),
                            )
                          : null,
                      ]),
                      presentation.description
                        ? h(
                            'span',
                            { class: 'customer360__related-description' },
                            presentation.description,
                          )
                        : null,
                      presentation.details.length
                        ? h(
                            'span',
                            { class: 'customer360__related-details' },
                            presentation.details.map((detail) =>
                              h('span', { class: 'customer360__related-detail' }, [
                                h('small', [
                                  detail.icon ? h('i', { class: `mdi ${detail.icon}` }) : null,
                                  detail.label,
                                ]),
                                h('strong', detail.value),
                              ]),
                            ),
                          )
                        : null,
                      presentation.items.length
                        ? h(
                            'span',
                            { class: 'customer360__related-items' },
                            presentation.items.map((value) => h('span', value)),
                          )
                        : null,
                    ],
                  )
                }),
              )
            : h(
                'div',
                {
                  class:
                    'sapling-empty-state-panel sapling-empty-state-panel--compact customer360__empty',
                },
                t('customer360.noEntries'),
              ),
        panelProps.result && panelProps.result.meta.page < panelProps.result.meta.totalPages
          ? h(
              'button',
              { class: 'customer360__load-more', onClick: () => emit('loadMore') },
              t('customer360.loadMore'),
            )
          : null,
      ])
  },
})

function activityIcon(kind: Customer360ActivityKind) {
  return {
    emailInbound: 'mdi-email-receive-outline',
    emailOutbound: 'mdi-email-send-outline',
    call: 'mdi-phone-outline',
    appointment: 'mdi-calendar-outline',
    event: 'mdi-calendar-blank-outline',
  }[kind]
}
function recordLabel(item: Record<string, unknown>) {
  return (
    textValue(item.title) ||
    textValue(item.name) ||
    textValue(item.subject) ||
    [textValue(item.firstName), textValue(item.lastName)].filter(Boolean).join(' ') ||
    `#${textValue(item.handle)}`
  )
}

type RelatedBadgeTone = 'neutral' | 'info' | 'success' | 'warning'
interface RelatedBadge {
  text: string
  tone: RelatedBadgeTone
}
interface RelatedDetail {
  label: string
  value: string
  icon?: string
}
interface RelatedPresentation {
  eyebrow: string
  title: string
  description: string
  badges: RelatedBadge[]
  details: RelatedDetail[]
  items: string[]
}

function relatedPresentation(
  section: Customer360Section,
  item: Record<string, unknown>,
): RelatedPresentation {
  const base: RelatedPresentation = {
    eyebrow: '',
    title: recordLabel(item),
    description: '',
    badges: [],
    details: [],
    items: [],
  }

  if (section === 'tickets') {
    const status = objectValue(item.status)
    const statusLabel = relationLabel(status)
    const stateLabel = status ? openStateLabel(status.isOpen) : ''
    base.eyebrow = textValue(item.number) || `#${textValue(item.handle)}`
    base.description = previewText(item.problemDescription)
    base.badges = compactBadges([
      badge(statusLabel, status?.isOpen === false ? 'neutral' : 'info'),
      badge(
        statusLabel === stateLabel ? '' : stateLabel,
        status?.isOpen === false ? 'neutral' : 'success',
      ),
      badge(relationLabel(item.priority), 'warning'),
    ])
    base.details = compactDetails([
      detail(
        t('ticket.startDate'),
        firstText(formatOptionalDate(item.startDate), formatOptionalDate(item.createdAt)),
        'mdi-calendar-plus',
      ),
      detail(
        t('global.updatedAt'),
        firstText(
          formatOptionalDate(item.updatedAt),
          formatOptionalDate(item.resolvedAt),
          formatOptionalDate(item.endDate),
        ),
        'mdi-update',
      ),
      detail(t('ticket.assigneePerson'), relationLabel(item.assigneePerson), 'mdi-account-outline'),
      detail(
        t('ticket.deadlineDate'),
        firstText(formatOptionalDate(item.deadlineDate), formatOptionalDate(item.resolutionDueAt)),
        'mdi-timer-alert-outline',
      ),
    ])
    return base
  }

  if (section === 'opportunities') {
    base.eyebrow = textValue(item.number) || `#${textValue(item.handle)}`
    base.description = previewText(item.description)
    base.badges = compactBadges([
      badge(relationLabel(item.type), 'info'),
      badge(relationLabel(item.resultStatus), item.isActive === false ? 'neutral' : 'success'),
      item.isActive === false ? badge(closedLabel(), 'neutral') : null,
    ])
    base.details = compactDetails([
      detail(
        t('salesOpportunity.expectedRevenue'),
        optionalMoney(item.expectedRevenue),
        'mdi-cash-multiple',
      ),
      detail(
        t('salesOpportunity.probability'),
        optionalPercent(item.probability),
        'mdi-percent-outline',
      ),
      detail(
        t('salesOpportunity.closeDate'),
        formatOptionalDate(item.closeDate),
        'mdi-calendar-check-outline',
      ),
      detail(t('global.updatedAt'), formatOptionalDate(item.updatedAt), 'mdi-update'),
    ])
    const nextStep = previewText(item.nextStep, 120)
    if (nextStep) base.items.push(`${t('salesOpportunity.nextStep')}: ${nextStep}`)
    return base
  }

  if (section === 'effortEstimates') {
    base.eyebrow = `#${textValue(item.handle)}`
    base.description = previewText(item.requirementsMarkdown)
    base.badges = compactBadges([badge(relationLabel(item.status), 'info')])
    base.details = compactDetails([
      detail(t('customer360.estimates'), optionalHours(item.totalEstimatedHours), 'mdi-timer-sand'),
      detail(
        t('effortEstimate.expectedCompletionDate'),
        formatOptionalDate(item.expectedCompletionDate),
        'mdi-calendar-clock',
      ),
      detail(t('global.updatedAt'), formatOptionalDate(item.updatedAt), 'mdi-update'),
      detail(
        t('customer360.section.opportunities'),
        relationLabel(item.salesOpportunity),
        'mdi-chart-line',
      ),
    ])
    base.items = objectArray(item.positions)
      .slice(0, 4)
      .map((position) => {
        const hours = optionalHours(position.estimatedHours)
        return [relationLabel(position) || recordLabel(position), hours].filter(Boolean).join(' · ')
      })
    return base
  }

  if (section === 'contracts') {
    base.eyebrow = relationLabel(item.serviceLevel) || `#${textValue(item.handle)}`
    base.description = previewText(item.description)
    base.badges = compactBadges([
      badge(
        item.isActive === false ? closedLabel() : activeLabel(),
        item.isActive === false ? 'neutral' : 'success',
      ),
      badge(relationLabel(item.slaPolicy), 'info'),
    ])
    base.details = compactDetails([
      detail(t('contract.startDate'), formatOptionalDate(item.startDate), 'mdi-calendar-start'),
      detail(t('contract.endDate'), formatOptionalDate(item.endDate), 'mdi-calendar-end'),
      detail(
        t('contract.annualIncludedHours'),
        optionalHours(item.annualIncludedHours),
        'mdi-clock-check-outline',
      ),
      detail(
        t('contract.nextServiceDate'),
        formatOptionalDate(item.nextServiceDate),
        'mdi-calendar-wrench',
      ),
    ])
    base.items = objectArray(item.products)
      .slice(0, 5)
      .map((product) => relationLabel(product) || recordLabel(product))
      .filter(Boolean)
    return base
  }

  if (section === 'contacts') {
    base.eyebrow = [relationLabel(item.jobTitle), relationLabel(item.jobFunction)]
      .filter(Boolean)
      .join(' · ')
    base.badges = compactBadges([
      badge(relationLabel(item.decisionRole), 'info'),
      item.isActive === false ? badge(closedLabel(), 'neutral') : null,
    ])
    base.details = compactDetails([
      detail(t('person.email'), textValue(item.email), 'mdi-email-outline'),
      detail(t('person.phone'), textValue(item.phone), 'mdi-phone-outline'),
      detail(t('person.mobile'), textValue(item.mobile), 'mdi-cellphone'),
      detail(t('person.department'), relationLabel(item.department), 'mdi-office-building-outline'),
    ])
    return base
  }

  if (section === 'relationships') {
    const source = objectValue(item.sourceCompany)
    const target = objectValue(item.targetCompany)
    const currentHandle = String(props.recordHandle)
    const counterpart = String(source?.handle ?? '') === currentHandle ? target : source
    base.eyebrow = relationLabel(item.type)
    base.title =
      relationLabel(counterpart) ||
      [relationLabel(source), relationLabel(target)].filter(Boolean).join(' ↔ ') ||
      `#${textValue(item.handle)}`
    base.description = previewText(item.description)
    base.details = compactDetails([
      detail(t('companyRelationship.sourceCompany'), relationLabel(source), 'mdi-domain'),
      detail(t('companyRelationship.targetCompany'), relationLabel(target), 'mdi-domain'),
      detail(t('global.updatedAt'), formatOptionalDate(item.updatedAt), 'mdi-update'),
    ])
    return base
  }

  base.eyebrow = relationLabel(item.type)
  base.description = previewText(item.description)
  base.details = compactDetails([
    detail(t('global.createdAt'), formatOptionalDate(item.createdAt), 'mdi-calendar-plus'),
    detail(t('global.updatedAt'), formatOptionalDate(item.updatedAt), 'mdi-update'),
  ])
  return base
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}
function objectArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => Boolean(objectValue(entry)))
    : []
}
function badge(text: string, tone: RelatedBadgeTone): RelatedBadge | null {
  return text ? { text, tone } : null
}
function compactBadges(values: Array<RelatedBadge | null>): RelatedBadge[] {
  return values.filter((value): value is RelatedBadge => value != null)
}
function detail(label: string, value: string, icon?: string): RelatedDetail | null {
  return value ? { label, value, icon } : null
}
function compactDetails(values: Array<RelatedDetail | null>): RelatedDetail[] {
  return values.filter((value): value is RelatedDetail => value != null)
}
function previewText(value: unknown, maxLength = 180): string {
  const text = textValue(value)
    .replace(/[#*_>`~\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text
}
function formatOptionalDate(value: unknown): string {
  const raw = textValue(value)
  return raw ? formatDate(raw) : ''
}
function firstText(...values: string[]): string {
  return values.find(Boolean) ?? ''
}
function optionalMoney(value: unknown): string {
  const amount = Number(value)
  return Number.isFinite(amount) ? moneyOrDash(amount) : ''
}
function optionalPercent(value: unknown): string {
  const amount = Number(value)
  return Number.isFinite(amount) ? `${n(amount)} %` : ''
}
function optionalHours(value: unknown): string {
  const amount = Number(value)
  return Number.isFinite(amount) ? hoursOrDash(amount) : ''
}
function openStateLabel(value: unknown): string {
  return value === false ? closedLabel() : t('ticketStatus.isOpen')
}
function closedLabel(): string {
  return locale.value.toLowerCase().startsWith('de') ? 'Geschlossen' : 'Closed'
}
function activeLabel(): string {
  return locale.value.toLowerCase().startsWith('de') ? 'Aktiv' : 'Active'
}
</script>

<style>
.customer360 {
  --sapling-dashboard-page-gap: var(--sapling-gap-md);
  width: 100%;
  min-width: 0;
}

.customer360__hero {
  grid-template-columns: minmax(0, 1.1fr) minmax(var(--sapling-panel-width-lg), 1fr);
  padding: var(--sapling-space-panel-md);
}

.customer360__subtitle {
  width: 100%;
  margin: 0;
  font-size: var(--sapling-text-body-size-lg);
  opacity: var(--sapling-opacity-secondary);
}

.customer360__details,
.customer360__hero-side,
.customer360__actions {
  width: 100%;
}

.customer360__stat-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.customer360__stat-card {
  min-width: 0;
  gap: var(--sapling-gap-xs);
  padding: var(--sapling-gap-xs) var(--sapling-gap-md);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  background: var(--sapling-surface-accent-fill);
  transition:
    border-color var(--sapling-motion-standard) ease,
    background var(--sapling-motion-standard) ease;
}

.customer360__stat-card:hover,
.customer360__stat-card:focus-visible {
  border-color: var(--sapling-surface-border-accent-strong);
  background: var(--sapling-interactive-hover-fill);
}

.customer360__stat-row,
.customer360__stat-label {
  display: flex;
  align-items: center;
  min-width: 0;
}

.customer360__stat-row {
  justify-content: space-between;
  gap: var(--sapling-gap-md);
}

.customer360__stat-label {
  gap: var(--sapling-gap-xs);
}

.customer360__stat-row strong {
  flex: 0 0 auto;
  text-align: right;
}

.customer360__stat-card small {
  overflow: hidden;
  color: inherit;
  text-overflow: ellipsis;
  text-align: right;
  white-space: nowrap;
  opacity: var(--sapling-opacity-secondary);
}

.customer360__actions {
  justify-content: flex-end;
}

.customer360__warnings {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: var(--sapling-gap-md);
}

.customer360__warning {
  align-self: start;
  height: auto;
  margin: 0;
}

.customer360__workspace {
  gap: var(--sapling-gap-md);
  min-width: 0;
  overflow: hidden;
}

.customer360__tabs {
  flex: 0 0 auto;
  border-bottom: 1px solid var(--sapling-surface-border-muted);
}

.customer360__window {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  min-height: 0;
  padding-right: var(--sapling-space-2xs);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.customer360__activity-filters {
  min-width: min(100%, 360px);
}

.customer360__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sapling-gap-xl);
  align-items: start;
}

.customer360__panel {
  min-width: 0;
}

.customer360__panel--wide {
  grid-column: span 1;
}

.customer360__panel--full {
  grid-column: 1 / -1;
}

.customer360__panel h2 {
  margin: 0;
  font-size: var(--sapling-text-title-size-sm);
  line-height: 1.1;
}

.customer360__panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sapling-gap-md);
}

.customer360__panel-title span {
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
}

.customer360__related-filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sapling-gap-sm) var(--sapling-gap-xl);
  padding: var(--sapling-gap-sm);
  border: 1px solid var(--sapling-surface-border-muted);
  border-radius: var(--sapling-radius-sm);
  background: var(--sapling-surface-fill-subtle);
}

.customer360__filter-group {
  display: grid;
  min-width: 0;
  gap: var(--sapling-space-2xs);
}

.customer360__filter-group > small {
  font-size: var(--sapling-text-label-size-xs);
  font-weight: 700;
  text-transform: uppercase;
  opacity: var(--sapling-opacity-secondary);
}

.customer360__filter-options {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sapling-gap-xs);
}

.customer360__filter-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--sapling-space-2xs);
  min-height: var(--sapling-control-size-xs);
  padding: var(--sapling-space-2xs) var(--sapling-gap-sm);
  border: 1px solid var(--sapling-surface-border);
  border-radius: var(--sapling-radius-pill);
  color: inherit;
  background: var(--sapling-surface-fill);
  font: inherit;
  font-size: var(--sapling-text-label-size-xs);
  cursor: pointer;
  opacity: var(--sapling-opacity-secondary);
}

.customer360__filter-chip:hover,
.customer360__filter-chip:focus-visible {
  border-color: var(--sapling-surface-border-accent-strong);
}

.customer360__filter-chip:disabled {
  cursor: wait;
  opacity: var(--sapling-opacity-disabled);
}

.customer360__filter-chip--selected {
  border-color: rgba(var(--v-theme-primary), 0.45);
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.12);
  font-weight: 700;
  opacity: 1;
}

.customer360__filter-swatch {
  width: var(--sapling-space-sm);
  height: var(--sapling-space-sm);
  border-radius: 50%;
}

.customer360__list,
.customer360__related {
  display: grid;
  gap: var(--sapling-gap-xs);
  padding-right: var(--sapling-gap-xs);
}

.customer360__list-item,
.customer360__related button {
  width: 100%;
  padding: var(--sapling-gap-md);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.customer360__list-item {
  display: flex;
  gap: var(--sapling-gap-md);
}

.customer360__related-card {
  display: grid;
  gap: var(--sapling-gap-md);
}

.customer360__related-header,
.customer360__related-title,
.customer360__related-badges,
.customer360__related-details,
.customer360__related-items,
.customer360__related-detail {
  display: flex;
  min-width: 0;
}

.customer360__related-header {
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sapling-gap-xl);
}

.customer360__related-title {
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--sapling-gap-xs);
}

.customer360__related-title strong {
  font-size: var(--sapling-text-body-size-lg);
  line-height: 1.25;
}

.customer360__related-badges {
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--sapling-gap-xs);
}

.customer360__status-badge {
  padding: var(--sapling-space-2xs) var(--sapling-gap-sm);
  border: 1px solid var(--sapling-surface-border);
  border-radius: var(--sapling-radius-pill);
  background: var(--sapling-surface-fill-strong);
  font-size: var(--sapling-text-label-size-xs);
  font-weight: 700;
  line-height: 1.4;
}

.customer360__status-badge--info {
  color: rgb(var(--v-theme-info));
  background: rgba(var(--v-theme-info), 0.1);
}

.customer360__status-badge--success {
  color: rgb(var(--v-theme-success));
  background: rgba(var(--v-theme-success), 0.1);
}

.customer360__status-badge--warning {
  color: rgb(var(--v-theme-warning));
  background: rgba(var(--v-theme-warning), 0.1);
}

.customer360__related-description {
  display: -webkit-box;
  overflow: hidden;
  line-height: 1.45;
  opacity: var(--sapling-opacity-secondary);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.customer360__related-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--sapling-gap-xs);
}

.customer360__related-detail {
  flex-direction: column;
  gap: var(--sapling-space-2xs);
  padding: var(--sapling-gap-sm);
  border-radius: var(--sapling-radius-xs);
  background: var(--sapling-surface-fill-subtle);
}

.customer360__related-detail small {
  display: flex;
  align-items: center;
  gap: var(--sapling-gap-xs);
  font-size: var(--sapling-text-label-size-xs);
  text-transform: uppercase;
  opacity: var(--sapling-opacity-secondary);
}

.customer360__related-detail strong {
  overflow: hidden;
  font-size: var(--sapling-text-body-size-xs);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.customer360__related-items {
  flex-wrap: wrap;
  gap: var(--sapling-gap-xs);
}

.customer360__related-items > span {
  padding: var(--sapling-space-2xs) var(--sapling-gap-sm);
  border-radius: var(--sapling-radius-pill);
  background: var(--sapling-surface-fill-strong);
  font-size: var(--sapling-text-meta-size);
}

.customer360__list-item:hover,
.customer360__related button:hover {
  border-color: var(--sapling-surface-border-accent-strong);
  background: var(--sapling-interactive-hover-fill);
}

.customer360__list-item i {
  flex: 0 0 auto;
  font-size: var(--sapling-text-title-size-sm);
  color: rgb(var(--v-theme-primary));
}

.customer360__list-item span,
.customer360__related button {
  min-width: 0;
}

.customer360__list-item > span {
  flex: 1 1 auto;
}

.customer360__list-item strong,
.customer360__list-item small,
.customer360__list-item p,
.customer360__related strong,
.customer360__related small {
  display: block;
}

.customer360__list-item small,
.customer360__related small {
  opacity: var(--sapling-opacity-secondary);
}

.customer360__list-item p {
  margin: var(--sapling-gap-xs) 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: var(--sapling-opacity-secondary);
}

.customer360__facts {
  display: grid;
  gap: var(--sapling-gap-md);
}

.customer360__facts div {
  display: flex;
  justify-content: space-between;
  gap: var(--sapling-gap-xl);
  padding-bottom: var(--sapling-gap-md);
  border-bottom: 1px solid var(--sapling-surface-border-muted);
}

.customer360__facts div:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.customer360__facts span {
  opacity: var(--sapling-opacity-secondary);
}

.customer360__empty {
  min-height: var(--sapling-empty-state-min-height-sm);
}

.customer360__load-more {
  width: fit-content;
  margin-top: var(--sapling-gap-md);
  padding: var(--sapling-gap-xs) 0;
  border: 0;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

@media (max-width: 760px) {
  .customer360__hero {
    grid-template-columns: minmax(0, 1fr);
  }

  .customer360__actions {
    justify-content: flex-start;
  }
}

@media (max-width: 900px) {
  .customer360__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .customer360__stat-grid {
    grid-template-columns: 1fr;
  }

  .customer360__facts div {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--sapling-gap-xs);
  }

  .customer360__related-header {
    flex-direction: column;
    gap: var(--sapling-gap-sm);
  }

  .customer360__related-badges {
    justify-content: flex-start;
  }
}
</style>
