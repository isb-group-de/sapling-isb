<template>
  <v-container
    class="sapling-page-shell sapling-page-shell--panel sapling-page-shell--fill sapling-page-shell--uniform-inset sapling-dashboard-page sapling-dashboard-page--flow-xl sapling-admin-dashboard sapling-kanban-dashboard"
    fluid
  >
    <SaplingPageHero
      class="sapling-admin-hero sapling-kanban-hero"
      variant="workspace"
      :eyebrow="navigationLabel"
      :title="boardTitle"
    >
      <template #title-prefix
        ><v-icon size="30">{{ entityIcon }}</v-icon></template
      >
      <p class="sapling-kanban-hero__subtitle">{{ boardSubtitle }}</p>
      <template #side>
        <div class="sapling-stack-md sapling-admin-hero__side sapling-kanban-hero-side">
          <div class="sapling-stat-grid sapling-admin-stat-grid sapling-kanban-stat-grid">
            <article class="sapling-detail-card sapling-admin-stat-card sapling-kanban-stat-card">
              <span>{{ t('kanbanBoard.columns') }}</span>
              <strong>{{ visibleColumns.length }}</strong>
            </article>
            <article class="sapling-detail-card sapling-admin-stat-card sapling-kanban-stat-card">
              <span>{{ t('kanbanBoard.records') }}</span>
              <strong>{{ filteredRecords.length }}</strong>
            </article>
            <article class="sapling-detail-card sapling-admin-stat-card sapling-kanban-stat-card">
              <span>{{ t('kanbanBoard.openRecords') }}</span>
              <strong>{{ openRecordCount }}</strong>
            </article>
            <article class="sapling-detail-card sapling-admin-stat-card sapling-kanban-stat-card">
              <span>{{ t('kanbanBoard.updatedRecords') }}</span>
              <strong>{{ updatedRecordCount }}</strong>
            </article>
          </div>
          <div
            class="sapling-action-cluster sapling-admin-hero__actions sapling-kanban-hero-actions"
          >
            <v-btn
              prepend-icon="mdi-refresh"
              variant="text"
              :disabled="isLoading"
              @click="loadData"
            >
              {{ t('global.refresh') }}
            </v-btn>
            <v-btn
              v-if="canInsertRecord"
              color="primary"
              variant="flat"
              prepend-icon="mdi-plus"
              @click="openCreateDialog"
            >
              {{ t('global.createRecord') }}
            </v-btn>
          </div>
        </div>
      </template>
    </SaplingPageHero>

    <section
      class="sapling-page-workspace sapling-page-workspace--main-context sapling-page-workspace--collapse-xl sapling-kanban-layout"
    >
      <main class="sapling-page-column sapling-kanban-main">
        <section
          class="sapling-workspace-panel sapling-page-panel sapling-page-panel-stack sapling-admin-workspace sapling-admin-panel-stack sapling-kanban-workspace glass-panel"
        >
          <div class="sapling-stack-md sapling-admin-toolbar sapling-kanban-toolbar">
            <div
              class="sapling-split-toolbar sapling-admin-toolbar-actions sapling-kanban-toolbar-actions"
            >
              <v-text-field
                v-model="search"
                density="comfortable"
                rounded="lg"
                hide-details
                clearable
                prepend-inner-icon="mdi-magnify"
                :label="t('global.search')"
              />
              <v-btn-toggle
                v-model="scope"
                class="sapling-kanban-scope-toggle"
                color="primary"
                density="comfortable"
                mandatory
              >
                <v-btn value="open" variant="outlined" prepend-icon="mdi-progress-clock">
                  {{ t('kanbanBoard.open') }}
                </v-btn>
                <v-btn value="all" variant="outlined" prepend-icon="mdi-format-list-group">
                  {{ t('kanbanBoard.all') }}
                </v-btn>
              </v-btn-toggle>
            </div>
          </div>

          <v-progress-linear
            v-if="isLoading && hasLoadedOnce"
            color="primary"
            indeterminate
            class="sapling-admin-progress sapling-kanban-progress"
          />
          <div v-if="isBootstrapping" class="sapling-kanban-loading-grid">
            <v-skeleton-loader
              v-for="index in 4"
              :key="index"
              class="sapling-kanban-loading-column"
              type="heading, list-item-three-line, list-item-three-line, list-item-three-line"
            />
          </div>
          <div
            v-else-if="!kanbanConfig || !columnTemplate"
            class="sapling-empty-state-panel sapling-empty-state-panel--compact"
          >
            {{ t('kanbanBoard.notConfigured') }}
          </div>
          <div v-else class="sapling-kanban-board-shell">
            <SaplingKanbanColumns
              :columns="visibleColumns"
              :column-field-label="columnFieldLabel"
              :can-update-record="canUpdateRecord"
              :dragged-record="draggedRecord"
              :dragged-record-handle="draggedRecordHandle"
              :drop-column-handle="dropColumnHandle"
              :get-column-records="getColumnRecords"
              :get-column-style="getColumnStyle"
              :get-column-icon="getColumnIcon"
              :get-column-label="getColumnLabel"
              :get-column-description="getColumnDescription"
              :get-record-title="getRecordTitle"
              :get-card-subtitle="getCardSubtitle"
              :get-card-meta="getCardMeta"
              :get-card-footer="getCardFooter"
              :should-show-drop-preview="shouldShowDropPreview"
              @open="openEditDialog"
              @drag-start="onDragStart"
              @drag-over="onDragOver"
              @drag-end="onDragEnd"
              @drop="onDrop"
            />
          </div>
        </section>
      </main>

      <aside class="sapling-page-column sapling-kanban-context">
        <SaplingWorkFilterPanel
          class="sapling-kanban-filter"
          @update:selected-peoples="onSelectedPeopleUpdate"
          @update:selected-companies="onSelectedCompaniesUpdate"
        />
      </aside>
    </section>

    <SaplingDialogEdit
      v-model="editDialog.visible"
      :mode="editDialog.mode"
      :item="editDialog.item"
      :templates="entityState.entityTemplates"
      :entity="entityState.entity"
      @save="saveDialog"
      @cancel="closeDialog"
      @update:item="updateDialogItem"
      @update:mode="editDialog.mode = $event"
      @deleted="handleDialogDelete"
    />
  </v-container>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import SaplingDialogEdit from '@/components/dialog/SaplingDialogEdit.vue'
