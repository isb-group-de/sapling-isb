<template>
  <v-container
    data-tutorial="partner-workspace"
    class="sapling-fill-shell sapling-min-size-0 sapling-partner-container pa-0"
    density="compact"
    fluid
  >
    <section
      class="sapling-partner-layout"
      :class="{ 'sapling-partner-layout--panel-hidden': !showDesktopFilterPanel }"
    >
      <div
        data-tutorial="partner-table"
        class="sapling-stack-md sapling-min-size-0 sapling-partner-main-table-col pa-0"
      >
        <v-card flat class="sapling-stack-md sapling-partner-main-table-card rounded-0">
          <v-card-text class="sapling-stack-md sapling-partner-table-text pa-0 flex-grow-1">
            <div class="sapling-scroll-region sapling-partner-table-scroll">
              <SaplingTable
                :items="items"
                :search="search ?? ''"
                :page="page"
                :items-per-page="itemsPerPage"
                :total-items="totalItems"
                :is-loading="isLoading"
                :sort-by="sortBy"
                :column-filters="columnFilters"
                :active-filter="activeFilter"
                :entity-handle="entity?.handle || ''"
                :entity="entity"
                :entity-permission="entityPermission"
                :entity-templates="entityTemplates || []"
                :is-initialized="isInitialized"
                :form-config-menu-items="formConfigMenuItems"
                :selected-form-config-label="selectedFormConfigLabel"
                :is-loading-form-configs="isLoadingFormConfigs"
                :is-saving-table-view="isSavingTableView"
                :show-actions="true"
                :multi-select="true"
                :show-favorite="true"
                :show-add="true"
                :show-side-panel-toggle="true"
                :side-panel-visible="isFilterPanelVisible"
                :side-panel-toggle-label="filterPanelToggleLabel"
                :open-edit-handle="openEditHandle"
                sync-edit-dialog-with-route
                side-panel-toggle-icon="mdi-account-group-outline"
                :parent-filter="parentFilter"
                :table-key="tableKey"
                @update:search="onSearchUpdate"
                @update:page="onPageUpdate"
                @update:items-per-page="onItemsPerPageUpdate"
                @update:sort-by="onSortByUpdate"
                @update:column-filters="onColumnFiltersUpdate"
                @toggle-side-panel="toggleFilterPanel"
                @select-form-config="selectFormConfig"
                @set-default-form-config="setDefaultFormConfig"
                @save-current-view="saveCurrentView"
                @update:visible-column-keys="onVisibleColumnKeysUpdate"
                @reload="loadData"
              />
            </div>
          </v-card-text>
        </v-card>
      </div>

      <SaplingWorkFilterPanel
        v-if="!isMobileFilterLayout"
        :key="filterDrawerKey"
        v-show="showDesktopFilterPanel"
        class="sapling-partner-filter-panel"
        :chip-filters="chipFilters"
        :selected-peoples="selectedPeopleHandles"
        :selected-chip-filters="selectedChipFilters"
        @update:selected-peoples="onSelectedPeoplesUpdate"
        @update:selected-chip-filters="onSelectedChipFiltersUpdate"
      />

      <v-dialog
        v-if="isMobileFilterLayout"
        v-model="mobileFilterDialogVisible"
        class="sapling-partner-filter-dialog"
        :max-width="SAPLING_DIALOG_MAX_WIDTH.md"
        scrollable
      >
        <SaplingDialogCard
          class="sapling-partner-filter-dialog__surface"
          :tilt="false"
          :close="() => (mobileFilterDialogVisible = false)"
        >
          <SaplingWorkFilterPanel
            :key="filterDrawerKey"
            class="sapling-partner-filter-panel sapling-partner-filter-panel--dialog"
            :show-close-action="true"
            :close-action-label="filterDialogCloseLabel"
            :chip-filters="chipFilters"
            :selected-peoples="selectedPeopleHandles"
            :selected-chip-filters="selectedChipFilters"
            @close="mobileFilterDialogVisible = false"
            @update:selected-peoples="onSelectedPeoplesUpdate"
            @update:selected-chip-filters="onSelectedChipFiltersUpdate"
          />
        </SaplingDialogCard>
      </v-dialog>
    </section>

    <SaplingPartnerTutorial
      v-if="isInitialized && props.entityHandle === 'ticket'"
      :filter-panel-visible="isFilterPanelVisible"
      @show-filter-panel="showTutorialFilterPanel"
    />
  </v-container>
