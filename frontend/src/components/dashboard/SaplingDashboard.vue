<template>
  <v-container class="sapling-page-shell sapling-page-shell--uniform-inset sapling-dashboard" fluid>
    <template v-if="isLoading || !currentPersonStore.loaded">
      <section class="sapling-dashboard__overview">
        <div class="sapling-dashboard__hero sapling-dashboard__hero--loading glass-panel">
          <div class="sapling-dashboard__copy sapling-dashboard__copy--skeleton">
            <span class="sapling-dashboard__skeleton-bone sapling-dashboard__eyebrow-skeleton" />
            <span class="sapling-dashboard__skeleton-bone sapling-dashboard__title-skeleton" />
            <span
              class="sapling-dashboard__skeleton-bone sapling-dashboard__title-skeleton sapling-dashboard__title-skeleton--short"
            />
            <span class="sapling-dashboard__skeleton-bone sapling-dashboard__subtitle-skeleton" />
          </div>

          <div class="sapling-dashboard__actions-skeleton">
            <div v-for="item in 4" :key="item" class="sapling-dashboard__action-skeleton">
              <span
                class="sapling-dashboard__skeleton-bone sapling-dashboard__action-icon-skeleton"
              />
              <span
                class="sapling-dashboard__skeleton-bone sapling-dashboard__action-line-skeleton"
              />
            </div>
          </div>
        </div>

        <div
          class="sapling-card-strip sapling-dashboard__favorites sapling-dashboard__favorites--loading glass-panel"
        >
          <div class="sapling-card-strip__track">
            <div
              v-for="item in 12"
              :key="item"
              class="sapling-dashboard-favorite-button sapling-dashboard-favorite-button--loading sapling-panel-shell-muted"
            >
              <span
                class="sapling-dashboard__skeleton-bone sapling-dashboard-favorite-button__icon-skeleton"
              />
              <span
                class="sapling-dashboard__skeleton-bone sapling-dashboard-favorite-button__text-skeleton"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="sapling-dashboard__board glass-panel">
        <div
          class="sapling-tabs-shell sapling-dashboard__tabs-shell sapling-dashboard__tabs-shell--loading"
        >
          <div v-for="item in 6" :key="item" class="sapling-dashboard__tab-skeleton">
            <span class="sapling-dashboard__skeleton-bone sapling-dashboard__tab-title-skeleton" />
            <span class="sapling-dashboard__skeleton-bone sapling-dashboard__tab-meta-skeleton" />
          </div>
        </div>

        <v-row class="sapling-kpi-grid sapling-dashboard__kpi-skeleton-grid" density="comfortable">
          <v-col v-for="item in 8" :key="item" cols="12" sm="6" lg="4" xl="3">
            <div class="sapling-dashboard__loading-card">
              <div class="sapling-dashboard__loading-card-header">
                <v-skeleton-loader type="text" class="sapling-dashboard__loading-chip" />
                <div class="sapling-dashboard__loading-card-actions">
                  <span
                    v-for="action in 3"
                    :key="action"
                    class="sapling-dashboard__skeleton-bone sapling-dashboard__loading-action"
                  />
                </div>
              </div>
              <v-skeleton-loader type="heading" class="sapling-dashboard__loading-title" />
              <v-skeleton-loader type="paragraph" class="sapling-dashboard__loading-copy" />
              <v-skeleton-loader type="image" class="sapling-dashboard__loading-visual" />
            </div>
          </v-col>
        </v-row>
      </section>
    </template>
    <template v-else>
      <section class="sapling-dashboard__overview">
        <SaplingPageHero
          class="sapling-dashboard__hero"
          data-tutorial="dashboard-workspace"
          variant="workspace"
          :eyebrow="$t('dashboard.workspace')"
          :title="currentDashboard?.name || $t('dashboard.executiveOverview')"
          :subtitle="$t('dashboard.workspaceSubtitle')"
        >
          <div class="sapling-dashboard__layout-actions" data-tutorial="dashboard-layout-action">
            <v-btn
              v-if="!isLayoutEditing"
              color="primary"
              variant="tonal"
              prepend-icon="mdi-pencil-outline"
              :aria-label="$t('dashboard.editLayout')"
              :title="$t('dashboard.editLayout')"
              :disabled="!hasDashboards || !currentPersonStore.loaded"
              @click="beginLayoutEdit"
            >
              <template v-if="$vuetify.display.mdAndUp">
                {{ $t('dashboard.editLayout') }}
              </template>
            </v-btn>
            <template v-else>
              <v-btn
                color="primary"
                variant="flat"
                prepend-icon="mdi-content-save-check-outline"
                :loading="isLayoutSaving"
                :disabled="isLayoutSaving"
                :aria-label="$t('dashboard.saveLayout')"
                :title="$t('dashboard.saveLayout')"
                @click="saveLayout"
              >
                <template v-if="$vuetify.display.mdAndUp">
                  {{ $t('dashboard.saveLayout') }}
                </template>
              </v-btn>
              <v-btn
                color="primary"
                variant="text"
                prepend-icon="mdi-close"
                :disabled="isLayoutSaving"
                :aria-label="$t('dashboard.cancelLayout')"
                :title="$t('dashboard.cancelLayout')"
                @click="cancelLayoutEdit"
              >
                <template v-if="$vuetify.display.mdAndUp">
                  {{ $t('dashboard.cancelLayout') }}
                </template>
              </v-btn>
            </template>
          </div>

          <template #side>
            <SaplingDashboardHeroActions
              data-tutorial="dashboard-actions"
              :has-dashboards="hasDashboards"
              :current-person-loaded="currentPersonStore.loaded"
              :is-layout-editing="isLayoutEditing"
              @add-kpi="requestAddKpi"
              @open-dashboard="openDashboardDialog"
              @open-template-load="openDashboardTemplateLoadDialog"
              @open-template-save="openDashboardTemplateSaveDialog"
            />
          </template>
        </SaplingPageHero>

        <SaplingDashboardRecommendedFavorites />
      </section>

      <SaplingDashboardTabs
        v-if="hasDashboards"
        v-model:active-tab="activeTab"
        :dashboards="dashboards"
        :add-kpi-request-key="addKpiRequestKey"
        :add-kpi-request-dashboard-handle="addKpiRequestDashboardHandle"
        :is-dashboard-removable="isDashboardRemovable"
        :layout-editing="isLayoutEditing"
        @remove-dashboard="removeDashboard"
        @update-kpis="updateDashboardKpis"
        @reorder-dashboards="reorderDashboards"
      />

      <SaplingDashboardEmptyState
        v-else
        @open-dashboard="openDashboardDialog"
        @open-template-load="openDashboardTemplateLoadDialog"
      />

      <SaplingDialogEdit
        :model-value="dashboardDialog.visible"
        :mode="dashboardDialog.mode"
        :item="dashboardDialog.item"
        :templates="dashboardEntityTemplates"
        :entity="dashboardEntity"
        @update:model-value="updateDashboardDialogVisibility"
        @update:mode="updateDashboardDialogMode"
        @update:item="updateDashboardDialogItem"
        @save="onDashboardSave"
        @cancel="closeDashboardDialog"
      />

      <SaplingDialogEdit
        :model-value="dashboardTemplateDialog.visible"
        :mode="dashboardTemplateDialog.mode"
        :item="dashboardTemplateDialog.item"
        :templates="dashboardTemplateEntityTemplates"
        :entity="dashboardTemplateEntity"
        allow-pristine-create
        @update:model-value="updateDashboardTemplateDialogVisibility"
        @update:mode="updateDashboardTemplateDialogMode"
        @update:item="updateDashboardTemplateDialogItem"
        @save="onDashboardTemplateSave"
        @cancel="closeDashboardTemplateDialog"
      />

      <SaplingDashboardTemplateLoadDialog
        :model-value="dashboardTemplateLoadDialog"
        :templates="availableDashboardTemplates"
        :busy="applyingDashboardTemplateHandle !== null"
        :busy-template-handle="applyingDashboardTemplateHandle"
        @update:model-value="updateDashboardTemplateLoadDialogVisibility"
        @select="loadDashboardFromTemplate"
      />

      <SaplingDialogDelete
        v-model:modelValue="dashboardDeleteDialog"
        :item="dashboardToDelete"
        @confirm="confirmDashboardDelete"
        @cancel="cancelDashboardDelete"
      />
    </template>
  </v-container>