import SaplingPageHero from '@/components/common/SaplingPageHero.vue'
import SaplingWorkFilterPanel from '@/components/filter/SaplingWorkFilterPanel.vue'
import SaplingKanbanColumns from './SaplingKanbanColumns.vue'
import type { KanbanBoardProps } from './kanbanBoard.types'
import { useSaplingKanbanBoard } from '@/composables/kanban/useSaplingKanbanBoard'

const props = defineProps<KanbanBoardProps>()
const { t } = useI18n()
const {
  boardSubtitle,
  boardTitle,
  canInsertRecord,
  canUpdateRecord,
  closeDialog,
  columnFieldLabel,
  columnTemplate,
  drag,
  editDialog,
  entityIcon,
  entityState,
  filteredRecords,
  getCardFooter,
  getCardMeta,
  getCardSubtitle,
  getColumnDescription,
  getColumnIcon,
  getColumnLabel,
  getColumnRecords,
  getColumnStyle,
  getRecordTitle,
  handleDialogDelete,
  hasLoadedOnce,
  isBootstrapping,
  isLoading,
  kanbanConfig,
  loadData,
  navigationLabel,
  onSelectedCompaniesUpdate,
  onSelectedPeopleUpdate,
  openCreateDialog,
  openEditDialog,
  openRecordCount,
  saveDialog,
  scope,
  search,
  updateDialogItem,
  updatedRecordCount,
  visibleColumns,
} = useSaplingKanbanBoard(props)
const {
  draggedRecord,
  draggedRecordHandle,
  dropColumnHandle,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  shouldShowDropPreview,
} = drag
</script>
