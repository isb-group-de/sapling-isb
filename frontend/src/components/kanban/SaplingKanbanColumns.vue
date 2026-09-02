<template>
  <section class="sapling-kanban-board" aria-live="polite">
    <article
      v-for="column in columns"
      :key="String(column.handle)"
      class="sapling-section-panel sapling-kanban-column glass-panel"
      :class="{ 'sapling-kanban-column--drop': dropColumnHandle === String(column.handle) }"
      @dragover.prevent="emit('dragOver', $event, column)"
      @drop.prevent="emit('drop', column)"
    >
      <header class="sapling-kanban-column__header">
        <div class="sapling-kanban-column__title-row">
          <span v-css-vars="getColumnStyle(column)" class="sapling-kanban-column__icon">
            <v-icon :icon="getColumnIcon(column)" size="18" />
          </span>
          <div class="sapling-kanban-column__copy">
            <h2>{{ getColumnLabel(column) }}</h2>
            <p>{{ getColumnDescription(column) }}</p>
          </div>
        </div>
        <div class="sapling-kanban-column__metrics">
          <v-chip size="x-small" variant="tonal">
            {{ getColumnRecords(column).length }}
          </v-chip>
          <v-chip size="x-small" variant="tonal" color="primary">
            {{ columnFieldLabel }}
          </v-chip>
        </div>
      </header>

      <div class="sapling-kanban-column__cards">
        <div
          v-if="shouldShowDropPreview(column)"
          class="sapling-kanban-drop-preview"
          v-css-vars="getColumnStyle(column)"
        >
          <span class="sapling-kanban-drop-preview__title">
            {{ getRecordTitle(draggedRecord) }}
          </span>
          <span v-if="draggedRecord" class="sapling-kanban-drop-preview__meta">
            {{ getCardSubtitle(draggedRecord) }}
          </span>
        </div>

        <button
          v-for="record in getColumnRecords(column)"
          :key="String(record.handle ?? getRecordTitle(record))"
          type="button"
          class="sapling-kanban-card"
          :class="{
            'sapling-kanban-card--locked': !canUpdateRecord,
            'sapling-kanban-card--dragging': draggedRecordHandle === String(record.handle),
          }"
          :draggable="canUpdateRecord"
          v-css-vars="getColumnStyle(column)"
          :aria-label="getRecordTitle(record)"
          @click="emit('open', record)"
          @dragstart="emit('dragStart', $event, record)"
          @dragend="emit('dragEnd')"
        >
          <span class="sapling-kanban-card__header">
            <span class="sapling-kanban-card__title">{{ getRecordTitle(record) }}</span>
            <v-icon icon="mdi-drag-horizontal-variant" size="18" />
          </span>
          <span v-if="getCardSubtitle(record)" class="sapling-kanban-card__company">
            {{ getCardSubtitle(record) }}
          </span>
          <span v-if="getCardMeta(record).length" class="sapling-kanban-card__meta">
            <span v-for="meta in getCardMeta(record)" :key="meta">{{ meta }}</span>
          </span>
          <span v-if="getCardFooter(record).length" class="sapling-kanban-card__footer">
            <span v-for="footer in getCardFooter(record)" :key="footer">{{ footer }}</span>
          </span>
        </button>

        <div
          v-if="getColumnRecords(column).length === 0 && !shouldShowDropPreview(column)"
          class="sapling-empty-state-panel sapling-empty-state-panel--compact sapling-kanban-empty-state"
        >
          {{ t('kanbanBoard.emptyColumn') }}
        </div>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { SaplingGenericItem } from '@/entity/entity'

defineProps<{
  columns: SaplingGenericItem[]
  columnFieldLabel: string
  canUpdateRecord: boolean
  draggedRecord: SaplingGenericItem | null | undefined
  draggedRecordHandle: string | null
  dropColumnHandle: string | null
  getColumnRecords: (column: SaplingGenericItem) => SaplingGenericItem[]
  getColumnStyle: (column: SaplingGenericItem) => Record<string, string>
  getColumnIcon: (column: SaplingGenericItem) => string
  getColumnLabel: (column: SaplingGenericItem) => string
  getColumnDescription: (column: SaplingGenericItem) => string
  getRecordTitle: (record: SaplingGenericItem | null | undefined) => string
  getCardSubtitle: (record: SaplingGenericItem) => string
  getCardMeta: (record: SaplingGenericItem) => string[]
  getCardFooter: (record: SaplingGenericItem) => string[]
  shouldShowDropPreview: (column: SaplingGenericItem) => boolean
}>()

const emit = defineEmits<{
  open: [record: SaplingGenericItem]
  dragStart: [event: DragEvent, record: SaplingGenericItem]
  dragOver: [event: DragEvent, column: SaplingGenericItem]
  dragEnd: []
  drop: [column: SaplingGenericItem]
}>()
const { t } = useI18n()
</script>