</template>

<script lang="ts" setup>
// #region Imports
import { computed, defineAsyncComponent, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
import { useRoute } from 'vue-router'
import SaplingWorkFilterPanel from '@/components/filter/SaplingWorkFilterPanel.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingPartnerTutorial from '@/components/system/tutorial/SaplingPartnerTutorial.vue'
import { useSaplingPartner } from '@/composables/partner/useSaplingPartner'
import { SAPLING_DIALOG_MAX_WIDTH } from '@/constants/dialog.constants'
// #endregion

const SaplingTable = defineAsyncComponent(() => import('@/components/table/SaplingTable.vue'))
const PARTNER_FILTER_DIALOG_BREAKPOINT = 1080

// #region Props
const props = defineProps<{ entityHandle: string }>()
const entityHandleRef = toRef(props, 'entityHandle')
const route = useRoute()
// #endregion

const { t } = useI18n()
const { width } = useDisplay()

const isMobileFilterLayout = computed(() => width.value <= PARTNER_FILTER_DIALOG_BREAKPOINT)
const desktopFilterPanelVisible = ref(true)
const mobileFilterDialogVisible = ref(false)

const showDesktopFilterPanel = computed(
  () => !isMobileFilterLayout.value && desktopFilterPanelVisible.value,
)

const isFilterPanelVisible = computed(() =>
  isMobileFilterLayout.value ? mobileFilterDialogVisible.value : desktopFilterPanelVisible.value,
)
const openEditHandle = computed(() => {
  const value = Array.isArray(route.query.open) ? route.query.open[0] : route.query.open
  return typeof value === 'string' && value.trim().length > 0 ? value : null
})

const filterPanelLabel = computed(() => {
  const labels = [t('navigation.person'), t('navigation.company')]

  labels.push(...chipFilters.value.map((filter) => filter.label))

  return labels.join(' & ')
})

const filterPanelToggleLabel = computed(() =>
  isFilterPanelVisible.value
    ? `${filterPanelLabel.value} ausblenden`
    : `${filterPanelLabel.value} einblenden`,
)

const filterDialogCloseLabel = computed(() => t('global.close'))

watch(isMobileFilterLayout, (isMobile) => {
  if (!isMobile) {
    mobileFilterDialogVisible.value = false
  }
})

function toggleFilterPanel() {
  if (isMobileFilterLayout.value) {
    mobileFilterDialogVisible.value = !mobileFilterDialogVisible.value
    return
  }

  desktopFilterPanelVisible.value = !desktopFilterPanelVisible.value
}

function showTutorialFilterPanel() {
  if (isFilterPanelVisible.value) {
    return
  }

  if (isMobileFilterLayout.value) {
    mobileFilterDialogVisible.value = true
  } else {
    desktopFilterPanelVisible.value = true
  }
}

// #region Composable
const {
  items,
  search,
  page,
  itemsPerPage,
  totalItems,
  isLoading,
  sortBy,
  columnFilters,
  activeFilter,
  entityTemplates,
  entity,
  entityPermission,
  formConfigMenuItems,
  selectedFormConfigLabel,
  isLoadingFormConfigs,
  isSavingTableView,
  isInitialized,
  loadData,
  onSearchUpdate,
  onPageUpdate,
  onItemsPerPageUpdate,
  onColumnFiltersUpdate,
  onSortByUpdate,
  onVisibleColumnKeysUpdate,
  selectFormConfig,
  setDefaultFormConfig,
  savePersonalTableView,
  parentFilter,
  selectedPeopleHandles,
  tableKey,
  filterDrawerKey,
  chipFilters,
  selectedChipFilters,
  onSelectedPeoplesUpdate,
  onSelectedChipFiltersUpdate,
} = useSaplingPartner(entityHandleRef)

async function saveCurrentView(request: {
  name: string
  orderedColumnKeys: string[]
  selectableColumnKeys: string[]
  complete: (saved: boolean) => void
}): Promise<void> {
  try {
    await savePersonalTableView(
      request.name,
      request.orderedColumnKeys,
      request.selectableColumnKeys,
    )
    request.complete(true)
  } catch {
    request.complete(false)
  }
}

// #endregion
</script>