</template>

<script setup lang="ts">
// #region Imports
import { useSaplingDashboard } from '@/composables/dashboard/useSaplingDashboard'
import SaplingDashboardEmptyState from '@/components/dashboard/SaplingDashboardEmptyState.vue'
import SaplingDashboardHeroActions from '@/components/dashboard/SaplingDashboardHeroActions.vue'
import SaplingDashboardRecommendedFavorites from '@/components/dashboard/SaplingDashboardRecommendedFavorites.vue'
import SaplingDashboardTemplateLoadDialog from '@/components/dashboard/SaplingDashboardTemplateLoadDialog.vue'
import SaplingDashboardTabs from '@/components/dashboard/SaplingDashboardTabs.vue'
import SaplingDialogDelete from '@/components/dialog/SaplingDialogDelete.vue'
import SaplingDialogEdit from '@/components/dialog/SaplingDialogEdit.vue'
import SaplingPageHero from '@/components/common/SaplingPageHero.vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { SAPLING_SET_DASHBOARD_TUTORIAL_LAYOUT_EVENT } from '@/services/dashboard-tutorial.service'
// #endregion

// #region Composable
const {
  dashboardDeleteDialog,
  dashboardToDelete,
  dashboardDialog,
  dashboardTemplateDialog,
  dashboardTemplateLoadDialog,
  applyingDashboardTemplateHandle,
  dashboardEntity,
  dashboardEntityTemplates,
  dashboardTemplateEntity,
  dashboardTemplateEntityTemplates,
  availableDashboardTemplates,
  isLoading,
  dashboards,
  activeTab,
  currentPersonStore,
  currentDashboard,
  hasDashboards,
  isDashboardRemovable,
  isLayoutEditing,
  isLayoutSaving,
  cancelDashboardDelete,
  closeDashboardDialog,
  closeDashboardTemplateDialog,
  openDashboardDialog,
  openDashboardTemplateLoadDialog,
  openDashboardTemplateSaveDialog,
  updateDashboardDialogVisibility,
  updateDashboardDialogMode,
  updateDashboardDialogItem,
  updateDashboardTemplateDialogVisibility,
  updateDashboardTemplateDialogMode,
  updateDashboardTemplateDialogItem,
  updateDashboardTemplateLoadDialogVisibility,
  confirmDashboardDelete,
  loadDashboardFromTemplate,
  onDashboardSave,
  onDashboardTemplateSave,
  removeDashboard,
  updateDashboardKpis,
  beginLayoutEdit,
  cancelLayoutEdit,
  reorderDashboards,
  saveLayout,
} = useSaplingDashboard()

