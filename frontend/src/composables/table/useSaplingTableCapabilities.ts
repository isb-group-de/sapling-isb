import { computed, onMounted, provide, type ComputedRef, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormConfigMenuItem } from '@/composables/dialog/saplingDialogEdit.utils'
import type { EntityItem } from '@/entity/entity'
import type { AccumulatedPermission } from '@/entity/structure'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import { saplingTableDisplayContextKey } from '@/components/table/saplingTableDisplayContext'

interface SaplingTableCapabilityProps {
  entityHandle: string
  entity: EntityItem | null
  entityPermission: AccumulatedPermission | null
  showFavorite?: boolean
  showAdd?: boolean
  showImport?: boolean
  showSearch?: boolean
  showFormConfig?: boolean
  showToolbar?: boolean
  showSelectionToolbar?: boolean
  showSidePanelToggle?: boolean
  sidePanelVisible?: boolean
  sidePanelToggleLabel?: string
  sidePanelToggleIcon?: string
  formConfigMenuItems?: FormConfigMenuItem[]
}

export function useSaplingTableCapabilities(
  props: SaplingTableCapabilityProps,
  orderedColumnKeys: Ref<string[]>,
  isMobileTable: ComputedRef<boolean>,
) {
  const { t } = useI18n()
  const currentPersonStore = useCurrentPersonStore()
  const { isLoading: isHeaderTranslationLoading } = useTranslationLoader(props.entityHandle)
  const refreshButtonLabel = computed(() => t('global.refresh'))
  const showFavoriteButton = computed(() => props.showFavorite !== false)
  const showAddButton = computed(
    () =>
      props.showAdd !== false &&
      Boolean(props.entity?.canInsert) &&
      Boolean(props.entityPermission?.allowInsert),
  )
  const showImportButton = computed(
    () =>
      props.showImport !== false &&
      currentPersonStore.isAdministrator &&
      (Boolean(props.entityPermission?.allowInsert) ||
        Boolean(props.entityPermission?.allowUpdate)),
  )
  const showFormConfigButton = computed(
    () =>
      props.showFormConfig !== false &&
      currentPersonStore.isAdministrator &&
      Boolean(props.entityHandle),
  )
  const showSearchField = computed(() => props.showSearch !== false)
  const showToolbar = computed(() => props.showToolbar !== false)
  const showSelectionToolbar = computed(() => props.showSelectionToolbar !== false)
  const showSidePanelToggleButton = computed(() => props.showSidePanelToggle === true)
  const canSaveCurrentView = computed(
    () =>
      props.formConfigMenuItems !== undefined &&
      Boolean(props.entityHandle) &&
      orderedColumnKeys.value.length > 0,
  )
  const sidePanelVisible = computed(() => props.sidePanelVisible === true)
  const sidePanelToggleLabel = computed(
    () => props.sidePanelToggleLabel?.trim() || t('global.filter'),
  )
  const sidePanelToggleIcon = computed(
    () => props.sidePanelToggleIcon?.trim() || 'mdi-account-group-outline',
  )

  provide(saplingTableDisplayContextKey, { isMobileTable })

  onMounted(() => {
    void currentPersonStore.fetchCurrentPerson()
  })

  return {
    isHeaderTranslationLoading,
    refreshButtonLabel,
    showFavoriteButton,
    showAddButton,
    showImportButton,
    showFormConfigButton,
    showSearchField,
    showToolbar,
    showSelectionToolbar,
    showSidePanelToggleButton,
    canSaveCurrentView,
    sidePanelVisible,
    sidePanelToggleLabel,
    sidePanelToggleIcon,
  }
}
