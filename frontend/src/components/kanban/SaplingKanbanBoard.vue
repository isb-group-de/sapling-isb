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
      <template #title-prefix>
        <v-icon size="30">{{ entityIcon }}</v-icon>
      </template>

      <p class="sapling-kanban-hero__subtitle">
        {{ boardSubtitle }}
      </p>

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
            <section class="sapling-kanban-board" aria-live="polite">
              <article
                v-for="column in visibleColumns"
                :key="String(column.handle)"
                class="sapling-section-panel sapling-kanban-column glass-panel"
                :class="{
                  'sapling-kanban-column--drop': dropColumnHandle === String(column.handle),
                }"
                @dragover.prevent="onDragOver($event, column)"
                @drop.prevent="onDrop(column)"
              >
                <header class="sapling-kanban-column__header">
                  <div class="sapling-kanban-column__title-row">
                    <span class="sapling-kanban-column__icon" :style="getColumnStyle(column)">
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
                      {{ getColumnFieldLabel }}
                    </v-chip>
                  </div>
                </header>

                <div class="sapling-kanban-column__cards">
                  <div
                    v-if="shouldShowDropPreview(column)"
                    class="sapling-kanban-drop-preview"
                    :style="getColumnStyle(column)"
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
                      'sapling-kanban-card--dragging':
                        draggedRecordHandle === String(record.handle),
                    }"
                    :draggable="canUpdateRecord"
                    :style="getColumnStyle(column)"
                    :aria-label="getRecordTitle(record)"
                    @click="openEditDialog(record)"
                    @dragstart="onDragStart($event, record)"
                    @dragend="onDragEnd"
                  >
                    <span class="sapling-kanban-card__header">
                      <span class="sapling-kanban-card__title">
                        {{ getRecordTitle(record) }}
                      </span>
                      <v-icon icon="mdi-drag-horizontal-variant" size="18" />
                    </span>
                    <span v-if="getCardSubtitle(record)" class="sapling-kanban-card__company">
                      {{ getCardSubtitle(record) }}
                    </span>
                    <span v-if="getCardMeta(record).length > 0" class="sapling-kanban-card__meta">
                      <span v-for="meta in getCardMeta(record)" :key="meta">{{ meta }}</span>
                    </span>
                    <span
                      v-if="getCardFooter(record).length > 0"
                      class="sapling-kanban-card__footer"
                    >
                      <span v-for="footer in getCardFooter(record)" :key="footer">{{
                        footer
                      }}</span>
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
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  DialogSaveAction,
  DialogSaveContext,
  DialogState,
  EntityTemplate,
  EntityTemplateKanban,
} from '@/entity/structure'
import type { SaplingGenericItem } from '@/entity/entity'
import ApiGenericService from '@/services/api.generic.service'
import { DEFAULT_ENTITY_ITEMS_COUNT } from '@/constants/project.constants'
import { useGenericStore } from '@/stores/genericStore'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import { getEntityValueLabel } from '@/utils/saplingTableUtil'
import SaplingDialogEdit from '@/components/dialog/SaplingDialogEdit.vue'
import SaplingPageHero from '@/components/common/SaplingPageHero.vue'
import SaplingWorkFilterPanel from '@/components/filter/SaplingWorkFilterPanel.vue'

type BoardScope = 'open' | 'all'

interface EditDialogState {
  visible: boolean
  mode: DialogState
  item: SaplingGenericItem | null
}

const props = defineProps<{
  entityHandle: string
  navigationKey?: string
}>()

const { t, d, n, locale } = useI18n()
const { pushMessage } = useSaplingMessageCenter()
const genericStore = useGenericStore()

const search = ref('')
const scope = ref<BoardScope>('open')
const columns = ref<SaplingGenericItem[]>([])
const records = ref<SaplingGenericItem[]>([])
const isLoading = ref(false)
const hasLoadedOnce = ref(false)
const selectedPeople = ref<number[]>([])
const selectedCompanies = ref<number[]>([])
const draggedRecordHandle = ref<string | null>(null)
const dropColumnHandle = ref<string | null>(null)
const dragImageElement = ref<HTMLElement | null>(null)
const editDialog = ref<EditDialogState>({ visible: false, mode: 'create', item: null })

