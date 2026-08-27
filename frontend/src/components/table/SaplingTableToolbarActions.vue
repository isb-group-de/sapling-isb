<template>
  <div
    class="sapling-table-toolbar-action-group"
    :class="{ 'sapling-table-toolbar-action-group--mobile': isMobileTable }"
  >
    <v-btn-group
      v-if="isMobileTable"
      class="sapling-action-button-group sapling-table-toolbar-action-group__mobile"
      density="compact"
      rounded="pill"
      divided
    >
      <slot name="mobile-leading" />

      <v-menu
        v-model="mobileMenuOpen"
        location="bottom end"
        :close-on-content-click="false"
        @update:model-value="onMobileMenuToggle"
      >
        <template #activator="{ props: menuProps }">
          <v-btn
            data-tutorial="table-downloads"
            class="sapling-table-toolbar-action sapling-table-toolbar-action--icon-only sapling-table-toolbar-action--utility"
            color="primary"
            variant="tonal"
            icon
            v-bind="menuProps"
            :title="$t('global.more')"
            :aria-label="$t('global.more')"
          >
            <v-icon>mdi-dots-vertical</v-icon>
          </v-btn>
        </template>

        <v-list
          v-if="mobileMenuSection === 'main'"
          density="compact"
          class="glass-panel sapling-table-mobile-overflow-menu"
          nav
        >
          <v-list-item
            data-tutorial="table-refresh"
            prepend-icon="mdi-refresh"
            :title="refreshButtonLabel"
            @click="refreshFromMobileMenu"
          />
          <v-list-item
            prepend-icon="mdi-timer-outline"
            :title="$t('global.autoRefresh')"
            @click="mobileMenuSection = 'refresh'"
          >
            <template #append><v-icon>mdi-chevron-right</v-icon></template>
          </v-list-item>
          <v-list-item
            v-if="showFavorite"
            data-tutorial="table-worklists"
            prepend-icon="mdi-bookmark-outline"
            :title="$t('navigation.favorite')"
            :disabled="isFavoritesLoading"
            @click="mobileMenuSection = 'favorites'"
          >
            <template #append><v-icon>mdi-chevron-right</v-icon></template>
          </v-list-item>
          <v-list-item
            v-if="formConfigMenuItems.length > 0 || canSaveCurrentView"
            data-tutorial="table-views"
            prepend-icon="mdi-view-column-outline"
            :title="formConfigTitle"
            :disabled="isLoadingFormConfigs"
            @click="mobileMenuSection = 'views'"
          >
            <template #append><v-icon>mdi-chevron-right</v-icon></template>
          </v-list-item>
          <v-list-item
            v-if="showFormConfigButton"
            prepend-icon="mdi-table-cog"
            :title="$t('formConfig.openForEntity')"
            @click="openFormConfigFromMobileMenu"
          />
          <v-divider />
          <v-list-item
            prepend-icon="mdi-download"
            :title="$t('global.downloadJson')"
            :disabled="isDownloadingJson"
            @click="emitAndCloseMobileMenu('downloadJson')"
          />
          <v-list-item
            prepend-icon="mdi-file-delimited-outline"
            :title="$t('global.downloadCsv')"
            :disabled="isDownloadingJson"
            @click="emitAndCloseMobileMenu('downloadCsv')"
          />
          <v-list-item
            prepend-icon="mdi-table-arrow-down"
            :title="$t('global.downloadCsvTemplate')"
            @click="emitAndCloseMobileMenu('downloadCsvTemplate')"
          />
          <v-list-item
            v-if="showImport"
            prepend-icon="mdi-file-import-outline"
            :title="$t('global.importCsv')"
            :disabled="isImportingCsv"
            @click="emitAndCloseMobileMenu('importCsv')"
          />
        </v-list>

        <v-list
          v-else-if="mobileMenuSection === 'refresh'"
          density="compact"
          class="glass-panel sapling-table-mobile-overflow-menu"
          nav
        >
          <v-list-item
            prepend-icon="mdi-arrow-left"
            :title="$t('global.back')"
            @click="showMobileMenuMain"
          />
          <v-divider />
          <v-list-subheader>{{ $t('global.autoRefresh') }}</v-list-subheader>
          <v-list-item
            v-if="secondsUntilRefresh !== null"
            prepend-icon="mdi-clock-outline"
            :title="$t('global.nextRefreshInSeconds', { count: secondsUntilRefresh })"
            :ripple="false"
          />
          <v-list-item
            prepend-icon="mdi-close-circle-outline"
            :title="$t('global.autoRefreshOff')"
            :active="autoRefreshIntervalMinutes === null"
            @click="setMobileRefreshInterval(null)"
          >
            <template #append
              ><v-icon v-if="autoRefreshIntervalMinutes === null" size="small"
                >mdi-check</v-icon
              ></template
            >
          </v-list-item>
          <v-list-item
            v-for="intervalMinutes in refreshIntervals"
            :key="intervalMinutes"
            prepend-icon="mdi-timer-outline"
            :title="getRefreshIntervalLabel(intervalMinutes)"
            :active="autoRefreshIntervalMinutes === intervalMinutes"
            @click="setMobileRefreshInterval(intervalMinutes)"
          >
            <template #append
              ><v-icon v-if="autoRefreshIntervalMinutes === intervalMinutes" size="small"
                >mdi-check</v-icon
              ></template
            >
          </v-list-item>
        </v-list>

        <v-list
          v-else-if="mobileMenuSection === 'favorites'"
          density="compact"
          class="glass-panel sapling-table-mobile-overflow-menu"
          nav
        >
          <v-list-item
            prepend-icon="mdi-arrow-left"
            :title="$t('global.back')"
            @click="showMobileMenuMain"
          />
          <v-divider />
          <v-list-item
            prepend-icon="mdi-bookmark-plus"
            :title="$t('global.saveAsFavorite')"
            @click="favoriteFromMobileMenu"
          />
          <v-list-item
            v-for="favoriteItem in favoriteItems"
            :key="favoriteItem.handle"
            :active="favoriteItem.handle === activeFavoriteHandle"
            @click="selectFavoriteFromMobileMenu(favoriteItem)"
          >
            <template #prepend>
              <v-icon>{{
                favoriteItem.handle === activeFavoriteHandle
                  ? 'mdi-bookmark'
                  : 'mdi-bookmark-outline'
              }}</v-icon>
            </template>
            <v-list-item-title>{{ favoriteItem.title }}</v-list-item-title>
          </v-list-item>
        </v-list>

        <v-list v-else density="compact" class="glass-panel sapling-table-mobile-overflow-menu" nav>
          <v-list-item
            prepend-icon="mdi-arrow-left"
            :title="$t('global.back')"
            @click="showMobileMenuMain"
          />
          <v-divider />
          <v-list-item
            v-for="item in formConfigMenuItems"
            :key="item.handle ?? 'default'"
            :active="item.active"
            @click="selectFormConfigFromMobileMenu(item.handle)"
          >
            <template #prepend
              ><v-icon>{{ item.active ? 'mdi-check-circle-outline' : item.icon }}</v-icon></template
            >
            <v-list-item-title>{{ item.title }}</v-list-item-title>
            <template #append>
              <v-btn
                v-if="item.isDefault || item.canSetDefault"
                :icon="item.isDefault ? 'mdi-star' : 'mdi-star-outline'"
                :color="item.isDefault ? 'warning' : undefined"
                size="x-small"
                variant="text"
                :disabled="item.isDefault || !item.canSetDefault"
                :title="
                  item.isDefault
                    ? $t('formConfig.openedByDefaultView')
                    : $t('formConfig.setAsPersonalDefaultView')
                "
                @click.stop="setDefaultFormConfigFromMobileMenu(Number(item.handle))"
              />
            </template>
          </v-list-item>
          <v-divider />
          <v-list-item
            :prepend-icon="isColumnOrderEditing ? 'mdi-check' : 'mdi-table-edit'"
            :title="
              isColumnOrderEditing
                ? $t('formConfig.finishEditingView')
                : $t('formConfig.editCurrentView')
            "
            @click="toggleColumnOrderFromMobileMenu"
          />
          <v-list-item
            v-if="isColumnOrderEditing"
            prepend-icon="mdi-table-column-plus-after"
            :active="isColumnChooserOpen"
            :title="$t('formConfig.columnSelection')"
            @click="emitAndCloseMobileMenu('toggleColumnChooser')"
          />
          <v-list-item
            v-if="canSaveCurrentView && isColumnOrderEditing"
            prepend-icon="mdi-content-save-outline"
            :title="$t('formConfig.saveCurrentView')"
            @click="emitAndCloseMobileMenu('saveCurrentView')"
          />
          <v-list-item
            v-if="hasTemporaryColumnOrder && isColumnOrderEditing"
            prepend-icon="mdi-restore"
            :title="$t('formConfig.resetTemporaryColumnOrder')"
            @click="emitAndCloseMobileMenu('resetTemporaryColumnOrder')"
          />
        </v-list>
      </v-menu>

      <v-btn
        v-if="showAdd"
        data-tutorial="table-add"
        class="sapling-table-toolbar-action sapling-table-toolbar-action--icon-only sapling-table-toolbar-action--add"
        color="primary"
        variant="flat"
        icon
        :title="$t('global.add')"
        :aria-label="$t('global.add')"
        @click="emit('add')"
      >
        <v-icon>mdi-plus</v-icon>
      </v-btn>
    </v-btn-group>

    <template v-else>
      <v-btn-group
        class="sapling-action-button-group sapling-table-toolbar-utilities sapling-table-toolbar-utilities--desktop"
        density="comfortable"
        rounded="pill"
        divided
      >
        <slot name="leading" />

        <SaplingTableRefreshMenu
          data-tutorial="table-refresh"
          :model-value="autoRefreshIntervalMinutes"
          :refresh-button-label="refreshButtonLabel"
          :seconds-until-refresh="secondsUntilRefresh"
          @refresh="emit('refresh')"
          @update:model-value="emit('update:autoRefreshIntervalMinutes', $event)"
        />
        <v-menu v-if="showFavorite" location="bottom end">
          <template #activator="{ props: favoriteMenuProps }">
            <v-btn
              data-tutorial="table-worklists"
              class="sapling-table-toolbar-action sapling-table-toolbar-action--icon-only sapling-table-toolbar-action--utility"
              color="primary"
              variant="tonal"
              icon
              :loading="isFavoritesLoading"
              v-bind="favoriteMenuProps"
              :title="$t('navigation.favorite')"
              :aria-label="$t('navigation.favorite')"
            >
              <v-icon>mdi-bookmark-outline</v-icon>
            </v-btn>
          </template>

          <v-list density="compact" class="glass-panel" nav>
            <v-list-item
              prepend-icon="mdi-bookmark-plus"
              :title="$t('global.saveAsFavorite')"
              @click="emit('favorite')"
            />

            <template v-if="favoriteItems.length > 0">
              <v-divider />
              <v-list-subheader>{{ $t('navigation.favorite') }}</v-list-subheader>

              <v-list-item
                v-for="favoriteItem in favoriteItems"
                :key="favoriteItem.handle"
                :active="favoriteItem.handle === activeFavoriteHandle"
                @click="emit('selectFavorite', favoriteItem)"
              >
                <template #prepend>
                  <v-icon>{{
                    favoriteItem.handle === activeFavoriteHandle
                      ? 'mdi-bookmark'
                      : 'mdi-bookmark-outline'
                  }}</v-icon>
                </template>
                <v-list-item-title>{{ favoriteItem.title }}</v-list-item-title>
              </v-list-item>
            </template>
          </v-list>
        </v-menu>
        <v-menu v-if="formConfigMenuItems.length > 0 || canSaveCurrentView" location="bottom end">
          <template #activator="{ props: formConfigMenuProps }">
            <v-btn
              data-tutorial="table-views"
              class="sapling-table-toolbar-action sapling-table-toolbar-action--icon-only sapling-table-toolbar-action--utility"
              color="primary"
              variant="tonal"
              icon
              :loading="isLoadingFormConfigs"
              v-bind="formConfigMenuProps"
              :title="formConfigTitle"
              :aria-label="formConfigTitle"
            >
              <v-icon>mdi-view-column-outline</v-icon>
            </v-btn>
          </template>

          <v-list density="compact" class="glass-panel" nav>
            <v-list-subheader>{{ $t('formConfig.currentView') }}</v-list-subheader>
            <v-list-item
              v-for="item in formConfigMenuItems"
              :key="item.handle ?? 'default'"
              :active="item.active"
              @click="emit('selectFormConfig', item.handle)"
            >
              <template #prepend>
                <v-icon>{{ item.active ? 'mdi-check-circle-outline' : item.icon }}</v-icon>
              </template>
              <v-list-item-title>{{ item.title }}</v-list-item-title>
              <template #append>
                <v-btn
                  v-if="item.isDefault || item.canSetDefault"
                  :icon="item.isDefault ? 'mdi-star' : 'mdi-star-outline'"
                  :color="item.isDefault ? 'warning' : undefined"
                  size="x-small"
                  variant="text"
                  :disabled="item.isDefault || !item.canSetDefault"
                  :title="
                    item.isDefault
                      ? $t('formConfig.openedByDefaultView')
                      : $t('formConfig.setAsPersonalDefaultView')
                  "
                  :aria-label="
                    item.isDefault
                      ? `${item.title}: ${$t('formConfig.openedByDefaultView')}`
                      : `${item.title}: ${$t('formConfig.setAsPersonalDefaultView')}`
                  "
                  @click.stop="emit('setDefaultFormConfig', Number(item.handle))"
                />
              </template>
            </v-list-item>
            <v-divider />
            <v-list-item
              v-if="!isColumnOrderEditing"
              prepend-icon="mdi-table-edit"
              :title="$t('formConfig.editCurrentView')"
              @click="emit('beginColumnOrderEdit')"
            />
            <v-list-item
              v-else
              prepend-icon="mdi-check"
              :title="$t('formConfig.finishEditingView')"
              @click="emit('finishColumnOrderEdit')"
            />
            <v-list-item
              v-if="isColumnOrderEditing"
              prepend-icon="mdi-table-column-plus-after"
              :active="isColumnChooserOpen"
              :title="$t('formConfig.columnSelection')"
              @click="emit('toggleColumnChooser')"
            />
            <v-list-item
              v-if="canSaveCurrentView && isColumnOrderEditing"
              prepend-icon="mdi-content-save-outline"
              :title="$t('formConfig.saveCurrentView')"
              @click="emit('saveCurrentView')"
            />
            <v-list-item
              v-if="hasTemporaryColumnOrder && isColumnOrderEditing"
              prepend-icon="mdi-restore"
              :title="$t('formConfig.resetTemporaryColumnOrder')"
              @click="emit('resetTemporaryColumnOrder')"
            />
          </v-list>
        </v-menu>
        <v-menu location="bottom end">
          <template #activator="{ props: toolsMenuProps }">
            <v-btn
              data-tutorial="table-downloads"
              class="sapling-table-toolbar-action sapling-table-toolbar-action--icon-only sapling-table-toolbar-action--utility"
              color="primary"
              variant="tonal"
              icon
              v-bind="toolsMenuProps"
              :title="$t('global.more')"
              :aria-label="$t('global.more')"
              :loading="isDownloadingJson || isImportingCsv"
              :disabled="isDownloadingJson || isImportingCsv"
            >
              <v-icon>mdi-dots-horizontal</v-icon>
            </v-btn>
          </template>

          <v-list density="compact" class="glass-panel" nav>
            <v-list-item
              prepend-icon="mdi-code-json"
              :title="$t('global.downloadJson')"
              @click="emit('downloadJson')"
            />
            <v-list-item
              prepend-icon="mdi-file-delimited-outline"
              :title="$t('global.downloadCsv')"
              @click="emit('downloadCsv')"
            />
            <v-list-item
              prepend-icon="mdi-table-arrow-down"
              :title="$t('global.downloadCsvTemplate')"
              @click="emit('downloadCsvTemplate')"
            />
            <v-list-item
              v-if="showImport"
              prepend-icon="mdi-file-import-outline"
              :title="$t('global.importCsv')"
              @click="emit('importCsv')"
            />
          </v-list>
        </v-menu>

        <v-btn
          v-if="showAdd"
          data-tutorial="table-add"
          class="sapling-table-toolbar-action sapling-table-toolbar-action--add"
          color="primary"
          variant="flat"
          prepend-icon="mdi-plus"
          :title="$t('global.add')"
          :aria-label="$t('global.add')"
          @click="emit('add')"
        >
          {{ $t('global.add') }}
        </v-btn>
      </v-btn-group>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FavoriteItem } from '@/entity/entity'
