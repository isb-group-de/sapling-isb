<template>
  <v-skeleton-loader
    v-if="showInitialSkeleton"
    class="mx-auto fill-height glass-panel"
    elevation="12"
    type="article, actions, table"
    width="100%"
  />
  <div
    v-else
    data-tutorial="table-root"
    class="sapling-table-root"
    :class="{
      'sapling-table-root--has-select': Boolean(multiSelect),
      'sapling-table-root--has-actions': Boolean(showActions),
    }"
  >
    <div
      v-if="showToolbar"
      class="sapling-toolbar-shell sapling-table-toolbar"
      :class="{ 'sapling-table-toolbar--mobile': isMobileTable }"
    >
      <div class="sapling-toolbar-controls sapling-table-toolbar-controls">
        <div
          v-if="multiSelect && showSelectionToolbar"
          data-tutorial="table-selection-actions"
          class="sapling-toolbar-slot sapling-table-toolbar-slot sapling-table-toolbar-slot--selection"
        >
          <SaplingTableMultiSelect
            :multiSelect="multiSelect"
            :selectedRows="selectedRows"
            :selected-items="selectedItems"
            :entity-templates="entityTemplates"
            :script-buttons="multiSelectScriptButtons"
            :showActions="showActions"
            :entity="entity"
            :entity-permission="entityPermission"
            @clearSelection="clearSelection"
            @deleteAllSelected="deleteAllSelected"
            @exportSelected="exportSelectedJSON"
            @runScriptButton="runSelectionScriptButton"
            @selectAll="selectAllRows"
            @mailToSelected="onMailToSelected"
            @bulkUpdateSelected="openBulkUpdateDialog"
          />
        </div>

        <div
          v-if="showSearchField"
          data-tutorial="table-search"
          class="sapling-toolbar-slot sapling-toolbar-slot--grow sapling-table-toolbar-slot sapling-table-toolbar-slot--search"
        >
          <SaplingSearch
            class="sapling-table-toolbar-search"
            :model-value="search ?? ''"
            :entity="entity"
            @update:model-value="onSearchUpdate"
          />
        </div>

        <div
          class="sapling-toolbar-slot sapling-toolbar-slot--trailing sapling-table-toolbar-slot sapling-table-toolbar-slot--actions"
        >
          <div
            data-tutorial="table-toolbar-actions"
            class="sapling-action-cluster sapling-table-toolbar-actions"
            :class="{ 'sapling-table-toolbar-actions--compact': !showToolbarActionsInline }"
          >
            <SaplingTableToolbarActions
              :is-mobile-table="isMobileTable"
              :is-downloading-json="isDownloadingJSON"
              :is-importing-csv="isImportingCSV"
              :refresh-button-label="refreshButtonLabel"
              :auto-refresh-interval-minutes="autoRefreshIntervalMinutes"
              :seconds-until-refresh="secondsUntilRefresh"
              :show-favorite="showFavoriteButton"
              :show-import="showImportButton"
              :show-add="showAddButton"
              :show-form-config-button="showFormConfigButton"
              :favorite-items="currentEntityFavorites"
              :is-favorites-loading="isCurrentEntityFavoritesLoading"
              :active-favorite-handle="activeFavoriteHandle"
              :form-config-menu-items="formConfigMenuItems ?? []"
              :selected-form-config-label="selectedFormConfigLabel"
              :is-loading-form-configs="isLoadingFormConfigs === true"
              :can-save-current-view="canSaveCurrentView"
              :has-temporary-column-order="hasManualColumnOrder"
              :is-column-order-editing="isColumnOrderEditing"
              :is-column-chooser-open="isColumnChooserOpen"
              @download-json="downloadJSON"
              @download-csv="exportCSV"
              @download-csv-template="exportCSVTemplate"
              @import-csv="openImportFilePicker"
              @refresh="refreshTable"
              @update:auto-refresh-interval-minutes="setAutoRefreshInterval"
              @favorite="openFavoriteDialog"
              @select-favorite="selectFavorite"
              @select-form-config="selectFormConfig"
              @set-default-form-config="emit('setDefaultFormConfig', $event)"
              @begin-column-order-edit="beginColumnOrderEdit"
              @finish-column-order-edit="finishColumnOrderEdit"
              @toggle-column-chooser="isColumnChooserOpen = !isColumnChooserOpen"
              @save-current-view="openTableViewDialog"
              @reset-temporary-column-order="resetColumnOrder"
              @open-form-config="openFormConfigForTable"
              @add="openCreateDialog"
            >
              <template v-if="showSidePanelToggleButton" #mobile-leading>
                <v-btn
                  data-tutorial="partner-filter-toggle"
                  class="sapling-table-toolbar-action sapling-table-toolbar-action--icon-only sapling-table-toolbar-action--utility"
                  color="primary"
                  :variant="sidePanelVisible ? 'flat' : 'tonal'"
                  icon
                  :title="sidePanelToggleLabel"
                  :aria-label="sidePanelToggleLabel"
                  @click="emit('toggleSidePanel')"
                >
                  <v-icon>{{ sidePanelToggleIcon }}</v-icon>
                </v-btn>
              </template>
              <template v-if="showSidePanelToggleButton || showFormConfigButton" #leading>
                <v-btn
                  v-if="showSidePanelToggleButton"
                  data-tutorial="partner-filter-toggle"
                  class="sapling-table-toolbar-action sapling-table-toolbar-action--icon-only sapling-table-toolbar-action--utility"
                  color="primary"
                  :variant="sidePanelVisible ? 'flat' : 'tonal'"
                  icon
                  :title="sidePanelToggleLabel"
                  :aria-label="sidePanelToggleLabel"
                  @click="emit('toggleSidePanel')"
                >
                  <v-icon>{{ sidePanelToggleIcon }}</v-icon>
                </v-btn>
                <v-btn
                  v-if="showFormConfigButton"
                  class="sapling-table-toolbar-action sapling-table-toolbar-action--icon-only sapling-table-toolbar-action--utility"
                  color="primary"
                  variant="tonal"
                  icon
                  :title="$t('formConfig.openForEntity')"
                  :aria-label="$t('formConfig.openForEntity')"
                  @click="openFormConfigForTable"
                >
                  <v-icon>mdi-table-cog</v-icon>
                </v-btn>
              </template>
            </SaplingTableToolbarActions>
          </div>
        </div>
      </div>
    </div>

    <input
      ref="importInputRef"
      class="sapling-upload-native-input"
      type="file"
      accept=".csv,.txt,.tsv,text/csv,text/plain"
      @change="onImportFileInputChange"
    />

    <div ref="tableContainerRef" class="sapling-table-body">
      <SaplingTableMobileView
        v-if="isMobileTable"
        :items="items"
        :total-items="totalItems"
        :items-per-page="itemsPerPage"
        :page="page"
        :is-loading="isLoading"
        :search="search ?? ''"
        :mobile-card-headers="mobileCardHeaders"
        :multi-select="multiSelect"
        :entity="entity"
        :entity-permission="actionEntityPermission"
        :entity-templates="entityTemplates"
        :entity-handle="entityHandle"
        :row-script-buttons="rowScriptButtons"
        :can-navigate="canNavigate"
        :can-show-information="canShowInformation"
        :show-actions="showActions"
        :row-interaction="rowInteraction"
        :selected-rows="selectedRows"
        :selected-row="selectedRow"
        :is-header-translation-loading="isHeaderTranslationLoading"
        :get-column-sort-icon="getColumnSortIcon"
        :is-column-filterable="isColumnFilterable"
        :get-column-filter-item="getColumnFilterItem"
        :get-filter-operator-options="getFilterOperatorOptions"
        @update:page="onPageUpdate"
        @toggle-column-sort="toggleColumnSort"
        @update:column-filter="({ key, value }) => onColumnFilterChange(key, value)"
        @select-row="selectRow"
        @change-log="openChangeLog"
        @delete="openDeleteDialog"
        @edit="openEditDialog"
        @show="openShowDialog"
        @copy="openCopyDialog"
        @script="runRowScriptButton"
        @navigate="navigateToAddress"
        @timeline="openTimeline"
        @upload-document="openUploadDialog"
        @show-documents="navigateToDocuments"
        @show-information="openInformationDialog"
        @show-external-record-links="openExternalRecordLinksDialog"
        @reload="refreshTable"
      />
      <SaplingTableDesktopView
        v-else
        :table-key="tableKey"
        :items="items"
        :total-items="totalItems"
        :items-per-page="itemsPerPage"
        :page="page"
        :is-loading="isLoading"
        :sort-by="sortBy"
        :visible-headers="visibleHeaders"
        :multi-select="multiSelect"
        :entity="entity"
        :entity-permission="actionEntityPermission"
        :entity-templates="entityTemplates"
        :entity-handle="entityHandle"
        :row-script-buttons="rowScriptButtons"
        :can-navigate="canNavigate"
        :can-show-information="canShowInformation"
        :show-actions="showActions"
        :row-interaction="rowInteraction"
        :selected-rows="selectedRows"
        :selected-row="selectedRow"
        :is-header-translation-loading="isHeaderTranslationLoading"
        :column-order-editing="isColumnOrderEditing"
        :get-column-filter-item="getColumnFilterItem"
        :get-filter-operator-options="getFilterOperatorOptions"
        :is-column-filterable="isColumnFilterable"
        @update:page="onPageUpdate"
        @update:items-per-page="onItemsPerPageUpdate"
        @update:sort-by="onSortByUpdate"
        @update:column-filter="({ key, value }) => onColumnFilterChange(key, value)"
        @move-column="moveColumn"
        @remove-column="removeColumn"
        @select-all-rows="selectAllRows"
        @clear-selection="clearSelection"
        @select-row="selectRow"
        @change-log="openChangeLog"
        @delete="openDeleteDialog"
        @edit="openEditDialog"
        @show="openShowDialog"
        @copy="openCopyDialog"
        @script="runRowScriptButton"
        @navigate="navigateToAddress"
        @timeline="openTimeline"
        @upload-document="openUploadDialog"
        @show-documents="navigateToDocuments"
        @show-information="openInformationDialog"
        @show-external-record-links="openExternalRecordLinksDialog"
        @open-context-menu="openContextMenu"
        @reload="refreshTable"
      />
    </div>

    <SaplingTableTutorial
      v-if="enableTutorial && isInitialized"
      :create-dialog-open="editDialog.visible && editDialog.mode === 'create'"
      @open-create="openCreateDialog"
      @close-create="closeDialog"
    />

    <SaplingTableColumnChooser
      v-model="isColumnChooserOpen"
      :available-columns="availableColumnHeaders"
      @add-column="addColumn"
      @remove-column="removeColumn"
    />

    <SaplingTableOverlays
      :entity="entity"
      :entity-handle="entityHandle"
      :entity-permission="actionEntityPermission"
      :entity-templates="entityTemplates"
      :parent="parent"
      :parent-entity="parentEntity"
      :row-script-buttons="rowScriptButtons"
      :can-navigate="canNavigate"
      :can-show-information="canShowInformation"
      :edit-dialog="editDialog"
      :delete-dialog="deleteDialog"
      :bulk-delete-dialog="bulkDeleteDialog"
      :bulk-update-dialog="bulkUpdateDialog"
      :update-conflict-dialog="updateConflictDialog"
      :context-menu="{ ...contextMenu, visible: showActions && contextMenu.visible }"
      :context-menu-mail-actions="contextMenuMailActions"
      :show-upload-dialog="showUploadDialog"
      :upload-dialog-item="uploadDialogItem"
      :show-information-dialog="showInformationDialog"
      :information-dialog-item="informationDialogItem"
      :show-external-record-links-dialog="showExternalRecordLinksDialog"
      :external-record-links-dialog-item="externalRecordLinksDialogItem"
      @update:delete-visible="(value) => (deleteDialog.visible = value)"
      @confirm-delete="confirmDelete"
      @close-delete="closeDeleteDialog"
      @update:bulk-delete-visible="(value) => (bulkDeleteDialog.visible = value)"
      @confirm-bulk-delete="confirmBulkDelete"
      @close-bulk-delete="closeBulkDeleteDialog"
      @update:bulk-update-visible="(value) => (bulkUpdateDialog.visible = value)"
      @apply-bulk-update="applyBulkUpdate"
      @close-bulk-update="closeBulkUpdateDialog"
      @update:edit-visible="(value) => (editDialog.visible = value)"
      @save-dialog="saveDialog"
      @close-dialog="closeDialog"
      @update:edit-mode="editDialog.mode = $event"
      @update:edit-item="editDialog.item = $event"
      @record-deleted="refreshTable"
      @close-update-conflict="closeUpdateConflictDialog"
      @merge-update-conflict="mergeUpdateConflict"
      @reload-update-conflict="reloadUpdateConflictRecord"
      @open-update-conflict-change-log="openUpdateConflictChangeLog"
      @context-action="onContextMenuAction"
      @update:context-visible="(value) => (contextMenu.visible = value)"
      @close-upload="closeUploadDialog"
      @close-information="closeInformationDialog"
      @close-external-record-links="closeExternalRecordLinksDialog"
    />

    <SaplingTableFavoriteDialog
      :model-value="favoriteDialog.visible"
      :title="favoriteDialog.title"
      @update:model-value="(value) => (favoriteDialog.visible = value)"
      @update:title="favoriteDialog.title = $event"
      @save="saveFavorite"
      @cancel="closeFavoriteDialog"
    />

    <SaplingTableViewDialog
      :model-value="tableViewDialog.visible"
      :name="tableViewDialog.name"
      :loading="tableViewDialog.loading || isSavingTableView"
      @update:model-value="(value) => (tableViewDialog.visible = value)"
      @update:name="tableViewDialog.name = $event"
      @save="saveCurrentView"
      @cancel="closeTableViewDialog"
    />
  </div>
