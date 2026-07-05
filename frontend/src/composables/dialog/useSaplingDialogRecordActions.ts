import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { AccumulatedPermission, DialogState, EntityTemplate } from '@/entity/structure'
import type { EntityItem, SaplingGenericItem, ScriptButtonItem } from '@/entity/entity'
import { DEFAULT_ENTITY_ITEMS_COUNT, NAVIGATION_URL } from '@/constants/project.constants'
import ApiGenericService from '@/services/api.generic.service'
import ApiScriptService from '@/services/api.script.service'
import {
  getSaplingContextMenuTableItems,
  type SaplingContextMenuTableMenuEntry,
  type SaplingContextMenuTableMenuItem,
} from '@/composables/context/useSaplingContextMenuTable'
import { useSaplingMailDialog } from '@/composables/dialog/useSaplingMailDialog'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import { useChangeLogDialogStore } from '@/stores/changeLogDialogStore'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { useTimelineDialogStore } from '@/stores/timelineDialogStore'
import { buildMailMenuActions } from '@/utils/saplingMailMenuUtil'
import {
  buildScriptButtonExecutionKey,
  handleScriptResultClient,
  pushScriptButtonAlreadyRunningMessage,
  pushScriptButtonStartedMessage,
} from '@/utils/saplingScriptResultUtil'
import { buildTableOrderBy } from '@/utils/saplingTableUtil'
import type { FormConfigMenuItem, FormConfigSelectionHandle } from './saplingDialogEdit.utils'

interface UseSaplingDialogRecordActionsProps {
  modelValue: boolean
  mode: DialogState
  item: SaplingGenericItem | null
  entity: EntityItem | null
  templates: EntityTemplate[]
}

type SaplingDialogRecordActionsEmit = {
  (event: 'update:modelValue', value: boolean): void
  (event: 'cancel'): void
  (event: 'update:mode', value: DialogState): void
  (event: 'update:item', value: SaplingGenericItem | null): void
  (event: 'deleted', value: SaplingGenericItem | null): void
}

interface UseSaplingDialogRecordActionsOptions {
  activeTab: Ref<number>
  form: Ref<SaplingGenericItem>
  formConfigMenuItems: ComputedRef<FormConfigMenuItem[]>
  isDirty: ComputedRef<boolean>
  isSaving: ComputedRef<boolean>
  permissions: Ref<AccumulatedPermission[] | null>
  selectFormConfig: (handle: FormConfigSelectionHandle) => void
}

