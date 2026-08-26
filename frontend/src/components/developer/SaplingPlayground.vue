<template>
  <v-container
    class="sapling-page-shell sapling-page-shell--panel sapling-page-shell--fill sapling-page-shell--scroll sapling-page-shell--uniform-inset sapling-showcase sapling-playground"
    fluid
  >
    <SaplingPlaygroundShowcase
      :action-cards="actionCards"
      :dialog-launchers="dialogLaunchers"
      :metrics="metrics"
      :entity-handle="showcaseEntityHandle"
      :template-count="entityTemplates.length"
      :can-open-edit-dialog="hasEditContext"
      @open-edit="openEditDialog"
      @open-mail="openMailDialogShowcase"
      @message="simulateMessage"
    />

    <SaplingPlaygroundFieldGallery
      v-model:phone="phoneFieldValue"
      v-model:mail="mailFieldValue"
      v-model:link="linkFieldValue"
    />

    <SaplingPlaygroundKpiGallery :cards="kpiCards" />

    <v-row>
      <v-col cols="12">
        <SaplingPlaygroundCard
          id="playground-data-surfaces"
          :title="t('playground.searchAndTable')"
        >
          <SaplingTable
            entity-handle="company"
            :items="items"
            :search="search"
            :page="page"
            :items-per-page="itemsPerPage"
            :total-items="totalItems"
            :is-loading="isTableLoading"
            :sort-by="sortBy"
            :column-filters="columnFilters"
            :active-filter="activeFilter"
            :entity-templates="entityTemplates"
            :entity="entity"
            :entity-permission="entityPermission"
            :show-actions="true"
            :multi-select="false"
            table-key="company"
            @update:page="onPageUpdate"
            @update:items-per-page="onItemsPerPageUpdate"
            @update:sort-by="onSortByUpdate"
            @update:column-filters="onColumnFiltersUpdate"
            @update:search="onSearchUpdate"
            @reload="loadData"
          />
        </SaplingPlaygroundCard>
      </v-col>
    </v-row>

    <SaplingDialogDelete
      :model-value="deleteDialogModel"
      :item="deleteDialogItem"
      :tilt="false"
      @update:model-value="deleteDialogModel = $event"
      @confirm="handleDeleteConfirm"
      @cancel="handleDeleteCancel"
    />

    <SaplingDialogKpi
      :add-kpi-dialog="kpiDialogModel"
      :selected-kpi="selectedKpi"
      :tilt="false"
      :validate-and-add-kpi="handleKpiAdd"
      :close-dialog="closeKpiDialog"
      @update:add-kpi-dialog="kpiDialogModel = $event"
      @update:selected-kpi="selectedKpi = $event"
    />

    <SaplingDialogEdit
      :model-value="editDialogModel"
      :mode="editDialogMode"
      :item="editDialogItem"
      :entity="entity"
      :templates="entityTemplates"
      @update:model-value="editDialogModel = $event"
      @save="handleEditSave"
      @cancel="handleEditCancel"
    />
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingDialogDelete from '@/components/dialog/SaplingDialogDelete.vue'
import SaplingDialogEdit from '@/components/dialog/SaplingDialogEdit.vue'
import SaplingDialogKpi from '@/components/dialog/SaplingDialogKpi.vue'
import SaplingTable from '@/components/table/SaplingTable.vue'
import { useSaplingPlaygroundKpis } from '@/composables/developer/useSaplingPlaygroundKpis'
import { useSaplingPlaygroundShowcase } from '@/composables/developer/useSaplingPlaygroundShowcase'
import { useSaplingTable } from '@/composables/table/useSaplingTable'
import SaplingPlaygroundCard from './SaplingPlaygroundCard.vue'
import SaplingPlaygroundFieldGallery from './SaplingPlaygroundFieldGallery.vue'
import SaplingPlaygroundKpiGallery from './SaplingPlaygroundKpiGallery.vue'
import SaplingPlaygroundShowcase from './SaplingPlaygroundShowcase.vue'

const { t } = useI18n()
const phoneFieldValue = ref('')
const mailFieldValue = ref('')
const linkFieldValue = ref('')

const {
  items,
  search,
  page,
  itemsPerPage,
  totalItems,
  isLoading: isTableLoading,
  sortBy,
  columnFilters,
  activeFilter,
  entityTemplates,
  entity,
  entityPermission,
  loadData,
  onSearchUpdate,
  onPageUpdate,
  onItemsPerPageUpdate,
  onColumnFiltersUpdate,
  onSortByUpdate,
} = useSaplingTable(ref('salesOpportunity'))

const { kpis, cards: kpiCards } = useSaplingPlaygroundKpis()
const showcaseEntityHandle = computed(() => entity.value?.handle ?? 'company')
const hasEditContext = computed(() => entity.value != null && entityTemplates.value.length > 0)
const templateCount = computed(() => entityTemplates.value.length)

const {
  actionCards,
  dialogLaunchers,
  metrics,
  deleteDialogModel,
  deleteDialogItem,
  kpiDialogModel,
  selectedKpi,
  editDialogModel,
  editDialogMode,
  editDialogItem,
  simulateMessage,
  openEditDialog,
  openMailDialogShowcase,
  handleDeleteConfirm,
  handleDeleteCancel,
  closeKpiDialog,
  handleKpiAdd,
  handleEditSave,
  handleEditCancel,
} = useSaplingPlaygroundShowcase({
  entityHandle: showcaseEntityHandle,
  templateCount,
  hasEditContext,
  kpis,
  phone: phoneFieldValue,
  mail: mailFieldValue,
  link: linkFieldValue,
})
</script>