import {
  SAPLING_TABLE_AUTO_REFRESH_INTERVALS,
  type SaplingTableAutoRefreshInterval,
} from '@/composables/table/useSaplingTableAutoRefresh'
import type {
  FormConfigMenuItem,
  FormConfigSelectionHandle,
} from '@/composables/dialog/saplingDialogEdit.utils'
import SaplingTableRefreshMenu from './SaplingTableRefreshMenu.vue'

const props = defineProps<{
  isMobileTable: boolean
  isDownloadingJson: boolean
  isImportingCsv: boolean
  refreshButtonLabel: string
  autoRefreshIntervalMinutes: SaplingTableAutoRefreshInterval | null
  secondsUntilRefresh: number | null
  showFavorite: boolean
  showImport: boolean
  showAdd: boolean
  favoriteItems: FavoriteItem[]
  isFavoritesLoading: boolean
  activeFavoriteHandle?: number | null
  formConfigMenuItems: FormConfigMenuItem[]
  selectedFormConfigLabel?: string
  isLoadingFormConfigs: boolean
  canSaveCurrentView: boolean
  showFormConfigButton: boolean
  hasTemporaryColumnOrder: boolean
  isColumnOrderEditing: boolean
  isColumnChooserOpen: boolean
}>()

const emit = defineEmits<{
  downloadJson: []
  downloadCsv: []
  downloadCsvTemplate: []
  importCsv: []
  refresh: []
  'update:autoRefreshIntervalMinutes': [value: SaplingTableAutoRefreshInterval | null]
  favorite: []
  selectFavorite: [favorite: FavoriteItem]
  selectFormConfig: [handle: FormConfigSelectionHandle]
  saveCurrentView: []
  resetTemporaryColumnOrder: []
  beginColumnOrderEdit: []
  finishColumnOrderEdit: []
  toggleColumnChooser: []
  setDefaultFormConfig: [handle: number]
  openFormConfig: []
  add: []
}>()