</template>

<script lang="ts" setup>
// #region Imports
import { computed, onMounted, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import SaplingSearch from '@/components/system/SaplingSearch.vue'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import { useSaplingMailDialog } from '@/composables/dialog/useSaplingMailDialog'
import type { SaplingBulkMailAction } from '@/utils/saplingMailMenuUtil'
import SaplingTableDesktopView from './SaplingTableDesktopView.vue'
import SaplingTableColumnChooser from './SaplingTableColumnChooser.vue'
import SaplingTableFavoriteDialog from './SaplingTableFavoriteDialog.vue'
import SaplingTableMobileView from './SaplingTableMobileView.vue'
import SaplingTableMultiSelect from './SaplingTableMultiSelect.vue'
import SaplingTableOverlays from './SaplingTableOverlays.vue'
import SaplingTableToolbarActions from './SaplingTableToolbarActions.vue'
import SaplingTableViewDialog from './SaplingTableViewDialog.vue'
import SaplingTableTutorial from '@/components/system/tutorial/SaplingTableTutorial.vue'
import {
  useSaplingTableComponent,
  type UseSaplingTableEmit,
  type UseSaplingTableProps,
} from '@/composables/table/useSaplingTableComponent'
import { useSaplingTableRouteDialogSync } from '@/composables/table/useSaplingTableRouteDialogSync'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import type {
  FormConfigMenuItem,
  FormConfigSelectionHandle,
} from '@/composables/dialog/saplingDialogEdit.utils'
import { saplingTableDisplayContextKey } from './saplingTableDisplayContext'
import type { SaplingTableViewSaveRequest } from '@/composables/table/saplingTableColumnOrder'
// #endregion

// #region Props and Emits
type SaplingTableProps = UseSaplingTableProps & {
  enableTutorial?: boolean
  showFavorite?: boolean
  showAdd?: boolean
  showImport?: boolean
  showSearch?: boolean
  showFormConfig?: boolean
  showToolbar?: boolean
  showSelectionToolbar?: boolean
  isInitialized?: boolean
  rowInteraction?: boolean
  showSidePanelToggle?: boolean
  sidePanelVisible?: boolean
  sidePanelToggleLabel?: string
  sidePanelToggleIcon?: string
  formConfigMenuItems?: FormConfigMenuItem[]
  selectedFormConfigLabel?: string
  isLoadingFormConfigs?: boolean
  isSavingTableView?: boolean
  syncEditDialogWithRoute?: boolean
}

type SaplingTableEmit = UseSaplingTableEmit & {
  (event: 'toggleSidePanel'): void
  (event: 'selectFormConfig', value: FormConfigSelectionHandle): void
  (event: 'setDefaultFormConfig', value: number): void
  (event: 'saveCurrentView', value: SaplingTableViewSaveRequest): void
}

const props = withDefaults(defineProps<SaplingTableProps>(), {
  allowDeleteActions: true,
  enableTutorial: false,
  showSearch: true,
  showToolbar: true,
  showSelectionToolbar: true,
  rowInteraction: true,
  syncEditDialogWithRoute: false,
})
const emit = defineEmits<SaplingTableEmit>()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { isLoading: isHeaderTranslationLoading } = useTranslationLoader(props.entityHandle)
const currentPersonStore = useCurrentPersonStore()

const hasCompletedInitialLoad = ref(!props.isLoading)
const importInputRef = ref<HTMLInputElement | null>(null)
const tableViewDialog = ref({ visible: false, name: '', loading: false })
const isColumnOrderEditing = ref(false)
const isColumnChooserOpen = ref(false)

watch(
  () => props.isLoading,
  (isLoading) => {
    if (!isLoading) {
      hasCompletedInitialLoad.value = true
    }
  },
  { immediate: true },
)

watch(
  () => props.tableKey,
  () => {
    hasCompletedInitialLoad.value = !props.isLoading
    isColumnOrderEditing.value = false
    isColumnChooserOpen.value = false
  },
)

const hasTableStructure = computed(
  () =>
    (props.headers?.length ?? 0) > 0 ||
    (props.entityTemplates.length > 0 && props.entityPermission !== null),
)
const showInitialSkeleton = computed(
  () =>
    (props.isInitialized === false && !hasTableStructure.value) ||
    (!hasCompletedInitialLoad.value && !hasTableStructure.value),
)
const actionEntityPermission = computed(() => {
  if (props.allowDeleteActions !== false || !props.entityPermission) {
    return props.entityPermission
  }

  return {
    ...props.entityPermission,
    allowDelete: false,
  }
})
const refreshButtonLabel = computed(() => t('global.refresh'))
const showFavoriteButton = computed(() => props.showFavorite !== false)
const showAddButton = computed(
  () =>
    props.showAdd !== false &&
    Boolean(props.entity?.canInsert) &&
    Boolean(props.entityPermission?.allowInsert),
)
const showImportButton = computed(
  () =>
    props.showImport !== false &&
    currentPersonStore.isAdministrator &&
    (Boolean(props.entityPermission?.allowInsert) || Boolean(props.entityPermission?.allowUpdate)),
)
const showFormConfigButton = computed(
  () =>
    props.showFormConfig !== false &&
    currentPersonStore.isAdministrator &&
    Boolean(props.entityHandle),
)
const showSearchField = computed(() => props.showSearch !== false)
const showToolbar = computed(() => props.showToolbar !== false)
const showSelectionToolbar = computed(() => props.showSelectionToolbar !== false)
const showSidePanelToggleButton = computed(() => props.showSidePanelToggle === true)
const canSaveCurrentView = computed(
  () =>
    props.formConfigMenuItems !== undefined &&
    Boolean(props.entityHandle) &&
    orderedColumnKeys.value.length > 0,
)
const sidePanelVisible = computed(() => props.sidePanelVisible === true)
const sidePanelToggleLabel = computed(
  () => props.sidePanelToggleLabel?.trim() || t('global.filter'),
)
const sidePanelToggleIcon = computed(
  () => props.sidePanelToggleIcon?.trim() || 'mdi-account-group-outline',
)

onMounted(() => {
  void currentPersonStore.fetchCurrentPerson()
})
// #endregion

// #region Composable
const {
  tableContainerRef,
  selectedRows,
  selectedRow,
  visibleHeaders,
  orderedColumnKeys,
  selectableColumnKeys,
  availableColumnHeaders,
  hasManualColumnOrder,
  mobileCardHeaders,
  canNavigate,
  canShowInformation,
  editDialog,
  deleteDialog,
  bulkDeleteDialog,
  bulkUpdateDialog,
  updateConflictDialog,
  showUploadDialog,
  uploadDialogItem,
  showInformationDialog,
  informationDialogItem,
  showExternalRecordLinksDialog,
  externalRecordLinksDialogItem,
  contextMenu,
  contextMenuMailActions,
  selectedItems,
  favoriteDialog,
  currentEntityFavorites,
  isCurrentEntityFavoritesLoading,
  activeFavoriteHandle,
  isDownloadingJSON,
  isImportingCSV,
  multiSelectScriptButtons,
  rowScriptButtons,
  onSearchUpdate,
  onPageUpdate,
  onItemsPerPageUpdate,
  onSortByUpdate,
  toggleColumnSort,
  getColumnSortIcon,
  onColumnFilterChange,
  getColumnFilterItem,
  getFilterOperatorOptions,
  isColumnFilterable,
  moveColumn,
  addColumn,
  removeColumn,
  resetColumnOrder,
  showToolbarActionsInline,
  isMobileTable,
  autoRefreshIntervalMinutes,
  secondsUntilRefresh,
  downloadJSON,
  exportCSV,
  exportCSVTemplate,
  importCSVFile,
  refreshTable,
  setAutoRefreshInterval,
  exportSelectedJSON,
  openContextMenu,
  onContextMenuAction,
  selectAllRows,
  selectRow,
  clearSelection,
  deleteAllSelected,
  confirmBulkDelete,
  closeBulkDeleteDialog,
  openBulkUpdateDialog,
  closeBulkUpdateDialog,
  applyBulkUpdate,
  runSelectionScriptButton,
  runRowScriptButton,
  navigateToAddress,
  openTimeline,
  openChangeLog,
  openUploadDialog,
  closeUploadDialog,
  navigateToDocuments,
  openInformationDialog,
  closeInformationDialog,
  openExternalRecordLinksDialog,
  closeExternalRecordLinksDialog,
  openFavoriteDialog,
  closeFavoriteDialog,
  saveFavorite,
  selectFavorite,
  openCreateDialog,
  openEditDialog,
  openShowDialog,
  openCopyDialog,
  closeDialog,
  saveDialog,
  closeUpdateConflictDialog,
  openUpdateConflictChangeLog,
  reloadUpdateConflictRecord,
  mergeUpdateConflict,
  confirmDelete,
  openDeleteDialog,
  closeDeleteDialog,
} = useSaplingTableComponent(props, emit)

useSaplingTableRouteDialogSync({
  enabled: () => props.syncEditDialogWithRoute,
  editDialog,
  router,
  getRoute: () => route,
})

provide(saplingTableDisplayContextKey, {
  isMobileTable,
})

const { openMailDialog } = useSaplingMailDialog()

function onMailToSelected(action: SaplingBulkMailAction): void {
  if (action.emails.length === 0) {
    return
  }

  openMailDialog({
    entityHandle: props.entityHandle,
    initialTo: action.emails,
  })
}

function openImportFilePicker(): void {
  importInputRef.value?.click()
}

function openTableViewDialog(): void {
  tableViewDialog.value = {
    visible: true,
    name: props.selectedFormConfigLabel?.trim() ?? '',
    loading: false,
  }
}

function beginColumnOrderEdit(): void {
  isColumnOrderEditing.value = true
}

function finishColumnOrderEdit(): void {
  isColumnOrderEditing.value = false
  isColumnChooserOpen.value = false
}

function selectFormConfig(handle: FormConfigSelectionHandle): void {
  isColumnOrderEditing.value = false
  isColumnChooserOpen.value = false
  resetColumnOrder()
  emit('selectFormConfig', handle)
}

function closeTableViewDialog(): void {
  if (tableViewDialog.value.loading || props.isSavingTableView) return
  tableViewDialog.value = { visible: false, name: '', loading: false }
}

function saveCurrentView(): void {
  const name = tableViewDialog.value.name.trim()
  if (!name || tableViewDialog.value.loading || props.isSavingTableView) return

  tableViewDialog.value.loading = true
  emit('saveCurrentView', {
    name,
    orderedColumnKeys: [...orderedColumnKeys.value],
    selectableColumnKeys: [...selectableColumnKeys.value],
    complete(saved) {
      tableViewDialog.value.loading = false
      if (saved) {
        isColumnOrderEditing.value = false
        isColumnChooserOpen.value = false
        tableViewDialog.value = { visible: false, name: '', loading: false }
      }
    },
  })
}

async function openFormConfigForTable(): Promise<void> {
  if (!props.entityHandle) {
    return
  }

  await router.push({ name: 'formConfig', query: { entity: props.entityHandle } })
}

function onImportFileInputChange(event: Event): void {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0] ?? null
  void importCSVFile(file)

  if (target) {
    target.value = ''
  }
}
// #endregion

defineExpose({ openCreateDialog })
</script>