export function useSaplingDialogRecordActions(
  props: UseSaplingDialogRecordActionsProps,
  emit: SaplingDialogRecordActionsEmit,
  options: UseSaplingDialogRecordActionsOptions,
) {
  const { t, te } = useI18n()
  const router = useRouter()
  const { pushMessage } = useSaplingMessageCenter()
  const currentPersonStore = useCurrentPersonStore()
  const timelineDialogStore = useTimelineDialogStore()
  const changeLogDialogStore = useChangeLogDialogStore()
  const { openMailDialog } = useSaplingMailDialog()

  const recordDeleteDialog = ref(false)
  const showUploadDialog = ref(false)
  const showInformationDialog = ref(false)
  const showExternalRecordLinksDialog = ref(false)
  const loadedScriptButtons = ref<ScriptButtonItem[]>([])
  const runningScriptActionCount = ref(0)

  let scriptButtonsRequestId = 0
  const runningScriptButtonKeys = new Set<string>()

  const entityHandle = computed(() => props.entity?.handle ?? '')
  const itemHandle = computed<string | number | null>(() => {
    const handle = props.item?.handle
    return typeof handle === 'string' || typeof handle === 'number' ? handle : null
  })
  const hasPersistedItem = computed(() => itemHandle.value != null)
  const isScriptActionRunning = computed(() => runningScriptActionCount.value > 0)

  const entityPermission = computed<AccumulatedPermission | null>(() => {
    if (!props.entity?.handle) {
      return null
    }

    return {
      entityHandle: props.entity.handle,
      allowRead: props.entity.canRead === true,
      allowInsert: props.entity.canInsert === true,
      allowUpdate: props.entity.canUpdate === true,
      allowDelete: props.entity.canDelete === true,
      allowShow: props.entity.canShow === true,
    }
  })

  const canNavigate = computed(() =>
    props.templates.some((template) => template.options?.includes('isNavigation')),
  )

  const canShowInformation = computed(
    () =>
      options.permissions.value?.some(
        (permission) => permission.entityHandle === 'information' && permission.allowRead,
      ) ?? false,
  )

  const canDeleteRecord = computed(
    () => hasPersistedItem.value && Boolean(entityPermission.value?.allowDelete),
  )

  const recordActionButtonsDisabled = computed(
    () =>
      options.isSaving.value ||
      isScriptActionRunning.value ||
      (props.mode === 'edit' && options.isDirty.value),
  )

  const recordActionMenuItems = computed<SaplingContextMenuTableMenuEntry[]>(() => {
    const groups: SaplingContextMenuTableMenuEntry[] =
      !hasPersistedItem.value || props.mode === 'create'
        ? []
        : getSaplingContextMenuTableItems({
            canChangeLog: hasPersistedItem.value,
            canShowInformation: canShowInformation.value,
            entityPermission: entityPermission.value,
            canNavigate: canNavigate.value,
            canTimeline: true,
            canShowExternalRecordLinks: true,
            scriptButtons: loadedScriptButtons.value,
            mailActions: buildMailMenuActions(props.templates, options.form.value),
            mailToLabel: t('global.mailTo'),
            showEdit: false,
          })
            .map((group) =>
              (Array.isArray(group) ? group : [group]).filter(
                (menuItem) => !['edit', 'show', 'delete'].includes(menuItem.type),
              ),
            )
            .filter((group) => group.length > 0)

    if (options.formConfigMenuItems.value.length > 0) {
      groups.push(
        options.formConfigMenuItems.value.map((item) => ({
          type: 'formConfig',
          icon: item.active ? 'mdi-check-circle-outline' : item.icon,
          title: item.title,
          formConfigHandle: item.handle,
        })),
      )
    }

    return groups
  })

  const mobileRecordActionMenuGroups = computed<SaplingContextMenuTableMenuItem[][]>(() =>
    recordActionMenuItems.value
      .map((group) => (Array.isArray(group) ? group : [group]))
      .filter((group) => group.length > 0),
  )

  const hasReadonlyMobileActionMenu = computed(
    () => mobileRecordActionMenuGroups.value.length > 0 || canDeleteRecord.value,
  )

  const editMobileSecondaryActionsDisabled = computed(() => {
    const hasDirtyActions = options.isDirty.value && !options.isSaving.value
    const hasPersistedActions =
      !recordActionButtonsDisabled.value &&
      (canDeleteRecord.value || mobileRecordActionMenuGroups.value.length > 0)

    return !hasDirtyActions && !hasPersistedActions
  })

  const canOpenFormConfigEditor = computed(
    () => currentPersonStore.isAdministrator && Boolean(props.entity?.handle),
  )

  async function openFormConfigEditor(): Promise<void> {
    const targetEntityHandle = props.entity?.handle
    if (!targetEntityHandle) {
      return
    }

    await router.push({ name: 'formConfig', query: { entity: targetEntityHandle } })
  }

  function closeUploadDialog(): void {
    showUploadDialog.value = false
  }

  function closeInformationDialog(): void {
    showInformationDialog.value = false
  }

  function closeExternalRecordLinksDialog(): void {
    showExternalRecordLinksDialog.value = false
  }

  function openRecordDeleteDialog(): void {
    if (!canDeleteRecord.value) {
      return
    }

    recordDeleteDialog.value = true
  }

  function closeRecordDeleteDialog(): void {
    recordDeleteDialog.value = false
  }

  function openCopyDialogFromRecord(): void {
    if (!props.item || !entityPermission.value?.allowInsert) {
      return
    }

    const copiedItem = { ...props.item }

    props.templates
      .filter((template) => template.name === 'handle' || template.isUnique)
      .forEach((template) => {
        delete copiedItem[template.name]
      })

    options.activeTab.value = 0
    emit('update:item', copiedItem)
    emit('update:mode', 'create')
  }

  function openTimelineFromRecord(): void {
    if (!entityHandle.value || itemHandle.value == null) {
      return
    }

    timelineDialogStore.openTimeline(entityHandle.value, itemHandle.value)
  }

  function openChangeLogFromRecord(): void {
    if (!entityHandle.value || itemHandle.value == null) {
      return
    }

    changeLogDialogStore.openChangeLog(entityHandle.value, itemHandle.value)
  }

  function navigateToAddress(): void {
    if (!props.item || !canNavigate.value) {
      return
    }

    const address = props.templates
      .filter((template) => template.options?.includes('isNavigation'))
      .map((template) => props.item?.[template.name || ''])
      .filter(Boolean)
      .join(' ')

    if (!address) {
      return
    }

    window.open(`${NAVIGATION_URL}${encodeURIComponent(address)}`, '_blank')
  }

  function navigateToDocuments(): void {
    if (!entityHandle.value || itemHandle.value == null) {
      return
    }

    const url = `/file/document?filter={"reference":"${String(itemHandle.value)}","entity":"${entityHandle.value}"}`
    window.open(url, '_blank')
  }

  function openUploadDialog(): void {
    if (!hasPersistedItem.value || !entityPermission.value?.allowInsert) {
      return
    }

    showUploadDialog.value = true
  }

  function openInformationDialog(): void {
    if (!hasPersistedItem.value || !canShowInformation.value) {
      return
    }

    showInformationDialog.value = true
  }

  function openExternalRecordLinksDialog(): void {
    if (!hasPersistedItem.value) {
      return
    }

    showExternalRecordLinksDialog.value = true
  }

  async function reloadDialogItem(): Promise<void> {
    if (!entityHandle.value || itemHandle.value == null) {
      return
    }

    const result = await ApiGenericService.find<SaplingGenericItem>(entityHandle.value, {
      filter: { handle: itemHandle.value },
      limit: 1,
      relations: ['m:1'],
    })

    emit('update:item', result.data[0] ?? props.item)
  }

  async function runScriptButtonFromRecord(scriptButton: ScriptButtonItem): Promise<void> {
    if (!props.entity || !props.item) {
      return
    }

    const executionKey = buildScriptButtonExecutionKey(scriptButton, [props.item])
    const scriptEntity = entityHandle.value || props.entity?.handle || 'script'
    if (runningScriptButtonKeys.has(executionKey)) {
      pushScriptButtonAlreadyRunningMessage({
        button: scriptButton,
        entity: scriptEntity,
        pushMessage,
        translate: t,
        hasTranslation: te,
      })
      return
    }

    runningScriptButtonKeys.add(executionKey)
    runningScriptActionCount.value = runningScriptButtonKeys.size
    pushScriptButtonStartedMessage({
      button: scriptButton,
      entity: scriptEntity,
      itemCount: 1,
      pushMessage,
      translate: t,
      hasTranslation: te,
    })

    try {
      await currentPersonStore.fetchCurrentPerson()
      if (!currentPersonStore.person) {
        return
      }

      const result = await ApiScriptService.runClient(
        [props.item],
        props.entity,
        currentPersonStore.person,
        scriptButton.name,
        scriptButton.parameter,
      )

      await handleScriptResultClient(result, {
        entity: scriptEntity,
        pushMessage,
        onItemData: (item) => emit('update:item', item as SaplingGenericItem),
      })

      if (result.isSuccess !== false) {
        await reloadDialogItem()
      }
    } catch {
      // API errors are already routed through the shared message center.
    } finally {
      runningScriptButtonKeys.delete(executionKey)
      runningScriptActionCount.value = runningScriptButtonKeys.size
    }
  }

  async function handleRecordAction(menuItem: SaplingContextMenuTableMenuItem): Promise<void> {
    switch (menuItem.type) {
      case 'copy':
        openCopyDialogFromRecord()
        break
      case 'changeLog':
        openChangeLogFromRecord()
        break
      case 'timeline':
        openTimelineFromRecord()
        break
      case 'navigate':
        navigateToAddress()
        break
      case 'uploadDocument':
        openUploadDialog()
        break
      case 'showDocuments':
        navigateToDocuments()
        break
      case 'showInformation':
        openInformationDialog()
        break
      case 'showExternalRecordLinks':
        openExternalRecordLinksDialog()
        break
      case 'mail':
        if (menuItem.mailAction?.email && entityHandle.value) {
          openMailDialog({
            entityHandle: entityHandle.value,
            itemHandle: itemHandle.value ?? undefined,
            draftValues: options.form.value,
            initialTo: [menuItem.mailAction.email],
          })
        }
        break
      case 'script':
        if (menuItem.scriptButton) {
          await runScriptButtonFromRecord(menuItem.scriptButton)
        }
        break
      case 'formConfig':
        options.selectFormConfig(menuItem.formConfigHandle ?? null)
        break
      default:
        break
    }
  }

  async function loadScriptButtons(): Promise<void> {
    if (!entityHandle.value || !hasPersistedItem.value || props.mode === 'create') {
      loadedScriptButtons.value = []
      return
    }

    const currentRequestId = ++scriptButtonsRequestId
    const result = await ApiGenericService.find<ScriptButtonItem>('scriptButton', {
      filter: { entity: { handle: entityHandle.value } },
      orderBy: buildTableOrderBy([{ key: 'title', order: 'asc' }]),
      limit: DEFAULT_ENTITY_ITEMS_COUNT,
      relations: ['m:1'],
    })

    if (currentRequestId !== scriptButtonsRequestId) {
      return
    }

    loadedScriptButtons.value = result.data
  }

  async function confirmRecordDelete(): Promise<void> {
    if (!entityHandle.value || itemHandle.value == null) {
      return
    }

    try {
      await ApiGenericService.delete(entityHandle.value, itemHandle.value)
      closeRecordDeleteDialog()
      pushMessage(
        'success',
        t('global.recordDeleted'),
        t('global.recordDeletedDescription'),
        entityHandle.value,
      )
      emit('deleted', props.item)
      emit('update:modelValue', false)
      emit('cancel')
    } catch {
      // API errors are already routed through the shared message center.
    }
  }

  watch(
    () => [props.modelValue, entityHandle.value, itemHandle.value, props.mode] as const,
    ([isOpen]) => {
      if (!isOpen) {
        loadedScriptButtons.value = []
        closeRecordDeleteDialog()
        closeUploadDialog()
        closeInformationDialog()
        return
      }

      void loadScriptButtons()
    },
    { immediate: true },
  )

  return {
    canDeleteRecord,
    canOpenFormConfigEditor,
    editMobileSecondaryActionsDisabled,
    hasReadonlyMobileActionMenu,
    mobileRecordActionMenuGroups,
    recordActionButtonsDisabled,
    recordActionMenuItems,
    recordDeleteDialog,
    showExternalRecordLinksDialog,
    showInformationDialog,
    showUploadDialog,
    closeExternalRecordLinksDialog,
    closeInformationDialog,
    closeRecordDeleteDialog,
    closeUploadDialog,
    confirmRecordDelete,
    handleRecordAction,
    openFormConfigEditor,
    openRecordDeleteDialog,
  }
}