const entityState = computed(() => genericStore.getState(props.entityHandle))
const kanbanTemplate = computed(() =>
  entityState.value.entityTemplates.find((template) => template.kanban),
)
const kanbanConfig = computed<EntityTemplateKanban | null>(
  () => kanbanTemplate.value?.kanban ?? null,
)
const columnTemplate = computed(() =>
  kanbanConfig.value
    ? (entityState.value.entityTemplates.find(
        (template) => template.name === kanbanConfig.value?.columnField,
      ) ?? null)
    : null,
)
const columnEntityHandle = computed(() => columnTemplate.value?.referenceName || '')
const columnState = computed(() => genericStore.getState(columnEntityHandle.value))
const canInsertRecord = computed(() => entityState.value.entityPermission?.allowInsert === true)
const canUpdateRecord = computed(() => entityState.value.entityPermission?.allowUpdate === true)
const isBootstrapping = computed(() => isLoading.value && !hasLoadedOnce.value)
const entityIcon = computed(() => entityState.value.entity?.icon || 'mdi-view-column-outline')
const navigationLabel = computed(() =>
  translateWithFallback(
    `navigation.${props.navigationKey || props.entityHandle}`,
    boardTitle.value,
  ),
)
const boardTitle = computed(() =>
  translateWithFallback(
    `kanbanBoard.${props.entityHandle}.title`,
    translateWithFallback(`navigation.${props.entityHandle}`, props.entityHandle),
  ),
)
const boardSubtitle = computed(() =>
  translateWithFallback(
    `kanbanBoard.${props.entityHandle}.subtitle`,
    t('kanbanBoard.subtitle', { entity: boardTitle.value }),
  ),
)
const getColumnFieldLabel = computed(() =>
  columnTemplate.value
    ? translateWithFallback(
        `${props.entityHandle}.${columnTemplate.value.name}`,
        columnTemplate.value.name,
      )
    : '',
)
const visibleColumns = computed(() => {
  const orderedColumns = [...columns.value].sort(compareColumns)
  const config = kanbanConfig.value

  if (scope.value === 'all' || !config?.scopeOpenField) {
    return orderedColumns
  }

  return orderedColumns.filter((column) =>
    isExpectedValue(
      column[config.scopeOpenField as keyof SaplingGenericItem],
      config.scopeOpenValue,
    ),
  )
})
const filteredRecords = computed(() => {
  const config = kanbanConfig.value
  if (!config) {
    return []
  }

  const normalizedSearch = search.value.trim().toLocaleLowerCase()
  const allowedColumnHandles = new Set(visibleColumns.value.map((column) => String(column.handle)))

  return records.value.filter((record) => {
    const columnHandle = getRecordColumnHandle(record)
    if (!columnHandle || !allowedColumnHandles.has(columnHandle)) {
      return false
    }

    if (
      scope.value === 'open' &&
      config.recordScopeOpenField &&
      !isExpectedValue(
        record[config.recordScopeOpenField as keyof SaplingGenericItem],
        config.recordScopeOpenValue,
      )
    ) {
      return false
    }

    if (!matchesWorkFilter(record)) {
      return false
    }

    if (!normalizedSearch) {
      return true
    }

    return getSearchText(record).toLocaleLowerCase().includes(normalizedSearch)
  })
})
const openRecordCount = computed(() => {
  if (!kanbanConfig.value?.scopeOpenField) {
    return filteredRecords.value.length
  }

  return records.value.filter((record) => {
    const column = findColumnByRecord(record)
    return column
      ? isExpectedValue(
          column[kanbanConfig.value?.scopeOpenField as keyof SaplingGenericItem],
          kanbanConfig.value?.scopeOpenValue,
        )
      : false
  }).length
})
const updatedRecordCount = computed(
  () => records.value.filter((record) => Boolean(record.updatedAt)).length,
)
const draggedRecord = computed(() =>
  records.value.find((record) => String(record.handle) === draggedRecordHandle.value),
)
const relationTemplates = computed(() =>
  entityState.value.entityTemplates.filter(
    (template) => template.isReference && template.kind === 'm:1',
  ),
)
const personTemplates = computed(() =>
  relationTemplates.value.filter((template) => template.options?.includes('isPerson')),
)
const companyTemplates = computed(() =>
  relationTemplates.value.filter((template) => template.options?.includes('isCompany')),
)

