import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { EntityItem } from '@/entity/entity'
import type { AccumulatedPermission, DialogState, EntityTemplate } from '@/entity/structure'
import ApiFormConfigService, {
  type SaplingFormConfigItem,
} from '@/services/api.form-config.service'
import ApiTemplateService from '@/services/api.template.service'
import { getEditDialogHeaders } from '@/utils/saplingTableUtil'
import { groupDialogTemplates, sortDialogTemplates } from '@/utils/saplingDialogLayoutUtil'
import {
  applyFormConfigOverlay,
  getDefaultFormConfigHandle,
  type FormConfigMenuItem,
  type FormConfigSelectionHandle,
} from './saplingDialogEdit.utils'

type TranslationFunction = (key: string) => string

export function useSaplingDialogEditTemplates({
  entity,
  mode,
  providedTemplates,
  showReference,
  permissions,
  activeTab,
  t,
  te,
}: {
  entity: ComputedRef<EntityItem | null>
  mode: ComputedRef<DialogState>
  providedTemplates: ComputedRef<EntityTemplate[]>
  showReference: ComputedRef<boolean>
  permissions: Ref<AccumulatedPermission[] | null>
  activeTab: Ref<number>
  t: TranslationFunction
  te: (key: string) => boolean
}) {
  const systemTemplates = ref<EntityTemplate[]>([])
  const formConfigs = ref<SaplingFormConfigItem[]>([])
  const selectedFormConfigHandle = ref<FormConfigSelectionHandle>(null)
  const isLoadingFormConfigs = ref(false)
  const iconNames = ref<Array<{ name: string; unicode?: string }>>([])
  let iconsLoadPromise: Promise<void> | null = null

  const baseTemplates = computed(() =>
    systemTemplates.value.length > 0 ? systemTemplates.value : providedTemplates.value,
  )
  const selectedFormConfig = computed(
    () =>
      formConfigs.value.find(
        (config) =>
          typeof config.handle === 'number' && config.handle === selectedFormConfigHandle.value,
      ) ?? null,
  )
  const templates = computed(() =>
    applyFormConfigOverlay(baseTemplates.value, selectedFormConfig.value?.config ?? null),
  )
  const visibleTemplates = computed(() =>
    sortDialogTemplates(
      getEditDialogHeaders(
        templates.value,
        mode.value,
        showReference.value,
        permissions.value ?? [],
      ),
    ),
  )
  const visibleTemplateGroups = computed(() =>
    groupDialogTemplates(visibleTemplates.value, translateDialogGroupLabel),
  )
  const formConfigMenuItems = computed<FormConfigMenuItem[]>(() => {
    const selectableConfigs = formConfigs.value.filter(
      (config) => config.isActive !== false && typeof config.handle === 'number',
    )
    if (selectableConfigs.length === 0) return []

    return [
      {
        handle: null,
        title: t('formConfig.defaultView'),
        icon: 'mdi-view-dashboard-outline',
        active: selectedFormConfigHandle.value === null,
        isDefault: getDefaultFormConfigHandle(selectableConfigs) === null,
        canSetDefault: false,
      },
      ...selectableConfigs.map((config) => ({
        handle: config.handle ?? null,
        title: config.name,
        icon: config.isDefault ? 'mdi-table-star' : 'mdi-table-cog',
        active: selectedFormConfigHandle.value === config.handle,
        isDefault: getDefaultFormConfigHandle(selectableConfigs) === config.handle,
        canSetDefault: false,
      })),
    ]
  })
  const selectedFormConfigLabel = computed(() => selectedFormConfig.value?.name ?? '')

  function selectDefaultFormConfig(): void {
    selectedFormConfigHandle.value = getDefaultFormConfigHandle(formConfigs.value)
  }

  function selectFormConfig(handle: FormConfigSelectionHandle): void {
    selectedFormConfigHandle.value = handle
    activeTab.value = 0
  }

  async function loadFormConfigs(): Promise<void> {
    const entityHandle = entity.value?.handle
    if (!entityHandle) {
      formConfigs.value = []
      selectedFormConfigHandle.value = null
      return
    }

    isLoadingFormConfigs.value = true
    try {
      formConfigs.value = await ApiFormConfigService.listApplicable(entityHandle)
      selectDefaultFormConfig()
    } catch {
      formConfigs.value = []
      selectedFormConfigHandle.value = null
    } finally {
      isLoadingFormConfigs.value = false
    }
  }

  async function loadSystemTemplates(): Promise<void> {
    const entityHandle = entity.value?.handle?.trim()
    if (!entityHandle) {
      systemTemplates.value = []
      return
    }

    try {
      systemTemplates.value = await ApiTemplateService.getEntityTemplate(entityHandle)
    } catch {
      systemTemplates.value = providedTemplates.value
    }
  }

  function resetTemplateSources(): void {
    formConfigs.value = []
    systemTemplates.value = []
    selectedFormConfigHandle.value = null
  }

  function formatDialogGroupFallback(groupKey: string): string {
    const normalizedGroupKey = groupKey.trim()
    const lastSegment = normalizedGroupKey.split('.').filter(Boolean).pop() ?? normalizedGroupKey
    const spaced = lastSegment
      .replace(/^group/, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .trim()
    return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : normalizedGroupKey
  }

  function translateDialogGroupLabel(groupKey: string): string {
    const normalizedGroupKey = groupKey.trim()
    const entityHandle = entity.value?.handle?.trim() ?? ''
    const unscopedGroupKey =
      entityHandle && normalizedGroupKey.startsWith(`${entityHandle}.`)
        ? normalizedGroupKey.slice(entityHandle.length + 1)
        : normalizedGroupKey
    const candidates = entityHandle
      ? [
          normalizedGroupKey,
          `${entityHandle}.dialogGroup.${unscopedGroupKey}`,
          `${entityHandle}.${unscopedGroupKey}`,
          `${entityHandle}.dialogGroup.${normalizedGroupKey}`,
          `${entityHandle}.${normalizedGroupKey}`,
          `global.dialogGroup.${unscopedGroupKey}`,
          `global.${unscopedGroupKey}`,
        ]
      : [normalizedGroupKey, `global.dialogGroup.${unscopedGroupKey}`, `global.${unscopedGroupKey}`]
    const translationKey = candidates.find((key) => te(key))
    return translationKey ? t(translationKey) : formatDialogGroupFallback(normalizedGroupKey)
  }

  function ensureIconsLoaded(): Promise<void> | null {
    if (iconNames.value.length > 0 || iconsLoadPromise) return iconsLoadPromise
    iconsLoadPromise = import('@/constants/mdi.icons').then((module) => {
      iconNames.value = module.mdiIcons
    })
    return iconsLoadPromise
  }

  watch(
    visibleTemplates,
    (next) => {
      if (next.some((template) => template.options?.includes('isIcon'))) {
        void ensureIconsLoaded()
      }
    },
    { immediate: true },
  )

  return {
    baseTemplates,
    templates,
    visibleTemplates,
    visibleTemplateGroups,
    formConfigMenuItems,
    selectedFormConfigLabel,
    isLoadingFormConfigs,
    iconNames,
    selectDefaultFormConfig,
    selectFormConfig,
    loadFormConfigs,
    loadSystemTemplates,
    resetTemplateSources,
  }
}