const addKpiRequestKey = ref(0)
const addKpiRequestDashboardHandle = ref<number | null>(null)
const tutorialStartedLayoutEdit = ref(false)

function requestAddKpi() {
  if (!hasDashboards.value || currentDashboard.value?.handle == null) {
    return
  }

  addKpiRequestDashboardHandle.value = currentDashboard.value.handle
  addKpiRequestKey.value += 1
}

function handleTutorialLayout(event: Event) {
  const shouldEdit = (event as CustomEvent<boolean>).detail

  if (shouldEdit && !isLayoutEditing.value && hasDashboards.value) {
    beginLayoutEdit()
    tutorialStartedLayoutEdit.value = true
    return
  }

  if (!shouldEdit && tutorialStartedLayoutEdit.value) {
    cancelLayoutEdit()
    tutorialStartedLayoutEdit.value = false
  }
}

onMounted(() => {
  window.addEventListener(SAPLING_SET_DASHBOARD_TUTORIAL_LAYOUT_EVENT, handleTutorialLayout)
})

onBeforeUnmount(() => {
  window.removeEventListener(SAPLING_SET_DASHBOARD_TUTORIAL_LAYOUT_EVENT, handleTutorialLayout)
  if (tutorialStartedLayoutEdit.value) {
    cancelLayoutEdit()
    tutorialStartedLayoutEdit.value = false
  }
})
// #endregion
</script>