onMounted(loadBoard)

watch(
  () => props.entityHandle,
  async () => {
    resetBoard()
    await loadBoard()
  },
)

async function loadBoard(): Promise<void> {
  await genericStore.loadGeneric(props.entityHandle, 'global', 'navigation', 'kanbanBoard')
  await loadReferenceMetadata()
  await loadData()
}

async function loadReferenceMetadata(): Promise<void> {
  const referenceHandles = new Set<string>()

  if (columnEntityHandle.value) {
    referenceHandles.add(columnEntityHandle.value)
  }

  relationTemplates.value.forEach((template) => {
    if (template.referenceName) {
      referenceHandles.add(template.referenceName)
    }
  })

  await genericStore.loadGenericMany(
    [...referenceHandles].map((entityHandle) => ({
      entityHandle,
      namespaces: ['global', 'navigation', 'kanbanBoard'],
    })),
  )
}

async function loadData(): Promise<void> {
  if (!kanbanConfig.value || !columnTemplate.value || !columnEntityHandle.value) {
    return
  }

  isLoading.value = true

  try {
    const [columnResponse, recordResponse] = await Promise.all([
      ApiGenericService.find<SaplingGenericItem>(columnEntityHandle.value, {
        orderBy: buildOrderBy(columnState.value.entityTemplates),
        limit: DEFAULT_ENTITY_ITEMS_COUNT,
      }),
      ApiGenericService.find<SaplingGenericItem>(props.entityHandle, {
        orderBy: buildOrderBy(entityState.value.entityTemplates, ['updatedAt']),
        limit: DEFAULT_ENTITY_ITEMS_COUNT,
        relations: buildRecordRelations(),
      }),
    ])

    columns.value = columnResponse.data
    records.value = recordResponse.data
    hasLoadedOnce.value = true
  } finally {
    isLoading.value = false
  }
}

function resetBoard(): void {
  columns.value = []
  records.value = []
  search.value = ''
  scope.value = 'open'
  hasLoadedOnce.value = false
  closeDialog()
}

function buildOrderBy(
  templates: EntityTemplate[],
  preferredFields: string[] = [],
): Record<string, string> {
  const orderBy: Record<string, string> = {}
  preferredFields.forEach((field) => {
    if (templates.some((template) => template.name === field)) {
      orderBy[field] = field === 'updatedAt' ? 'DESC' : 'ASC'
    }
  })

  if (templates.some((template) => template.name === 'sortOrder')) {
    orderBy.sortOrder = 'ASC'
  }

  templates.forEach((template) => {
    if (template.options?.includes('isOrderASC')) {
      orderBy[template.name] = 'ASC'
    } else if (template.options?.includes('isOrderDESC')) {
      orderBy[template.name] = 'DESC'
    }
  })

  return Object.keys(orderBy).length > 0 ? orderBy : { handle: 'ASC' }
}

function buildRecordRelations(): string[] {
  const relations = new Set<string>()
  if (kanbanConfig.value?.columnField) {
    relations.add(kanbanConfig.value.columnField)
  }

  relationTemplates.value.forEach((template) => relations.add(template.name))
  return [...relations]
}

function compareColumns(left: SaplingGenericItem, right: SaplingGenericItem): number {
  const leftSort = Number(left.sortOrder ?? 0)
  const rightSort = Number(right.sortOrder ?? 0)
  if (Number.isFinite(leftSort) && Number.isFinite(rightSort) && leftSort !== rightSort) {
    return leftSort - rightSort
  }

  return getColumnLabel(left).localeCompare(getColumnLabel(right))
}

function getColumnRecords(column: SaplingGenericItem): SaplingGenericItem[] {
  return filteredRecords.value.filter(
    (record) => getRecordColumnHandle(record) === String(column.handle),
  )
}

function getRecordColumnHandle(record: SaplingGenericItem | null | undefined): string {
  if (!record || !kanbanConfig.value) {
    return ''
  }

  return getRelationHandle(record[kanbanConfig.value.columnField])
}

function findColumnByRecord(record: SaplingGenericItem): SaplingGenericItem | null {
  const columnHandle = getRecordColumnHandle(record)
  return columns.value.find((column) => String(column.handle) === columnHandle) ?? null
}

