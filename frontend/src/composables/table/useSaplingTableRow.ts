// #region Imports
import { computed, ref, watch } from 'vue'
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
import {
  canReadReferenceTemplate,
  getEntityValueLabelLines,
  type EntityValueLabelLine,
  type EntityValueReferenceTemplates,
} from '@/utils/saplingTableUtil'
import {
  buildMailMenuActions,
  getCustomerCompanyHandle,
  loadCustomerContactMailActions,
} from '@/utils/saplingMailMenuUtil'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import ApiGenericService from '@/services/api.generic.service'
import { getDialogRecordRelations } from '@/composables/dialog/saplingDialogRecordLoader'
import {
  buildConcurrencyOptions,
  getItemHandle,
} from '@/composables/table/saplingTableAction.utils'
import { useI18n } from 'vue-i18n'
import { useSaplingTableRowActions } from './useSaplingTableRowActions'
import {
  getSaplingContextMenuTableItems,
  type SaplingContextMenuTableMenuEntry,
} from '@/composables/context/useSaplingContextMenuTable'
// #endregion

const REFERENCE_COLUMN_KINDS = ['m:1', '1:1']
const COMPACT_REFERENCE_LABEL_MAX_LINES = 2

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
  isActive?: boolean
  multiSelect?: boolean
  entityHandle: string
  entity: EntityItem | null
  entityPermission: AccumulatedPermission | null
  entityTemplates: EntityTemplate[]
  scriptButtons?: ScriptButtonItem[]
  canNavigate: boolean
  canShowInformation: boolean
  canShowExternalRecordLinks?: boolean
  showActions: boolean
  rowInteraction?: boolean
}

