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

    <div v-else-if="error" class="sapling-action-cluster">
      <v-btn variant="tonal" prepend-icon="mdi-refresh" @click="load">
        {{ $t('customer360.retry') }}
      </v-btn>
    </div>

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
        <v-tabs v-model="tab" class="customer360__tabs sapling-admin-tabs" show-arrows>
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
                  <SaplingAutocomplete
                    v-model="activityDirection"
                    :items="activityDirectionOptions"
                    density="compact"
                    hide-details
                    variant="outlined"
                  />
                  <SaplingAutocomplete
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
              :record-handle="recordHandle"
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
                :record-handle="recordHandle"
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
                :record-handle="recordHandle"
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
              :record-handle="recordHandle"
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
                :record-handle="recordHandle"
                :result="related.contacts"
                :loading="relatedLoading.contacts"
                @load-more="loadMoreRelated('contacts')"
                @open="openRecord"
              />
              <RelatedPanel
                v-if="hasSection('relationships')"
                section="relationships"
                :record-handle="recordHandle"
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
                :record-handle="recordHandle"
                :result="related.documents"
                :loading="relatedLoading.documents"
                @load-more="loadMoreRelated('documents')"
                @open="openRecord"
              />
              <section class="sapling-section-panel sapling-panel-shell customer360__panel">
                <h2>{{ $t('customer360.brief') }}</h2>
                <SaplingTextarea
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
import SaplingDialogEdit from '@/components/dialog/SaplingDialogEdit.vue'
import SaplingAutocomplete from '@/components/common/SaplingAutocomplete.vue'
import SaplingPageHero from '@/components/common/SaplingPageHero.vue'
import SaplingTextarea from '@/components/common/SaplingTextarea.vue'
import SaplingCustomer360ActivityList from './SaplingCustomer360ActivityList.vue'
import SaplingCustomer360RelatedPanel from './SaplingCustomer360RelatedPanel.vue'
import {
  useSaplingCustomer360,
  type SaplingCustomer360Props,
} from '@/composables/customer360/useSaplingCustomer360'

const props = defineProps<SaplingCustomer360Props>()
const ActivityList = SaplingCustomer360ActivityList
const RelatedPanel = SaplingCustomer360RelatedPanel
const {
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
} = useSaplingCustomer360(props)
</script>