function isExpectedValue(value: unknown, expected = true): boolean {
  if (typeof value === 'boolean') {
    return value === expected
  }

  if (typeof value === 'string') {
    return (value === 'true') === expected
  }

  return expected ? Boolean(value) : !value
}

function getColumnStyle(column: SaplingGenericItem): Record<string, string> {
  const color = typeof column.color === 'string' && column.color.trim() ? column.color : '#607d8b'
  return {
    '--sapling-kanban-column-color': color,
  }
}

function getColumnIcon(column: SaplingGenericItem): string {
  return typeof column.icon === 'string' && column.icon.trim() ? column.icon : 'mdi-ray-start-arrow'
}

function getColumnLabel(column: SaplingGenericItem): string {
  return (
    getEntityValueLabel(column, columnState.value.entityTemplates) ||
    formatDisplayValue(column.handle) ||
    t('kanbanBoard.unknownColumn')
  )
}

function getColumnDescription(column: SaplingGenericItem): string {
  const descriptionField = kanbanConfig.value?.columnDescriptionField
  if (descriptionField && column[descriptionField] != null) {
    return formatFieldValue(
      descriptionField,
      column[descriptionField],
      columnState.value.entityTemplates,
    )
  }

  const scopeField = kanbanConfig.value?.scopeOpenField
  if (scopeField && column[scopeField] != null) {
    return isExpectedValue(column[scopeField], kanbanConfig.value?.scopeOpenValue)
      ? t('kanbanBoard.openColumn')
      : t('kanbanBoard.closedColumn')
  }

  return getColumnFieldLabel.value
}

function getRecordTitle(record: SaplingGenericItem | null | undefined): string {
  return (
    getEntityValueLabel(record, entityState.value.entityTemplates) || t('kanbanBoard.unnamedRecord')
  )
}

function getCardSubtitle(record: SaplingGenericItem): string {
  const fields = kanbanConfig.value?.cardSubtitleFields ?? []
  return getFieldLabels(record, fields)[0] ?? ''
}

function getCardMeta(record: SaplingGenericItem): string[] {
  return getFieldLabels(record, kanbanConfig.value?.cardMetaFields ?? []).slice(0, 3)
}

function getCardFooter(record: SaplingGenericItem): string[] {
  const fields = kanbanConfig.value?.cardFooterFields ?? []
  const labels: string[] = []
  const firstPersonLabel = getFirstFieldLabel(
    record,
    fields.filter((field) =>
      entityState.value.entityTemplates
        .find((template) => template.name === field)
        ?.options?.includes('isPerson'),
    ),
  )

  if (firstPersonLabel) {
    labels.push(firstPersonLabel)
  }

  fields
    .filter((field) => !personTemplates.value.some((template) => template.name === field))
    .forEach((field) => {
      const label = getFieldLabel(record, field)
      if (label) {
        labels.push(label)
      }
    })

  return labels.slice(0, 2)
}

function getFieldLabels(record: SaplingGenericItem, fields: string[]): string[] {
  return fields.map((field) => getFieldLabel(record, field)).filter(Boolean)
}

function getFirstFieldLabel(record: SaplingGenericItem, fields: string[]): string {
  return fields.map((field) => getFieldLabel(record, field)).find(Boolean) ?? ''
}

function getFieldLabel(record: SaplingGenericItem, field: string): string {
  return formatFieldValue(field, record[field], entityState.value.entityTemplates)
}

