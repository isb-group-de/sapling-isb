<template>
  <v-container
    class="sapling-page-shell sapling-page-shell--panel sapling-page-shell--fill sapling-page-shell--uniform-inset sapling-crm-workspace"
    fluid
  >
    <section
      v-if="isPreparing"
      class="sapling-crm-workspace__loading-grid sapling-crm-workspace__loading-grid--page"
    >
      <v-skeleton-loader
        v-for="item in 6"
        :key="item"
        class="sapling-crm-workspace__loading-card"
        type="article, list-item-two-line"
      />
    </section>

    <template v-else>
      <SaplingPageHero
        class="sapling-crm-workspace__hero"
        variant="workspace"
        :eyebrow="t('navigation.crmWorkspace')"
        :title="t('crmWorkspace.title')"
      >
        <template #title-prefix>
          <v-icon size="30">mdi-view-dashboard-variant-outline</v-icon>
        </template>
        <p class="sapling-crm-workspace__subtitle">{{ t('crmWorkspace.subtitle') }}</p>
        <template #side>
          <div class="sapling-crm-workspace__hero-side">
            <button
              v-for="metric in heroMetrics"
              :key="metric.key"
              type="button"
              class="sapling-crm-workspace-metric"
              :class="{
                'sapling-crm-workspace-metric--active': activeCockpit === metric.cockpit,
              }"
              :aria-pressed="activeCockpit === metric.cockpit"
              @click="activeCockpit = metric.cockpit"
            >
              <span>{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
            </button>
            <v-btn
              class="sapling-crm-workspace__refresh"
              prepend-icon="mdi-refresh"
              variant="text"
              :disabled="isLoading"
              @click="loadData"
            >
              {{ t('global.refresh') }}
            </v-btn>
          </div>
        </template>
      </SaplingPageHero>

      <SaplingCrmWorkspaceToolbar
        v-model:active-cockpit="activeCockpit"
        v-model:search="search"
        v-model:selected-responsible-handle="selectedResponsibleHandle"
        v-model:selected-segment-handle="selectedSegmentHandle"
        v-model:contact-threshold-days="contactThresholdDays"
        v-model:opportunity-horizon-days="opportunityHorizonDays"
        :active-filter-count="activeFilterCount"
        :cockpit-counts="cockpitCounts"
        :responsible-person-options="responsiblePersonOptions"
        :segment-options="segmentOptions"
        :contact-threshold-options="contactThresholdOptions"
        :opportunity-horizon-options="opportunityHorizonOptions"
        @reset-filters="resetFilters"
      />
      <v-progress-linear
        v-if="isLoading && hasLoadedOnce"
        class="sapling-crm-workspace__progress"
        color="primary"
        indeterminate
      />

      <section class="sapling-crm-workspace__layout">
        <main class="sapling-crm-workspace__main">
          <SaplingCrmSalesPanel
            v-if="activeCockpit === 'sales'"
            :eyebrow="t('crmWorkspace.salesCockpit')"
            :title="t('crmWorkspace.salesFocus')"
            :opportunity-count="filteredOpenOpportunities.length"
            :stages="salesStageBreakdown"
            :items="opportunitiesWithoutNextActivityItems"
            :list-title="t('crmWorkspace.opportunitiesWithoutNextActivity')"
            :empty-text="t('crmWorkspace.noOpenOpportunityGaps')"
            :format-money="formatMoney"
            @open-stage="openOpportunityStage"
            @open-item="openWorkspaceItem"
          />
          <SaplingCrmAccountPanel
            v-else-if="activeCockpit === 'account'"
            :eyebrow="t('crmWorkspace.accountCockpit')"
            :title="t('crmWorkspace.accountFocus')"
            :company-count="filteredCompanies.length"
            :top-accounts="topAccountItems"
            :contact-gap-items="customersWithoutContactItems"
            :list-title="t('crmWorkspace.customersWithoutContact')"
            :empty-text="t('crmWorkspace.noCustomerContactGaps')"
            @open-item="openWorkspaceItem"
          />
          <SaplingCrmCustomerSuccessPanel
            v-else
            :eyebrow="t('crmWorkspace.customerSuccessCockpit')"
            :title="t('crmWorkspace.customerSuccessFocus')"
            :risk-count="atRiskCustomerItems.length"
            :risk-items="atRiskCustomerItems"
            :risk-title="t('crmWorkspace.atRiskCustomers')"
            :risk-empty-text="t('crmWorkspace.noCustomerRisks')"
            :contact-gap-items="customersWithoutContactItems"
            :contact-gap-title="t('crmWorkspace.customersWithoutContact')"
            :contact-gap-empty-text="t('crmWorkspace.noCustomerContactGaps')"
            @open-item="openWorkspaceItem"
          />
        </main>

        <aside class="sapling-crm-workspace__side">
          <SaplingCrmWorkspaceList
            class="sapling-crm-workspace__priority-list"
            :title="t('crmWorkspace.contactToday')"
            :items="todayContactItems"
            empty-icon="mdi-phone-check-outline"
            :empty-text="t('crmWorkspace.noContactToday')"
            @open="openWorkspaceItem"
          />
          <SaplingCrmSignalsPanel
            :eyebrow="t('crmWorkspace.signalOverview')"
            :title="t('crmWorkspace.crmHealth')"
            :signals="signals"
            @open="openSignal"
          />
        </aside>
      </section>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SaplingPageHero from '@/components/common/SaplingPageHero.vue'
import SaplingCrmAccountPanel from './SaplingCrmAccountPanel.vue'
import SaplingCrmCustomerSuccessPanel from './SaplingCrmCustomerSuccessPanel.vue'
import SaplingCrmSalesPanel from './SaplingCrmSalesPanel.vue'
import SaplingCrmSignalsPanel from './SaplingCrmSignalsPanel.vue'
import SaplingCrmWorkspaceList from './SaplingCrmWorkspaceList.vue'
import SaplingCrmWorkspaceToolbar from './SaplingCrmWorkspaceToolbar.vue'
import { useSaplingCrmWorkspace } from '@/composables/crm/useSaplingCrmWorkspace'

const { t } = useI18n()
const {
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
  hasLoadedOnce,
  heroMetrics,
  isLoading,
  isPreparing,
  loadData,
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
} = useSaplingCrmWorkspace()
</script>
