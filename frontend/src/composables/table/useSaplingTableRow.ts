// #region Imports
import { computed, ref } from 'vue'
import { useGenericStore } from '@/stores/genericStore'
import { useCurrentPermissionStore } from '@/stores/currentPermissionStore'
import type { EntityItem, SaplingGenericItem, ScriptButtonItem } from '@/entity/entity'
import type {
  AccumulatedPermission,
  DialogSaveAction,
  DialogSaveContext,
  DialogState,
  EntityTemplate,
  SaplingTableHeaderItem,
} from '@/entity/structure'
import { canReadReferenceTemplate, getEntityValueLabel } from '@/utils/saplingTableUtil'
import { buildMailMenuActions } from '@/utils/saplingMailMenuUtil'
import { useSaplingMailDialog } from '@/composables/dialog/useSaplingMailDialog'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import ApiGenericService from '@/services/api.generic.service'
import { getDialogRecordRelations } from '@/composables/dialog/saplingDialogRecordLoader'
import {
  buildConcurrencyOptions,
  getItemHandle,
} from '@/composables/table/saplingTableAction.utils'
import { useI18n } from 'vue-i18n'
import {
  getSaplingContextMenuTableItems,
  type SaplingContextMenuTableMenuEntry,
} from '@/composables/context/useSaplingContextMenuTable'
// #endregion

const REFERENCE_COLUMN_KINDS = ['m:1', '1:1']

export interface SaplingTableRowContextMenuOpenPayload {
  item: SaplingGenericItem
  index: number
  x: number
  y: number
}

export interface UseSaplingTableRowProps {
  item: SaplingGenericItem
  columns: SaplingTableHeaderItem[]
  index: number
  isSelected?: boolean
  multiSelect?: boolean
  entityHandle: string
  entity: EntityItem | null
  entityPermission: AccumulatedPermission | null
  entityTemplates: EntityTemplate[]
  scriptButtons?: ScriptButtonItem[]
  canNavigate: boolean
  canShowInformation: boolean
  showActions: boolean
  rowInteraction?: boolean
}

export type UseSaplingTableRowEmit = {
  (event: 'select-row', value: number): void
  (event: 'change-log', value: SaplingGenericItem): void
  (event: 'edit', value: SaplingGenericItem): void
  (event: 'delete', value: SaplingGenericItem): void
  (event: 'show', value: SaplingGenericItem): void
  (event: 'copy', value: SaplingGenericItem): void
  (event: 'script', value: { button: ScriptButtonItem; item: SaplingGenericItem }): void
  (event: 'navigate', value: SaplingGenericItem): void
  (event: 'timeline', value: SaplingGenericItem): void
  (event: 'upload-document', value: SaplingGenericItem): void
  (event: 'show-documents', value: SaplingGenericItem): void
  (event: 'show-information', value: SaplingGenericItem): void
  (event: 'show-external-record-links', value: SaplingGenericItem): void
  (event: 'open-context-menu', value: SaplingTableRowContextMenuOpenPayload): void
  (event: 'reload'): void
}

const INTERACTIVE_ROW_SELECTOR = [
  'a',
  'button',
  'input',
  'label',
  'select',
  'textarea',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="link"]',
  '[role="menuitem"]',
  '.v-btn',
  '.v-input',
  '.v-selection-control',
].join(', ')

/**
 * Encapsulates row interactions, context menu handling and referenced entity helpers.
 */