function formatFieldValue(field: string, value: unknown, templates: EntityTemplate[]): string {
  if (value == null || value === '') {
    return ''
  }

  const template = templates.find((entry) => entry.name === field)
  if (template?.isReference && typeof value === 'object') {
    const referenceTemplates = template.referenceName
      ? genericStore.getState(template.referenceName).entityTemplates
      : []
    return getEntityValueLabel(value as SaplingGenericItem, referenceTemplates)
  }

  if (template?.options?.includes('isMoney')) {
    return new Intl.NumberFormat(locale.value, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(Number(value ?? 0))
  }

  if (template?.options?.includes('isPercent')) {
    return `${Math.round(Number(value ?? 0))}%`
  }

  if (template?.type === 'date' || template?.type === 'DateType' || template?.type === 'datetime') {
    const date = new Date(String(value))
    return Number.isNaN(date.getTime()) ? '' : d(date)
  }

  if (typeof value === 'number') {
    return n(value)
  }

  return formatDisplayValue(value)
}

function formatDisplayValue(value: unknown): string {
  if (value == null) {
    return ''
  }

  if (typeof value === 'object') {
    return getEntityValueLabel(value as SaplingGenericItem)
  }

  return String(value).trim()
}

function getSearchText(record: SaplingGenericItem): string {
  const valueFields = entityState.value.entityTemplates
    .filter((template) => template.options?.includes('isValue'))
    .map((template) => getFieldLabel(record, template.name))
  const configuredFields = [
    ...(kanbanConfig.value?.cardSubtitleFields ?? []),
    ...(kanbanConfig.value?.cardMetaFields ?? []),
    ...(kanbanConfig.value?.cardFooterFields ?? []),
  ].map((field) => getFieldLabel(record, field))

  return [getRecordTitle(record), ...valueFields, ...configuredFields].filter(Boolean).join(' ')
}

function matchesWorkFilter(record: SaplingGenericItem): boolean {
  const hasPeopleFilter = selectedPeople.value.length > 0
  const hasCompanyFilter = selectedCompanies.value.length > 0
  if (!hasPeopleFilter && !hasCompanyFilter) {
    return true
  }

  const personMatches =
    hasPeopleFilter &&
    personTemplates.value.some((template) =>
      selectedPeople.value.includes(getRelationHandleNumber(record[template.name])),
    )
  const companyMatches =
    hasCompanyFilter &&
    companyTemplates.value.some((template) =>
      selectedCompanies.value.includes(getRelationHandleNumber(record[template.name])),
    )

  return personMatches || companyMatches
}

function shouldShowDropPreview(column: SaplingGenericItem): boolean {
  if (!draggedRecord.value || dropColumnHandle.value !== String(column.handle)) {
    return false
  }

  return getRecordColumnHandle(draggedRecord.value) !== String(column.handle)
}

function onDragStart(event: DragEvent, record: SaplingGenericItem): void {
  if (!canUpdateRecord.value || record.handle == null) {
    event.preventDefault()
    return
  }

  draggedRecordHandle.value = String(record.handle)
  event.dataTransfer?.setData('text/plain', String(record.handle))
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    setCardDragImage(event)
  }
}

