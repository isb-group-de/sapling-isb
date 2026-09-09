import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EntityItem, SaplingGenericItem } from '@/entity/entity'
import type {
  AccumulatedPermission,
  DialogSaveAction,
  DialogSaveContext,
  DialogState,
  EntityTemplate,
} from '@/entity/structure'
import type { SaplingFieldSingleSelectProps } from '@/components/dialog/fields/saplingFieldSingleSelect.utils'
import ApiGenericService from '@/services/api.generic.service'
import { getDialogRecordRelations } from '@/composables/dialog/saplingDialogRecordLoader'
import {
  buildConcurrencyOptions,
  getItemHandle,
} from '@/composables/table/saplingTableAction.utils'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'

export function buildReferenceCreateDraft(
  defaults: SaplingGenericItem | undefined,
  templates: EntityTemplate[],
): SaplingGenericItem {
  return Object.fromEntries(
    templates.flatMap((template) => {
      const value = defaults?.[template.name]
      return value == null ||
        template.fieldAccess?.allowInsert === false ||
        template.isPersistent === false ||
        template.isAutoIncrement ||
        template.options?.some((option) =>
          ['isReadOnly', 'isSystem', 'isSecurity'].includes(option),
        ) ||
        ['1:m', 'm:n', 'n:m'].includes(template.kind ?? '')
        ? []
        : [[template.name, value]]
    }),
  )
}

export function useSaplingReferenceRecordDialog(options: {
  props: SaplingFieldSingleSelectProps
  selectedItem: Ref<SaplingGenericItem | null>
  menuOpen: Ref<boolean>
  entity: ComputedRef<EntityItem | null>
  entityPermission: ComputedRef<AccumulatedPermission | null>
  entityTemplates: ComputedRef<EntityTemplate[]>
  ensureEntityMetadataLoaded: () => Promise<void>
  clearSelection: () => void
}) {
  const { props, selectedItem, entityPermission, entityTemplates } = options
  const { t } = useI18n()
  const { pushMessage } = useSaplingMessageCenter()
  const recordDialogOpen = ref(false)
  const recordDialogItem = ref<SaplingGenericItem | null>(null)
  const isRecordDialogLoading = ref(false)
  const isCreating = ref(false)
  let persistedCreateRecord: SaplingGenericItem | null = null
  const recordDialogMode = computed<DialogState>(() =>
    isCreating.value ? 'create' : entityPermission.value?.allowUpdate ? 'edit' : 'readonly',
  )
  const isCreateAction = computed(
    () => props.allowCreate === true && getItemHandle(selectedItem.value) == null,
  )
  const canCreate = computed(
    () =>
      props.allowCreate === true &&
      !props.disabled &&
      options.entity.value?.canInsert === true &&
      entityPermission.value?.allowInsert === true &&
      entityPermission.value?.allowRead === true,
  )
  const openActionLabel = computed(() =>
    isCreateAction.value
      ? t('global.createRecord')
      : props.openActionLabel || t('global.editRecord'),
  )
  const canOpenSelectedRecord = computed(
    () =>
      Boolean(props.entityHandle) &&
      !isRecordDialogLoading.value &&
      (isCreateAction.value ? canCreate.value : getItemHandle(selectedItem.value) != null),
  )

  watch(
    () => props.allowCreate,
    async (allowed) => {
      if (allowed) {
        try {
          await options.ensureEntityMetadataLoaded()
        } catch {
          /* Errors are reported by the metadata service. */
        }
      }
    },
    { immediate: true },
  )

  async function loadRecord(handle: string | number): Promise<SaplingGenericItem | null> {
    const result = await ApiGenericService.find<SaplingGenericItem>(props.entityHandle, {
      filter: { handle },
      limit: 1,
      relations: getDialogRecordRelations(entityTemplates.value),
    })
    return result.data[0] ?? null
  }

  async function openSelectedRecord() {
    if (!canOpenSelectedRecord.value) return
    options.menuOpen.value = false
    isRecordDialogLoading.value = true
    try {
      await options.ensureEntityMetadataLoaded()
      isCreating.value = isCreateAction.value
      persistedCreateRecord = null
      const handle = getItemHandle(selectedItem.value)
      if (isCreating.value) {
        if (!canCreate.value) return
        recordDialogItem.value = buildReferenceCreateDraft(
          props.createDefaults,
          entityTemplates.value,
        )
      } else {
        if (handle == null) return
        recordDialogItem.value = await loadRecord(handle)
      }
      recordDialogOpen.value = recordDialogItem.value != null
    } catch {
      recordDialogItem.value = null
    } finally {
      isRecordDialogLoading.value = false
    }
  }

  function handleRecordDialogVisibility(value: boolean) {
    recordDialogOpen.value = value
    if (!value) recordDialogItem.value = null
  }

  async function saveRecordDialog(
    value: SaplingGenericItem,
    action: DialogSaveAction,
    context: DialogSaveContext,
  ) {
    if (isRecordDialogLoading.value || !['create', 'edit'].includes(recordDialogMode.value)) {
      context.complete(false)
      return
    }
    if (isCreating.value && !canCreate.value) {
      context.complete(false)
      return
    }
    isRecordDialogLoading.value = true
    let didSave = false
    try {
      const handle = getItemHandle(persistedCreateRecord ?? recordDialogItem.value)
      const created = isCreating.value && !persistedCreateRecord
      if (!created && handle == null) return
      const saved = created
        ? await ApiGenericService.create<SaplingGenericItem>(props.entityHandle, value)
        : await ApiGenericService.update<SaplingGenericItem>(props.entityHandle, handle!, value, {
            relations: getDialogRecordRelations(entityTemplates.value),
            concurrency: buildConcurrencyOptions(entityTemplates.value, recordDialogItem.value),
          })
      // Retain the saved identity for retry, but leave the nested dialog in
      // create mode until its pending children finish. Changing its identity
      // earlier would reset their draft state during the first async save.
      if (isCreating.value) persistedCreateRecord = saved
      const savedHandle = getItemHandle(saved)
      const pendingSaved =
        savedHandle == null
          ? true
          : ((await context.persistPendingRelations?.(savedHandle)) ?? true)
      if (!pendingSaved) return
      recordDialogItem.value = saved
      isCreating.value = false
      selectedItem.value = saved
      if (created && savedHandle != null) {
        const hydrated = await loadRecord(savedHandle)
        if (hydrated) {
          recordDialogItem.value = hydrated
          selectedItem.value = hydrated
        }
      }
      didSave = pendingSaved
      pushMessage(
        'success',
        t('global.recordSaved'),
        t('global.recordSavedDescription'),
        props.entityHandle,
      )
      if (didSave && action === 'saveAndClose') handleRecordDialogVisibility(false)
    } catch {
      /* Keep the draft open for retry; API services report failures. */
    } finally {
      isRecordDialogLoading.value = false
      context.complete(didSave)
    }
  }

  function handleRecordDeleted() {
    handleRecordDialogVisibility(false)
    options.clearSelection()
  }
  return {
    recordDialogOpen,
    recordDialogItem,
    recordDialogMode,
    isRecordDialogLoading,
    isCreateAction,
    openActionLabel,
    canOpenSelectedRecord,
    openSelectedRecord,
    handleRecordDialogVisibility,
    saveRecordDialog,
    handleRecordDeleted,
  }
}