export type UseSaplingTableRowEmit = {
  (event: 'select-row', value: number): void
  (event: 'activate-row', value: number): void
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

/**
 * Encapsulates row interactions, context menu handling and referenced entity helpers.
 */
export function useSaplingTableRow(props: UseSaplingTableRowProps, emit: UseSaplingTableRowEmit) {
  // #region State
  const genericStore = useGenericStore()
  const currentPermissionStore = useCurrentPermissionStore()
  const { t } = useI18n()
  const { pushMessage } = useSaplingMessageCenter()
  const menuActive = ref(false)
  const showDialogMap = ref<Record<string, boolean>>({})
  const dialogItemMap = ref<Record<string, SaplingGenericItem | null>>({})
  const dialogLoadingMap = ref<Record<string, boolean>>({})
  const customerContactMailActions = ref<ReturnType<typeof buildMailMenuActions>>([])
  let customerContactsRequestId = 0

  const hasActionsColumn = computed(() =>
    props.columns.some((column) => column.key === '__actions'),
  )
  const scriptButtons = computed(() => props.scriptButtons ?? [])
  const mailToLabel = computed(() => t('global.mailTo'))
  const canReadPerson = computed(
    () =>
      currentPermissionStore.accumulatedPermission?.some(
        (permission) => permission.entityHandle === 'person' && permission.allowRead,
      ) ?? false,
  )
  const customerCompanyHandle = computed(() =>
    getCustomerCompanyHandle(props.entityTemplates, props.item),
  )
  const hasActionMenuItems = computed(() => {
    if (props.entityPermission?.allowUpdate || props.entityPermission?.allowDelete) {
      return true
    }

    if (props.entityPermission?.allowInsert) {
      return true
    }

    if (
      props.canNavigate ||
      props.canShowInformation ||
      props.canShowExternalRecordLinks ||
      props.item?.handle != null
    ) {
      return true
    }

    if (scriptButtons.value.length > 0) {
      return true
    }

    if (canReadPerson.value && customerCompanyHandle.value != null) {
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
          canCustomer360:
            props.item?.handle != null && ['company', 'person'].includes(props.entityHandle),
          canShowInformation: props.canShowInformation,
          entityPermission: props.entityPermission,
          canNavigate: props.canNavigate,
          canTimeline: props.item?.handle != null,
          canShowExternalRecordLinks:
            props.item?.handle != null && props.canShowExternalRecordLinks === true,
          scriptButtons: scriptButtons.value,
          mailActions: [
            ...buildMailMenuActions(props.entityTemplates, props.item),
            ...customerContactMailActions.value,
          ],
          mailToLabel: mailToLabel.value,
        }),
  )
  const compactPanelTitleLines = computed<Record<string, EntityValueLabelLine[]>>(() => {
    const referenceColumns = props.columns.filter(
      (column) => Boolean(column.key) && isReferenceColumn(column),
    )
    if (referenceColumns.length === 0) {
      return {}
    }

    const titles: Record<string, EntityValueLabelLine[]> = {}

    for (const column of referenceColumns) {
      const columnKey = column.key as string

      const referenceValue = props.item[columnKey]
      if (
        !column.referenceName ||
        !canReadReferenceColumn(column) ||
        !referenceValue ||
        typeof referenceValue !== 'object'
      ) {
        titles[columnKey] = []
        continue
      }

      const referenceTemplates = getReferenceTemplates(column.referenceName)
      titles[columnKey] = getEntityValueLabelLines(
        resolveCircularValueReferences(referenceValue as SaplingGenericItem, referenceTemplates),
        referenceTemplates,
        getValueReferenceTemplates(referenceTemplates),
      ).slice(0, COMPACT_REFERENCE_LABEL_MAX_LINES)
    }

    return titles
  })
  // #endregion

  watch(menuActive, (isActive) => {
    if (!isActive) {
      return
    }
    void loadCustomerContacts()
  })

  watch(customerCompanyHandle, () => {
    customerContactMailActions.value = []
  })

  async function loadCustomerContacts(): Promise<void> {
    const currentRequestId = ++customerContactsRequestId
    try {
      const actions = await loadCustomerContactMailActions(
        props.entityTemplates,
        props.item,
        canReadPerson.value,
      )
      if (currentRequestId === customerContactsRequestId) {
        customerContactMailActions.value = actions
      }
    } catch {
      if (currentRequestId === customerContactsRequestId) {
        customerContactMailActions.value = []
      }
    }
  }

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

  function getValueReferenceTemplates(templates: EntityTemplate[]): EntityValueReferenceTemplates {
    return Object.fromEntries(
      templates
        .filter(
          (template) =>
            REFERENCE_COLUMN_KINDS.includes(template.kind ?? '') &&
            template.options?.includes('isValue') &&
            Boolean(template.referenceName),
        )
        .map((template) => [
          template.referenceName as string,
          getReferenceTemplates(template.referenceName),
        ]),
    )
  }

  function resolveCircularValueReferences(
    referenceItem: SaplingGenericItem,
    templates: EntityTemplate[],
  ): SaplingGenericItem {
    const sourceHandle = getItemHandle(props.item)
    if (sourceHandle == null) {
      return referenceItem
    }

    const replacements = templates.flatMap((template) => {
      if (!template.options?.includes('isValue') || template.referenceName !== props.entityHandle) {
        return []
      }

      const nestedValue = referenceItem[template.name]
      if (
        !nestedValue ||
        typeof nestedValue !== 'object' ||
        String(getItemHandle(nestedValue as SaplingGenericItem) ?? '') !== String(sourceHandle)
      ) {
        return []
      }

      return [[template.name, props.item] as const]
    })

    return replacements.length > 0
      ? { ...referenceItem, ...Object.fromEntries(replacements) }
      : referenceItem
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

  function getCompactPanelTitleLines(columnKey: string): EntityValueLabelLine[] {
    return compactPanelTitleLines.value[columnKey] ?? []
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
    const identifier = getReferenceIdentifier(referenceValue)

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

  function getReferenceIdentifier(value: unknown): { key: string; value: string | number } | null {
    if (typeof value === 'string' || typeof value === 'number') {
      return { key: 'handle', value }
    }

    if (!value || typeof value !== 'object') {
      return null
    }

    const identifierValue = (value as SaplingGenericItem).handle
    return typeof identifierValue === 'string' || typeof identifierValue === 'number'
      ? { key: 'handle', value: identifierValue }
      : null
  }

  // #endregion

  const rowActions = useSaplingTableRowActions(props, emit, menuActive)

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
    ...rowActions,
    openDialogForCol,
    closeDialogForCol,
    isDialogOpenForCol,
    getDialogItemForCol,
    isDialogLoadingForCol,
    getReferenceDialogMode,
    saveDialogForCol,
    onDialogItemUpdate,
    onDialogRecordDeleted,
    getReferenceTemplates,
    getReferenceEntity,
    isReferenceColumn,
    canReadReferenceColumn,
    isReferenceLoading,
    getCompactPanelTitleLines,
    isDateTimeColumn,
    isDateColumn,
    isTimeColumn,
    getCellValue,
    getColumnCellClass,
    formatLink,
  }
  // #endregion
}
