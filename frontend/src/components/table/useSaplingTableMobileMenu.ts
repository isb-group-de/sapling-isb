import { ref } from 'vue'
import type { FavoriteItem } from '@/entity/entity'
import type {
  FormConfigMenuItem,
  FormConfigSelectionHandle,
} from '@/composables/dialog/saplingDialogEdit.utils'
import type { SaplingTableAutoRefreshInterval } from '@/composables/table/useSaplingTableAutoRefresh'

type MobileMenuSection = 'main' | 'refresh' | 'favorites' | 'views'
type MobileMenuUtilityEvent = 'downloadJson' | 'downloadCsv' | 'downloadCsvTemplate' | 'importCsv'

interface SaplingTableMobileMenuCallbacks {
  downloadJson: () => void
  downloadCsv: () => void
  downloadCsvTemplate: () => void
  importCsv: () => void
  refresh: () => void
  favorite: () => void
  resetWorklist: () => void
  selectFavorite: (favorite: FavoriteItem) => void
  deleteFavorite: (favorite: FavoriteItem) => void
  selectFormConfig: (handle: FormConfigSelectionHandle) => void
  setDefaultFormConfig: (handle: number) => void
  deleteFormConfig: (item: FormConfigMenuItem) => void
  openFormConfig: () => void
  setRefreshInterval: (value: SaplingTableAutoRefreshInterval | null) => void
}

export function useSaplingTableMobileMenu(callbacks: SaplingTableMobileMenuCallbacks) {
  const mobileMenuOpen = ref(false)
  const mobileMenuSection = ref<MobileMenuSection>('main')

  function closeMobileMenu(): void {
    mobileMenuOpen.value = false
    mobileMenuSection.value = 'main'
  }

  function onMobileMenuToggle(value: boolean): void {
    if (!value) mobileMenuSection.value = 'main'
  }

  function showMobileMenuMain(): void {
    mobileMenuSection.value = 'main'
  }

  function runAndClose(action: () => void): void {
    action()
    closeMobileMenu()
  }

  return {
    mobileMenuOpen,
    mobileMenuSection,
    onMobileMenuToggle,
    showMobileMenuMain,
    emitAndCloseMobileMenu: (event: MobileMenuUtilityEvent) => runAndClose(callbacks[event]),
    refreshFromMobileMenu: () => runAndClose(callbacks.refresh),
    favoriteFromMobileMenu: () => runAndClose(callbacks.favorite),
    resetWorklistFromMobileMenu: () => runAndClose(callbacks.resetWorklist),
    selectFavoriteFromMobileMenu: (favorite: FavoriteItem) =>
      runAndClose(() => callbacks.selectFavorite(favorite)),
    deleteFavoriteFromMobileMenu: (favorite: FavoriteItem) =>
      runAndClose(() => callbacks.deleteFavorite(favorite)),
    selectFormConfigFromMobileMenu: (handle: FormConfigSelectionHandle) =>
      runAndClose(() => callbacks.selectFormConfig(handle)),
    setDefaultFormConfigFromMobileMenu: (handle: number) =>
      runAndClose(() => callbacks.setDefaultFormConfig(handle)),
    deleteFormConfigFromMobileMenu: (item: FormConfigMenuItem) =>
      runAndClose(() => callbacks.deleteFormConfig(item)),
    openFormConfigFromMobileMenu: () => runAndClose(callbacks.openFormConfig),
    setMobileRefreshInterval: (value: SaplingTableAutoRefreshInterval | null) =>
      runAndClose(() => callbacks.setRefreshInterval(value)),
  }
}
