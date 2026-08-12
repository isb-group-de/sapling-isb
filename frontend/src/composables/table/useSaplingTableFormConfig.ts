import { computed, ref, type Ref } from 'vue'
import ApiFormConfigService, {
  type SaplingFormConfigItem,
} from '@/services/api.form-config.service'
import ApiTemplateService from '@/services/api.template.service'
import { i18n } from '@/i18n'
import type { EntityTemplate } from '@/entity/structure'
import {
  applyFormConfigOverlay,
  getDefaultFormConfigHandle,
  type FormConfigMenuItem,
  type FormConfigSelectionHandle,
} from '@/composables/dialog/saplingDialogEdit.utils'
import { buildPersonalTableViewConfig } from '@/composables/table/saplingTableColumnOrder'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'

const FORM_CONFIG_CONTEXT_DELAY_MS = 100

export function useSaplingTableFormConfig(
  entityHandle: Ref<string>,
  getFallbackTemplates: () => EntityTemplate[],
) {
  const { pushMessage } = useSaplingMessageCenter()
  const systemTemplates = ref<EntityTemplate[]>([])
  const formConfigs = ref<SaplingFormConfigItem[]>([])
  const selectedFormConfigHandle = ref<FormConfigSelectionHandle>(null)
  const isLoadingFormConfigs = ref(false)
  const isSavingTableView = ref(false)
  let scheduledLoad: ReturnType<typeof setTimeout> | null = null
  let latestRequestId = 0

  const selectedFormConfig = computed(
    () =>
      formConfigs.value.find(
        (config) =>
          typeof config.handle === 'number' && config.handle === selectedFormConfigHandle.value,
      ) ?? null,
  )
  const baseTemplates = computed(() =>
    systemTemplates.value.length > 0 ? systemTemplates.value : getFallbackTemplates(),
  )
  const entityTemplates = computed(() =>
    applyFormConfigOverlay(baseTemplates.value, selectedFormConfig.value?.config ?? null),
  )
  const menuItems = computed<FormConfigMenuItem[]>(() => {
    const selectableConfigs = formConfigs.value.filter(
      (config) => config.isActive !== false && typeof config.handle === 'number',
    )
    const defaultHandle = getDefaultFormConfigHandle(selectableConfigs)
    return [
      {
        handle: null,
        title: i18n.global.t('formConfig.defaultView'),
        icon: 'mdi-view-dashboard-outline',
        active: selectedFormConfigHandle.value === null,
        isDefault: defaultHandle === null,
        canSetDefault: false,
      },
      ...selectableConfigs.map((config) => ({
        handle: config.handle ?? null,
        title: config.name,
        icon: defaultHandle === config.handle ? 'mdi-table-star' : 'mdi-table-cog',
        active: selectedFormConfigHandle.value === config.handle,
        isDefault: defaultHandle === config.handle,
        canSetDefault: config.scope === 'person',
      })),
    ]
  })
  const selectedLabel = computed(() => selectedFormConfig.value?.name ?? '')

  function cancelScheduledLoad(): void {
    if (scheduledLoad) {
      clearTimeout(scheduledLoad)
      scheduledLoad = null
    }
  }

  function reset(): void {
    cancelScheduledLoad()
    latestRequestId += 1
    systemTemplates.value = []
    formConfigs.value = []
    selectedFormConfigHandle.value = null
    isLoadingFormConfigs.value = false
  }

  async function load(
    nextEntityHandle: string,
    requestId = ++latestRequestId,
    isCurrent: () => boolean = () => true,
  ): Promise<void> {
    if (!nextEntityHandle) {
      reset()
      return
    }

    isLoadingFormConfigs.value = true
    try {
      const [templates, configs] = await Promise.all([
        ApiTemplateService.getEntityTemplate(nextEntityHandle),
        ApiFormConfigService.listTableViews(nextEntityHandle),
      ])
      if (requestId !== latestRequestId || !isCurrent()) {
        return
      }

      systemTemplates.value = templates
      formConfigs.value = configs
      selectedFormConfigHandle.value = getDefaultFormConfigHandle(configs)
    } catch {
      if (requestId === latestRequestId && isCurrent()) {
        systemTemplates.value = []
        formConfigs.value = []
        selectedFormConfigHandle.value = null
      }
    } finally {
      if (requestId === latestRequestId) {
        isLoadingFormConfigs.value = false
      }
    }
  }

  function scheduleLoad(nextEntityHandle: string, isCurrent: () => boolean): void {
    cancelScheduledLoad()
    const requestId = ++latestRequestId
    scheduledLoad = setTimeout(() => {
      scheduledLoad = null
      void load(nextEntityHandle, requestId, isCurrent)
    }, FORM_CONFIG_CONTEXT_DELAY_MS)
  }

  function select(handle: FormConfigSelectionHandle): void {
    selectedFormConfigHandle.value = handle
  }

  async function savePersonalTableView(
    name: string,
    orderedColumnKeys: string[],
    selectableColumnKeys: string[],
  ): Promise<SaplingFormConfigItem> {
    isSavingTableView.value = true
    try {
      const savedConfig = await ApiFormConfigService.createPersonalTableView(entityHandle.value, {
        name: name.trim(),
        config: buildPersonalTableViewConfig(
          entityHandle.value,
          selectedFormConfig.value?.config,
          orderedColumnKeys,
          selectableColumnKeys,
        ),
      })

      formConfigs.value = await ApiFormConfigService.listTableViews(entityHandle.value, true)
      selectedFormConfigHandle.value = savedConfig.handle ?? null
      pushMessage(
        'success',
        i18n.global.t('formConfig.tableViewSaved'),
        i18n.global.t('formConfig.tableViewSavedDescription'),
        entityHandle.value,
      )
      return savedConfig
    } finally {
      isSavingTableView.value = false
    }
  }

  async function setPersonalDefault(handle: number): Promise<void> {
    isLoadingFormConfigs.value = true
    try {
      await ApiFormConfigService.setPersonalTableViewDefault(entityHandle.value, handle)
      formConfigs.value = await ApiFormConfigService.listTableViews(entityHandle.value, true)
      selectedFormConfigHandle.value = handle
    } finally {
      isLoadingFormConfigs.value = false
    }
  }

  return {
    entityTemplates,
    menuItems,
    selectedLabel,
    selectedFormConfigHandle,
    isLoadingFormConfigs,
    isSavingTableView,
    reset,
    cancelScheduledLoad,
    scheduleLoad,
    select,
    setPersonalDefault,
    savePersonalTableView,
  }
}