export function useSaplingTableRow(props: UseSaplingTableRowProps, emit: UseSaplingTableRowEmit) {
  // #region State
  const genericStore = useGenericStore()
  const currentPermissionStore = useCurrentPermissionStore()
  const { t } = useI18n()
  const { openMailDialog } = useSaplingMailDialog()
  const { pushMessage } = useSaplingMessageCenter()
  const menuActive = ref(false)
  const showDialogMap = ref<Record<string, boolean>>({})
  const dialogItemMap = ref<Record<string, SaplingGenericItem | null>>({})
  const dialogLoadingMap = ref<Record<string, boolean>>({})

  const hasActionsColumn = computed(() =>
    props.columns.some((column) => column.key === '__actions'),
  )
  const scriptButtons = computed(() => props.scriptButtons ?? [])
  const mailToLabel = computed(() => t('global.mailTo'))
  const hasActionMenuItems = computed(() => {
    if (props.entityPermission?.allowUpdate || props.entityPermission?.allowDelete) {
      return true
    }

    if (props.entityPermission?.allowInsert) {
      return true
    }

    if (props.canNavigate || props.canShowInformation || props.item?.handle != null) {
      return true
    }

    if (scriptButtons.value.length > 0) {
      return true
    }

    return props.entityTemplates.some((template) => {
      const templateName = template.name
      return (
        template.options?.includes('isMail') &&
        typeof templateName === 'string' &&
        Boolean(props.item[templateName])
      )
    })
  })
  const rowMenuItems = computed<SaplingContextMenuTableMenuEntry[]>(() =>
    !menuActive.value
      ? []
      : getSaplingContextMenuTableItems({
          canChangeLog: props.item?.handle != null,
          canShowInformation: props.canShowInformation,
          entityPermission: props.entityPermission,
          canNavigate: props.canNavigate,
          canTimeline: props.item?.handle != null,
          canShowExternalRecordLinks: props.item?.handle != null,
          scriptButtons: scriptButtons.value,
          mailActions: buildMailMenuActions(props.entityTemplates, props.item),
          mailToLabel: mailToLabel.value,
        }),
  )
  const compactPanelTitles = computed<Record<string, string>>(() => {
    const referenceColumns = props.columns.filter(
      (column) => Boolean(column.key) && isReferenceColumn(column),
    )
    if (referenceColumns.length === 0) {
      return {}
    }

    const titles: Record<string, string> = {}

    for (const column of referenceColumns) {
      const columnKey = column.key as string

      const referenceValue = props.item[columnKey]
      if (
        !column.referenceName ||
        !canReadReferenceColumn(column) ||
        !referenceValue ||
        typeof referenceValue !== 'object'
      ) {
        titles[columnKey] = ''
        continue
      }

      titles[columnKey] = getEntityValueLabel(
        referenceValue as SaplingGenericItem,
        getReferenceTemplates(column.referenceName),
      )
    }

    return titles
  })
  // #endregion

  // #region Reference Data
  function getReferenceState(referenceName?: string) {
    return referenceName ? genericStore.getState(referenceName) : null
  }

  function getReferenceTemplates(referenceName?: string) {
    return getReferenceState(referenceName)?.entityTemplates ?? []
  }

  function getReferenceEntity(referenceName?: string) {
    return getReferenceState(referenceName)?.entity ?? null
  }

  function isReferenceColumn(column: EntityTemplate) {
    return REFERENCE_COLUMN_KINDS.includes(column.kind ?? '') && Boolean(column.referenceName)
  }

  function canReadReferenceColumn(column: EntityTemplate) {
    return canReadReferenceTemplate(column, currentPermissionStore.accumulatedPermission ?? [])
  }

  function isReferenceLoading(column: EntityTemplate) {
    if (!column.referenceName || !canReadReferenceColumn(column)) {
      return false
    }

    return getReferenceState(column.referenceName)?.isLoading ?? false
  }

  function getCompactPanelTitle(columnKey: string): string {
    return compactPanelTitles.value[columnKey] ?? ''
  }
  // #endregion

  // #region Row Dialogs
  async function openDialogForCol(columnKey: string) {
    if (dialogLoadingMap.value[columnKey]) {
      return
    }

    const column = props.columns.find((entry) => entry.key === columnKey)
    const referenceName = column?.referenceName
    const referenceValue = props.item[columnKey]
    const identifier = getReferenceIdentifier(column, referenceValue)

    if (!referenceName || !identifier) {
      return
    }

    dialogLoadingMap.value[columnKey] = true

    try {
      await genericStore.loadGeneric(referenceName, 'global')

      const dialogItem = await loadReferenceDialogItem(
        referenceName,
        { [identifier.key]: identifier.value },
        null,
      )

      if (!dialogItem) {
        return
      }

      dialogItemMap.value[columnKey] = dialogItem
      showDialogMap.value[columnKey] = true
    } finally {
      dialogLoadingMap.value[columnKey] = false
    }
  }

  function closeDialogForCol(columnKey: string) {
    showDialogMap.value[columnKey] = false
  }

  function isDialogOpenForCol(columnKey: string) {
    return Boolean(showDialogMap.value[columnKey])
  }

  function getDialogItemForCol(columnKey: string) {
    return dialogItemMap.value[columnKey] ?? null
  }

  function isDialogLoadingForCol(columnKey: string) {
    return Boolean(dialogLoadingMap.value[columnKey])
  }

  function getReferenceDialogMode(referenceName?: string): DialogState {
    return getReferenceState(referenceName)?.entityPermission?.allowUpdate ? 'edit' : 'readonly'
  }

  async function loadReferenceDialogItem(
    referenceName: string,
    filter: Record<string, unknown>,
    fallback: SaplingGenericItem | null,
  ): Promise<SaplingGenericItem | null> {
    const result = await ApiGenericService.find<SaplingGenericItem>(referenceName, {
      filter,
      limit: 1,
      relations: getDialogRecordRelations(getReferenceTemplates(referenceName)),
    })

    return result.data[0] ?? fallback
  }

  async function saveDialogForCol(
    columnKey: string,
    item: SaplingGenericItem,
    action: DialogSaveAction,
    context: DialogSaveContext,
  ): Promise<void> {
    const column = props.columns.find((entry) => entry.key === columnKey)
    const referenceName = column?.referenceName
    const currentDialogItem = getDialogItemForCol(columnKey)
    const handle = getItemHandle(currentDialogItem)
    let didSave = false

    if (!referenceName || handle == null || !currentDialogItem) {
      context.complete(false)
      return
    }

    try {
      const updatedItem = await ApiGenericService.update<SaplingGenericItem>(
        referenceName,
        handle,
        item,
        {
          relations: getDialogRecordRelations(getReferenceTemplates(referenceName)),
          concurrency: buildConcurrencyOptions(
            getReferenceTemplates(referenceName),
            currentDialogItem,
          ),
        },
      )
      const reloadedItem = await loadReferenceDialogItem(referenceName, { handle }, updatedItem)

      dialogItemMap.value[columnKey] = reloadedItem
      didSave = true
      emit('reload')
      pushMessage(
        'success',
        t('global.recordSaved'),
        t('global.recordSavedDescription'),
        referenceName,
      )

      if (action === 'saveAndClose') {
        closeDialogForCol(columnKey)
      }
    } finally {
      context.complete(didSave)
    }
  }

  function onDialogItemUpdate(columnKey: string, item: SaplingGenericItem | null): void {
    dialogItemMap.value[columnKey] = item
  }

  function onDialogRecordDeleted(columnKey: string): void {
    closeDialogForCol(columnKey)
    dialogItemMap.value[columnKey] = null
    emit('reload')
  }

  function getReferenceIdentifier(
    column: EntityTemplate | undefined,
    value: unknown,
  ): { key: string; value: string | number } | null {
    const identifierKeys = [...(column?.referencedPks ?? []), 'handle', 'id'].filter(
      (key, index, keys) => Boolean(key) && keys.indexOf(key) === index,
    )

    if (typeof value === 'string' || typeof value === 'number') {
      return { key: identifierKeys[0] ?? 'handle', value }
    }

    if (!value || typeof value !== 'object') {
      return null
    }

    const referenceItem = value as SaplingGenericItem
    for (const key of identifierKeys) {
      const identifierValue = referenceItem[key]
      if (typeof identifierValue === 'string' || typeof identifierValue === 'number') {
        return { key, value: identifierValue }
      }
    }

    return null
  }

  // #endregion

  // #region Menu and Actions
  function closeMenu() {
    menuActive.value = false
  }

  function openContextMenu(event: MouseEvent, item: SaplingGenericItem, index: number) {
    if (props.rowInteraction === false) {
      return
    }

    emit('open-context-menu', {
      item,
      index,
      x: event.clientX,
      y: event.clientY,
    })
  }

  function isInteractiveRowTarget(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest(INTERACTIVE_ROW_SELECTOR) !== null
  }

  function onRowMouseDown(event: MouseEvent, index: number) {
    if (props.rowInteraction === false) {
      return
    }

    if (event.button === 0 && !props.multiSelect && !isInteractiveRowTarget(event.target)) {
      emit('select-row', index)
    }
  }

  function onRowDoubleClick(event: MouseEvent) {
    if (props.rowInteraction === false) {
      return
    }

    if (event.button !== 0 || isInteractiveRowTarget(event.target)) {
      return
    }

    if (props.entityPermission?.allowUpdate) {
      requestEdit(props.item)
      return
    }

    requestShow(props.item)
  }

  /**
   * Keyboard activation for table rows. Enter opens the edit (or show)
   * dialog for the current row; Space toggles the selection. We only react
   * when the focus is on the row itself — clicks on nested buttons/inputs
   * still propagate their native behavior.
   */
  function onRowKeydown(event: KeyboardEvent, index: number) {
    if (props.rowInteraction === false) {
      return
    }

    if (event.repeat || isInteractiveRowTarget(event.target)) {
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (props.entityPermission?.allowUpdate) {
        requestEdit(props.item)
        return
      }
      if (props.entityPermission?.allowShow !== false) {
        requestShow(props.item)
      }
      return
    }

    if (event.key === ' ' || event.code === 'Space') {
      event.preventDefault()
      emit('select-row', index)
    }
  }

  function toggleRowSelection(index: number) {
    if (props.rowInteraction === false) {
      return
    }

    emit('select-row', index)
  }

  function requestEdit(item: SaplingGenericItem) {
    closeMenu()
    emit('edit', item)
  }

  function requestChangeLog(item: SaplingGenericItem) {
    closeMenu()
    emit('change-log', item)
  }

  function requestShow(item: SaplingGenericItem) {
    closeMenu()
    emit('show', item)
  }

  function requestDelete(item: SaplingGenericItem) {
    closeMenu()
    emit('delete', item)
  }

  function requestCopy(item: SaplingGenericItem) {
    closeMenu()
    emit('copy', item)
  }

  function requestScript(item: SaplingGenericItem, scriptButton: ScriptButtonItem) {
    closeMenu()
    emit('script', { button: scriptButton, item })
  }

  function requestNavigate(item: SaplingGenericItem) {
    closeMenu()
    emit('navigate', item)
  }

  function requestTimeline(item: SaplingGenericItem) {
    closeMenu()
    emit('timeline', item)
  }

  function requestUploadDocument(item: SaplingGenericItem) {
    closeMenu()
    emit('upload-document', item)
  }

  function requestShowDocuments(item: SaplingGenericItem) {
    closeMenu()
    emit('show-documents', item)
  }

  function requestShowInformation(item: SaplingGenericItem) {
    closeMenu()
    emit('show-information', item)
  }

  function requestShowExternalRecordLinks(item: SaplingGenericItem) {
    closeMenu()
    emit('show-external-record-links', item)
  }

  function requestMail(item: SaplingGenericItem, email: string) {
    closeMenu()
    if (!email) {
      return
    }

    openMailDialog({
      entityHandle: props.entityHandle,
      itemHandle: item.handle as string | number | undefined,
      draftValues: item,
      initialTo: [email],
    })
  }
  // #endregion

  // #region Cell Helpers
  function getNormalizedType(column: EntityTemplate): string {
    return String(column.type ?? '').toLowerCase()
  }

  function isDateTimeColumn(column: EntityTemplate): boolean {
    return getNormalizedType(column) === 'datetime'
  }

  function isDateColumn(column: EntityTemplate): boolean {
    return ['date', 'datetype'].includes(getNormalizedType(column))
  }

  function isTimeColumn(column: EntityTemplate): boolean {
    return getNormalizedType(column) === 'time'
  }

  function getCellValue(
    item: SaplingGenericItem,
    key: string | number | symbol | null | undefined,
  ) {
    if (!key) {
      return null
    }

    const value = item[String(key)]
    if (value == null || typeof value === 'string' || value instanceof Date) {
      return value
    }

    return String(value)
  }

  function getColumnCellClass(column: SaplingTableHeaderItem) {
    const cellProps = (column as { cellProps?: { class?: string } }).cellProps
    return cellProps?.class
  }

  function formatLink(value: string): string {
    if (!value) {
      return ''
    }

    return /^https?:\/\//i.test(value) ? value : `https://${value}`
  }
  // #endregion

  // #region Return
  return {
    menuActive,
    hasActionsColumn,
    hasActionMenuItems,
    scriptButtons,
    rowMenuItems,
    openContextMenu,
    onRowMouseDown,
    onRowDoubleClick,
    onRowKeydown,
    toggleRowSelection,
    openDialogForCol,
    closeDialogForCol,
    isDialogOpenForCol,
    getDialogItemForCol,
    isDialogLoadingForCol,
    getReferenceDialogMode,
    saveDialogForCol,
    onDialogItemUpdate,
    onDialogRecordDeleted,
    closeMenu,
    requestEdit,
    requestChangeLog,
    requestShow,
    requestDelete,
    requestCopy,
    requestScript,
    requestNavigate,
    requestTimeline,
    requestUploadDocument,
    requestShowDocuments,
    requestShowInformation,
    requestShowExternalRecordLinks,
    requestMail,
    getReferenceTemplates,
    getReferenceEntity,
    isReferenceColumn,
    canReadReferenceColumn,
    isReferenceLoading,
    getCompactPanelTitle,
    isDateTimeColumn,
    isDateColumn,
    isTimeColumn,
    getCellValue,
    getColumnCellClass,
    formatLink,
  }
  // #endregion
}
