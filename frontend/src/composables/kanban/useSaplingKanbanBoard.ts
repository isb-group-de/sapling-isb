import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SaplingGenericItem } from '@/entity/entity'
import type {
  DialogSaveAction,
  DialogSaveContext,
  EntityTemplate,
  EntityTemplateKanban,
} from '@/entity/structure'
import { DEFAULT_ENTITY_ITEMS_COUNT } from '@/constants/project.constants'
import ApiGenericService from '@/services/api.generic.service'
import { useGenericStore } from '@/stores/genericStore'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import { getEntityValueLabel } from '@/utils/saplingTableUtil'
import type {
  KanbanBoardProps,
  KanbanBoardScope,
  KanbanEditDialogState,
} from '@/components/kanban/kanbanBoard.types'
import {
  buildKanbanOrderBy,
  formatKanbanDisplayValue,
  getKanbanColumnIcon,
  getKanbanColumnStyle,
  getKanbanRelationHandle,
  getKanbanRelationHandleNumber,
  isExpectedKanbanValue,
  normalizeKanbanFilterHandles,
} from '@/components/kanban/kanbanBoard.utils'
import { useSaplingKanbanDrag } from './useSaplingKanbanDrag'

export function useSaplingKanbanBoard(props: KanbanBoardProps) {
  const { t, d, n, locale } = useI18n()
  const { pushMessage } = useSaplingMessageCenter()
  const genericStore = useGenericStore()
  const search = ref('')
  const scope = ref<KanbanBoardScope>('open')
  const columns = ref<SaplingGenericItem[]>([])
  const records = ref<SaplingGenericItem[]>([])
  const isLoading = ref(false)
  const hasLoadedOnce = ref(false)
  const selectedPeople = ref<number[]>([])
  const selectedCompanies = ref<number[]>([])
  const editDialog = ref<KanbanEditDialogState>({
    visible: false,
    mode: 'create',
    item: null,
  })

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
  const boardTitle = computed(() =>
    translateWithFallback(
      `kanbanBoard.${props.entityHandle}.title`,
      translateWithFallback(`navigation.${props.entityHandle}`, props.entityHandle),
    ),
  )
  const navigationLabel = computed(() =>
    translateWithFallback(
      `navigation.${props.navigationKey || props.entityHandle}`,
      boardTitle.value,
    ),
  )
  const boardSubtitle = computed(() =>
    translateWithFallback(
      `kanbanBoard.${props.entityHandle}.subtitle`,
      t('kanbanBoard.subtitle', { entity: boardTitle.value }),
    ),
  )
  const columnFieldLabel = computed(() =>
    columnTemplate.value
      ? translateWithFallback(
          `${props.entityHandle}.${columnTemplate.value.name}`,
          columnTemplate.value.name,
        )
      : '',
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

  const visibleColumns = computed(() => {
    const ordered = [...columns.value].sort(compareColumns)
    if (scope.value === 'all' || !kanbanConfig.value?.scopeOpenField) return ordered
    return ordered.filter((column) =>
      isExpectedKanbanValue(
        column[kanbanConfig.value?.scopeOpenField as keyof SaplingGenericItem],
        kanbanConfig.value?.scopeOpenValue,
      ),
    )
  })
  const filteredRecords = computed(() => {
    const config = kanbanConfig.value
    if (!config) return []
    const normalizedSearch = search.value.trim().toLocaleLowerCase()
    const allowedColumns = new Set(visibleColumns.value.map((column) => String(column.handle)))

    return records.value.filter((record) => {
      const columnHandle = getRecordColumnHandle(record)
      if (!columnHandle || !allowedColumns.has(columnHandle)) return false
      if (
        scope.value === 'open' &&
        config.recordScopeOpenField &&
        !isExpectedKanbanValue(
          record[config.recordScopeOpenField as keyof SaplingGenericItem],
          config.recordScopeOpenValue,
        )
      ) {
        return false
      }
      if (!matchesWorkFilter(record)) return false
      return (
        !normalizedSearch || getSearchText(record).toLocaleLowerCase().includes(normalizedSearch)
      )
    })
  })
  const openRecordCount = computed(() => {
    if (!kanbanConfig.value?.scopeOpenField) return filteredRecords.value.length
    return records.value.filter((record) => {
      const column = findColumnByRecord(record)
      return column
        ? isExpectedKanbanValue(
            column[kanbanConfig.value?.scopeOpenField as keyof SaplingGenericItem],
            kanbanConfig.value?.scopeOpenValue,
          )
        : false
    }).length
  })
  const updatedRecordCount = computed(
    () => records.value.filter((record) => Boolean(record.updatedAt)).length,
  )

  async function loadBoard(): Promise<void> {
    await genericStore.loadGeneric(props.entityHandle, 'global', 'navigation', 'kanbanBoard')
    await loadReferenceMetadata()
    await loadData()
  }

  async function loadReferenceMetadata(): Promise<void> {
    const handles = new Set<string>()
    if (columnEntityHandle.value) handles.add(columnEntityHandle.value)
    relationTemplates.value.forEach((template) => {
      if (template.referenceName) handles.add(template.referenceName)
    })
    await genericStore.loadGenericMany(
      [...handles].map((entityHandle) => ({
        entityHandle,
        namespaces: ['global', 'navigation', 'kanbanBoard'],
      })),
    )
  }

  async function loadData(): Promise<void> {
    if (!kanbanConfig.value || !columnTemplate.value || !columnEntityHandle.value) return
    isLoading.value = true
    try {
      const [columnResponse, recordResponse] = await Promise.all([
        ApiGenericService.find<SaplingGenericItem>(columnEntityHandle.value, {
          orderBy: buildKanbanOrderBy(columnState.value.entityTemplates),
          limit: DEFAULT_ENTITY_ITEMS_COUNT,
        }),
        ApiGenericService.find<SaplingGenericItem>(props.entityHandle, {
          orderBy: buildKanbanOrderBy(entityState.value.entityTemplates, ['updatedAt']),
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

  function buildRecordRelations(): string[] {
    const relations = new Set<string>()
    if (kanbanConfig.value?.columnField) relations.add(kanbanConfig.value.columnField)
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
    return record && kanbanConfig.value
      ? getKanbanRelationHandle(record[kanbanConfig.value.columnField])
      : ''
  }

  function findColumnByRecord(record: SaplingGenericItem): SaplingGenericItem | null {
    const handle = getRecordColumnHandle(record)
    return columns.value.find((column) => String(column.handle) === handle) ?? null
  }

  function getColumnLabel(column: SaplingGenericItem): string {
    return (
      getEntityValueLabel(column, columnState.value.entityTemplates) ||
      formatKanbanDisplayValue(column.handle) ||
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
      return isExpectedKanbanValue(column[scopeField], kanbanConfig.value?.scopeOpenValue)
        ? t('kanbanBoard.openColumn')
        : t('kanbanBoard.closedColumn')
    }
    return columnFieldLabel.value
  }

  function getRecordTitle(record: SaplingGenericItem | null | undefined): string {
    return (
      getEntityValueLabel(record, entityState.value.entityTemplates) ||
      t('kanbanBoard.unnamedRecord')
    )
  }

  function getCardSubtitle(record: SaplingGenericItem): string {
    return getFieldLabels(record, kanbanConfig.value?.cardSubtitleFields ?? [])[0] ?? ''
  }
  function getCardMeta(record: SaplingGenericItem): string[] {
    return getFieldLabels(record, kanbanConfig.value?.cardMetaFields ?? []).slice(0, 3)
  }
  function getCardFooter(record: SaplingGenericItem): string[] {
    const fields = kanbanConfig.value?.cardFooterFields ?? []
    const labels: string[] = []
    const personLabel = fields
      .filter((field) =>
        entityState.value.entityTemplates
          .find((template) => template.name === field)
          ?.options?.includes('isPerson'),
      )
      .map((field) => getFieldLabel(record, field))
      .find(Boolean)
    if (personLabel) labels.push(personLabel)
    fields
      .filter((field) => !personTemplates.value.some((template) => template.name === field))
      .forEach((field) => {
        const label = getFieldLabel(record, field)
        if (label) labels.push(label)
      })
    return labels.slice(0, 2)
  }

  function getFieldLabels(record: SaplingGenericItem, fields: string[]): string[] {
    return fields.map((field) => getFieldLabel(record, field)).filter(Boolean)
  }
  function getFieldLabel(record: SaplingGenericItem, field: string): string {
    return formatFieldValue(field, record[field], entityState.value.entityTemplates)
  }
  function formatFieldValue(field: string, value: unknown, templates: EntityTemplate[]): string {
    if (value == null || value === '') return ''
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
    if (template?.options?.includes('isPercent')) return `${Math.round(Number(value ?? 0))}%`
    if (['date', 'DateType', 'datetime'].includes(template?.type ?? '')) {
      const date = new Date(String(value))
      return Number.isNaN(date.getTime()) ? '' : d(date)
    }
    if (typeof value === 'number') return n(value)
    return typeof value === 'object'
      ? getEntityValueLabel(value as SaplingGenericItem)
      : formatKanbanDisplayValue(value)
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
    if (!selectedPeople.value.length && !selectedCompanies.value.length) return true
    const personMatches =
      selectedPeople.value.length > 0 &&
      personTemplates.value.some((template) =>
        selectedPeople.value.includes(getKanbanRelationHandleNumber(record[template.name])),
      )
    const companyMatches =
      selectedCompanies.value.length > 0 &&
      companyTemplates.value.some((template) =>
        selectedCompanies.value.includes(getKanbanRelationHandleNumber(record[template.name])),
      )
    return personMatches || companyMatches
  }

  async function moveRecord(record: SaplingGenericItem, column: SaplingGenericItem): Promise<void> {
    if (record.handle == null || !kanbanConfig.value) return
    const columnField = kanbanConfig.value.columnField
    const previousColumn = record[columnField]
    record[columnField] = column
    try {
      const updated = await ApiGenericService.update<SaplingGenericItem>(
        props.entityHandle,
        record.handle,
        { [columnField]: column.handle },
        { relations: buildRecordRelations() },
      )
      patchRecord(updated)
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
    if (item?.handle == null) return
    const index = records.value.findIndex((entry) => entry.handle === item.handle)
    if (index === -1) records.value = [item, ...records.value]
    else records.value.splice(index, 1, { ...records.value[index], ...item })
  }

  async function loadDialogItem(item: SaplingGenericItem): Promise<SaplingGenericItem> {
    if (item.handle == null) return item
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
    editDialog.value = { visible: true, mode: 'edit', item: await loadDialogItem(record) }
  }
  function closeDialog(): void {
    editDialog.value = { ...editDialog.value, visible: false }
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
      if (action === 'saveAndClose') closeDialog()
      else if (editDialog.value.item) {
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
    if (item?.handle != null) {
      records.value = records.value.filter((entry) => entry.handle !== item.handle)
    }
    closeDialog()
  }
  function onSelectedPeopleUpdate(values: string[]): void {
    selectedPeople.value = normalizeKanbanFilterHandles(values)
  }
  function onSelectedCompaniesUpdate(values: string[]): void {
    selectedCompanies.value = normalizeKanbanFilterHandles(values)
  }
  function translateWithFallback(key: string, fallback: string): string {
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const drag = useSaplingKanbanDrag({
    canUpdateRecord,
    records,
    kanbanConfig,
    getRecordColumnHandle,
    moveRecord,
  })

  onMounted(loadBoard)
  watch(
    () => props.entityHandle,
    async () => {
      resetBoard()
      await loadBoard()
    },
  )

  return {
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
    getColumnIcon: getKanbanColumnIcon,
    getColumnLabel,
    getColumnRecords,
    getColumnStyle: getKanbanColumnStyle,
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
  }
}