function onDragOver(event: DragEvent, column: SaplingGenericItem): void {
  if (draggedRecordHandle.value != null && dropColumnHandle.value !== String(column.handle)) {
    dropColumnHandle.value = String(column.handle)
  }

  if (event.dataTransfer != null) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function onDragEnd(): void {
  draggedRecordHandle.value = null
  dropColumnHandle.value = null
  clearCardDragImage()
}

function setCardDragImage(event: DragEvent): void {
  const source = event.currentTarget
  if (!(source instanceof HTMLElement) || event.dataTransfer == null) {
    return
  }

  clearCardDragImage()
  const dragImage = source.cloneNode(true) as HTMLElement
  dragImage.classList.add('sapling-kanban-card--drag-image')
  dragImage.style.width = `${source.offsetWidth}px`
  document.body.appendChild(dragImage)
  dragImageElement.value = dragImage
  event.dataTransfer.setDragImage(dragImage, Math.min(source.offsetWidth / 2, 180), 28)
}

function clearCardDragImage(): void {
  dragImageElement.value?.remove()
  dragImageElement.value = null
}

async function onDrop(column: SaplingGenericItem): Promise<void> {
  const handle = draggedRecordHandle.value
  onDragEnd()

  if (handle == null || !canUpdateRecord.value || !kanbanConfig.value) {
    return
  }

  const record = records.value.find((entry) => String(entry.handle) === handle)
  if (!record || getRecordColumnHandle(record) === String(column.handle)) {
    return
  }

  await moveRecord(record, column)
}

async function moveRecord(record: SaplingGenericItem, column: SaplingGenericItem): Promise<void> {
  if (record.handle == null || !kanbanConfig.value) {
    return
  }

  const columnField = kanbanConfig.value.columnField
  const previousColumn = record[columnField]
  record[columnField] = column

  try {
    const updatedRecord = await ApiGenericService.update<SaplingGenericItem>(
      props.entityHandle,
      record.handle,
      { [columnField]: column.handle },
      { relations: buildRecordRelations() },
    )
    patchRecord(updatedRecord)
    pushMessage(
      'success',
      t('kanbanBoard.columnUpdated'),
      t('kanbanBoard.columnUpdatedDescription', { column: getColumnLabel(column) }),
      props.entityHandle,
    )
  } catch {
    record[columnField] = previousColumn
  }
}

function patchRecord(item: SaplingGenericItem | null | undefined): void {
  if (item?.handle == null) {
    return
  }

  const index = records.value.findIndex((entry) => entry.handle === item.handle)
  if (index === -1) {
    records.value = [item, ...records.value]
    return
  }

  records.value.splice(index, 1, {
    ...records.value[index],
    ...item,
  })
}

async function loadDialogItem(item: SaplingGenericItem): Promise<SaplingGenericItem> {
  if (item.handle == null) {
    return item
  }

  const result = await ApiGenericService.find<SaplingGenericItem>(props.entityHandle, {
    filter: { handle: item.handle },
    limit: 1,
    relations: buildRecordRelations(),
  })

  return result.data[0] ?? item
}

function openCreateDialog(): void {
  const firstColumn = visibleColumns.value[0] ?? columns.value[0]
  editDialog.value = {
    visible: true,
    mode: 'create',
    item:
      firstColumn && kanbanConfig.value
        ? ({ [kanbanConfig.value.columnField]: firstColumn } as SaplingGenericItem)
        : null,
  }
}

async function openEditDialog(record: SaplingGenericItem): Promise<void> {
  editDialog.value = {
    visible: true,
    mode: 'edit',
    item: await loadDialogItem(record),
  }
}

function closeDialog(): void {
  editDialog.value = {
    ...editDialog.value,
    visible: false,
  }
}

function updateDialogItem(item: SaplingGenericItem | null): void {
  editDialog.value.item = item
}

async function saveDialog(
  item: SaplingGenericItem,
  action: DialogSaveAction,
  context?: DialogSaveContext,
): Promise<void> {
  let didSave = false

  try {
    if (editDialog.value.mode === 'edit' && editDialog.value.item?.handle != null) {
      const updated = await ApiGenericService.update<SaplingGenericItem>(
        props.entityHandle,
        editDialog.value.item.handle,
        item,
        { relations: buildRecordRelations() },
      )
      patchRecord(await loadDialogItem(updated))
    } else if (editDialog.value.mode === 'create') {
      const created = await ApiGenericService.create<SaplingGenericItem>(props.entityHandle, item)
      patchRecord(await loadDialogItem(created))
    }

    didSave = true
    pushMessage(
      'success',
      t('global.recordSaved'),
      t('global.recordSavedDescription'),
      props.entityHandle,
    )

    if (action === 'saveAndClose') {
      closeDialog()
      return
    }

    if (editDialog.value.item) {
      editDialog.value = {
        visible: true,
        mode: 'edit',
        item: await loadDialogItem(editDialog.value.item),
      }
    }
  } finally {
    context?.complete(didSave)
  }
}

function handleDialogDelete(item: SaplingGenericItem | null): void {
  const handle = item?.handle
  if (handle != null) {
    records.value = records.value.filter((entry) => entry.handle !== handle)
  }
  closeDialog()
}

function getRelationHandle(relation: unknown): string {
  if (typeof relation === 'number' || typeof relation === 'string') {
    return String(relation)
  }

  if (typeof relation === 'object' && relation !== null && 'handle' in relation) {
    return getRelationHandle((relation as { handle?: unknown }).handle)
  }

  return ''
}

function getRelationHandleNumber(relation: unknown): number {
  const handle = getRelationHandle(relation)
  const parsed = Number.parseInt(handle, 10)
  return Number.isNaN(parsed) ? Number.NaN : parsed
}

function normalizeFilterHandles(values: string[]): number[] {
  return values.map((value) => Number.parseInt(value, 10)).filter((value) => !Number.isNaN(value))
}

function onSelectedPeopleUpdate(values: string[]): void {
  selectedPeople.value = normalizeFilterHandles(values)
}

function onSelectedCompaniesUpdate(values: string[]): void {
  selectedCompanies.value = normalizeFilterHandles(values)
}

function translateWithFallback(key: string, fallback: string): string {
  const translated = t(key)
  return translated === key ? fallback : translated
}
</script>