const { t } = useI18n()
const mobileMenuOpen = ref(false)
const mobileMenuSection = ref<'main' | 'refresh' | 'favorites' | 'views'>('main')
const refreshIntervals = SAPLING_TABLE_AUTO_REFRESH_INTERVALS
const formConfigTitle = computed(() =>
  props.selectedFormConfigLabel?.trim()
    ? `${t('formConfig.currentView')}: ${props.selectedFormConfigLabel}`
    : t('formConfig.defaultView'),
)

type MobileMenuEvent =
  | 'downloadJson'
  | 'downloadCsv'
  | 'downloadCsvTemplate'
  | 'importCsv'
  | 'toggleColumnChooser'
  | 'saveCurrentView'
  | 'resetTemporaryColumnOrder'

function closeMobileMenu(): void {
  mobileMenuOpen.value = false
  mobileMenuSection.value = 'main'
}

function onMobileMenuToggle(value: boolean): void {
  if (!value) {
    mobileMenuSection.value = 'main'
  }
}

function showMobileMenuMain(): void {
  mobileMenuSection.value = 'main'
}

function emitAndCloseMobileMenu(event: MobileMenuEvent): void {
  switch (event) {
    case 'downloadJson':
      emit('downloadJson')
      break
    case 'downloadCsv':
      emit('downloadCsv')
      break
    case 'downloadCsvTemplate':
      emit('downloadCsvTemplate')
      break
    case 'importCsv':
      emit('importCsv')
      break
    case 'toggleColumnChooser':
      emit('toggleColumnChooser')
      break
    case 'saveCurrentView':
      emit('saveCurrentView')
      break
    case 'resetTemporaryColumnOrder':
      emit('resetTemporaryColumnOrder')
      break
  }
  closeMobileMenu()
}

function refreshFromMobileMenu(): void {
  emit('refresh')
  closeMobileMenu()
}

function favoriteFromMobileMenu(): void {
  emit('favorite')
  closeMobileMenu()
}

function selectFavoriteFromMobileMenu(favorite: FavoriteItem): void {
  emit('selectFavorite', favorite)
  closeMobileMenu()
}

function selectFormConfigFromMobileMenu(handle: FormConfigSelectionHandle): void {
  emit('selectFormConfig', handle)
  closeMobileMenu()
}

function setDefaultFormConfigFromMobileMenu(handle: number): void {
  emit('setDefaultFormConfig', handle)
  closeMobileMenu()
}

function toggleColumnOrderFromMobileMenu(): void {
  if (props.isColumnOrderEditing) {
    emit('finishColumnOrderEdit')
  } else {
    emit('beginColumnOrderEdit')
  }
  closeMobileMenu()
}

function openFormConfigFromMobileMenu(): void {
  emit('openFormConfig')
  closeMobileMenu()
}

function setMobileRefreshInterval(value: SaplingTableAutoRefreshInterval | null): void {
  emit('update:autoRefreshIntervalMinutes', value)
  closeMobileMenu()
}

function getRefreshIntervalLabel(intervalMinutes: SaplingTableAutoRefreshInterval): string {
  return intervalMinutes === 1
    ? t('global.refreshEveryMinute')
    : t('global.refreshEveryMinutes', { count: intervalMinutes })
}
</script>
