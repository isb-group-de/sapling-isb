<template>
  <section
    data-tutorial="calendar-page"
    v-bind="attrs"
    class="sapling-page-shell sapling-page-shell--fill sapling-page-shell--uniform-inset sapling-dashboard-page sapling-dashboard-page--flow-lg sapling-event-page"
  >
    <template v-if="isLoading">
      <div class="sapling-page-skeleton sapling-event-skeleton">
        <section
          class="sapling-page-workspace sapling-page-workspace--main-context sapling-page-workspace--collapse-lg sapling-event-skeleton__workspace"
        >
          <SaplingSurface
            :as="VSkeletonLoader"
            class="sapling-event-skeleton__calendar"
            type="table-heading, table-thead, table-row-divider@8"
          />
          <div class="sapling-page-skeleton-grid sapling-event-skeleton__context">
            <SaplingSurface
              :as="VSkeletonLoader"
              class="sapling-event-skeleton__panel"
              type="list-item-three-line@3"
            />
            <SaplingSurface
              :as="VSkeletonLoader"
              class="sapling-event-skeleton__panel"
              type="list-item-three-line@4"
            />
            <SaplingSurface
              :as="VSkeletonLoader"
              class="sapling-event-skeleton__panel"
              type="article"
            />
          </div>
        </section>
      </div>
    </template>

    <template v-else>
      <section
        class="sapling-page-workspace sapling-page-workspace--main-context sapling-page-workspace--collapse-lg sapling-event-workspace"
      >
        <SaplingSurface
          data-tutorial="calendar-main"
          class="sapling-workspace-panel sapling-page-panel sapling-event-workspace__main"
        >
          <SaplingEventToolbar
            v-model:calendar-type="calendarType"
            v-model:calendar-view-mode="calendarViewMode"
            v-model:calendar-mode="calendarMode"
            v-model:event-overlap-mode="eventOverlapMode"
            v-model:linked-scrolling="linkedScrolling"
            v-model:time-grid-scale="timeGridScale"
            v-model:time-range-mode="timeRangeMode"
            :is-narrow-screen="isNarrowScreen"
            :is-refreshing="isRefreshingCalendar"
            :is-syncing-external-calendar="isSyncingExternalCalendar"
            :calendar-sync-provider="calendarSyncProvider"
            :calendar-type-options="calendarTypeOptions"
            :model-value="value"
            :period-label="currentMonthLabel"
            :period-range-label="currentDateRangeLabel"
            :period-icon="entityEvent?.icon || 'mdi-calendar-month-outline'"
            @previous="goToPrevious"
            @today="goToToday"
            @next="goToNext"
            @refresh="refreshCalendar"
            @select-date="goToDate"
            @sync-calendar="syncExternalCalendar"
          />

          <div
            ref="calendarScrollContainer"
            data-tutorial="calendar-grid"
            class="sapling-calendar-frame sapling-event-calendar-body"
          >
            <SaplingEventCalendarWorkspace
              v-model="value"
              :calendar-view-mode="calendarViewMode"
              :linked-scrolling="linkedScrolling"
              :event-overlap-mode="eventOverlapMode"
              :interval-height="calendarIntervalHeight"
              :first-time="calendarTimeGrid.firstTime"
              :interval-count="calendarTimeGrid.intervalCount"
              :events="events"
              :calendar-display-type="calendarDisplayType"
              :calendar-weekdays="calendarWeekdays"
              :is-drag-active="isCalendarDragActive"
              :is-tooltip-blocked="isCalendarTooltipBlocked"
              :work-hours="workHours"
              :show-work-hour-background="showWorkHourBackground"
              :selected-peoples="selectedPeoples"
              :side-by-side-grid-style="sideBySideGridStyle"
              :get-work-hour-style="getWorkHourStyle"
              :get-event-color="getEventColor"
              :get-event-participants="getCalendarEventParticipants"
              :now-y="nowY"
              :get-events="getEvents"
              :open-event="openEventEditor"
              :open-context-menu="openEventContextMenu"
              :start-drag="startDrag"
              :start-time="startTime"
              :cancel-drag="cancelDrag"
              :mouse-move="mouseMove"
              :end-drag="endDrag"
              :extend-bottom="extendBottom"
              :get-person-name="getPersonName"
              :get-person-work-hours="getPersonWorkHours"
              :get-side-by-side-events="getSideBySideEvents"
            />
          </div>
        </SaplingSurface>

        <SaplingEventContextPanels
          data-tutorial="calendar-context"
          :is-mobile-filter-layout="isMobileContextLayout"
          :upcoming-events="upcomingEvents"
          :chip-filters="chipFilters"
          :selected-chip-filters="selectedChipFilters"
          :selected-peoples="selectedPeoples"
          :selected-people-preview="selectedPeoplePreview"
          :selected-people-overflow-count="selectedPeopleOverflowCount"
          @update-selected-chip-filters="onSelectedChipFiltersUpdate"
          @update-selected-peoples="onSelectedPeoplesUpdate"
          @open-filter="toggleContextDialog"
          @open-event="openEventEditor"
        />
      </section>
      <SaplingCalendarTutorial />
    </template>
  </section>

  <SaplingDialog
    v-if="isMobileContextLayout"
    v-model="mobileContextDialogVisible"
    class="sapling-event-context-dialog"
    size="md"
    scrollable
  >
    <SaplingDialogCard
      class="sapling-event-context-dialog__surface"
      :tilt="false"
      :close="() => (mobileContextDialogVisible = false)"
    >
      <SaplingWorkFilterPanel
        class="sapling-event-context-dialog__panel"
        :show-close-action="true"
        :close-action-label="contextDialogCloseLabel"
        :chip-filters="chipFilters"
        :selected-chip-filters="selectedChipFilters"
        :selected-peoples="selectedPeoples"
        @close="mobileContextDialogVisible = false"
        @update:selected-chip-filters="onSelectedChipFiltersUpdate"
        @update:selected-peoples="onSelectedPeoplesUpdate"
      />
    </SaplingDialogCard>
  </SaplingDialog>

  <SaplingDialogEdit
    v-if="showEditDialog && entityEvent && templates.length > 0 && editEvent"
    :model-value="showEditDialog"
    :mode="editEvent?.event?.handle || isDetachingOccurrence ? 'edit' : 'create'"
    :item="editEvent.event"
    :templates="templates"
    :entity="entityEvent"
    :showReference="true"
    :force-dirty="forceEditDialogDirtyFields.length > 0 || editEvent.event?.handle == null"
    :force-dirty-fields="forceEditDialogDirtyFields"
    @update:modelValue="(val) => (showEditDialog = val)"
    @update:mode="onEditDialogModeUpdate"
    @update:item="onEditDialogItemUpdate"
    @save="onEditDialogSave"
    @cancel="onEditDialogCancel"
  />

  <SaplingDialogConfirm
    :model-value="recurrenceEditScopeDialog.visible"
    :eyebrow="calendarLabel('recurrenceEditScope', 'Wiederkehrender Termin', 'Recurring event')"
    :title="
      calendarLabel(
        'recurrenceEditScopeQuestion',
        'Was möchten Sie bearbeiten?',
        'What would you like to edit?',
      )
    "
    :subtitle="
      calendarLabel(
        'recurrenceEditScopeHint',
        'Die Änderung kann nur für diesen Termin oder für die gesamte Serie gelten.',
        'Apply the change to this occurrence only or to the entire series.',
      )
    "
    :close-disabled="recurrenceEditScopeDialog.isLoading"
    persistent
    @update:model-value="(value) => !value && closeRecurrenceEditScopeDialog()"
    @escape="closeRecurrenceEditScopeDialog"
  >
    <template #actions>
      <SaplingActionBar>
        <template #leading>
          <v-btn
            variant="text"
            prepend-icon="mdi-close"
            :disabled="recurrenceEditScopeDialog.isLoading"
            @click="closeRecurrenceEditScopeDialog"
          >
            {{ $t('global.cancel') }}
          </v-btn>
        </template>
        <template #trailing>
          <v-btn
            variant="tonal"
            prepend-icon="mdi-calendar-edit"
            :disabled="recurrenceEditScopeDialog.isLoading"
            @click="chooseRecurrenceEditOccurrence"
          >
            {{ calendarLabel('editOccurrence', 'Diesen Termin', 'This event') }}
          </v-btn>
          <v-btn
            color="primary"
            prepend-icon="mdi-calendar-sync"
            :loading="recurrenceEditScopeDialog.isLoading"
            @click="chooseRecurrenceEditSeries"
          >
            {{ calendarLabel('editSeries', 'Gesamte Serie', 'Entire series') }}
          </v-btn>
        </template>
      </SaplingActionBar>
    </template>
  </SaplingDialogConfirm>

  <SaplingDialogUpdateConflict
    :model-value="updateConflictDialog.visible"
    :conflict="updateConflictDialog.conflict"
    entity-handle="event"
    :entity-templates="templates"
    :is-saving="updateConflictDialog.isSaving"
    @update:model-value="handleUpdateConflictVisibility"
    @merge="mergeUpdateConflict"
    @reload="reloadUpdateConflictRecord"
    @open-change-log="openUpdateConflictChangeLog"
  />

  <SaplingDialogConfirm
    :model-value="materializeRecurrenceDialog.visible"
    :eyebrow="calendarLabel('materializeRecurrence', 'Wiederholung auflösen', 'Resolve recurrence')"
    :title="calendarLabel('materializeRecurrence', 'Wiederholung auflösen', 'Resolve recurrence')"
    :subtitle="
      calendarLabel(
        'materializeRecurrenceQuestion',
        'Soll diese Terminserie in einzelne Termine aufgelöst werden?',
        'Do you want to resolve this recurring series into standalone events?',
      )
    "
    :close-disabled="materializeRecurrenceDialog.isSubmitting"
    persistent
    @update:model-value="(value) => !value && closeMaterializeRecurrenceDialog()"
    @enter="confirmMaterializeRecurrence"
    @escape="closeMaterializeRecurrenceDialog"
  >
    <template #body>
      <p>
        {{
          calendarLabel(
            'materializeRecurrenceHint',
            'Jedes Vorkommen wird als eigener Termin gespeichert. Die Termine können danach unabhängig bearbeitet und abgeschlossen werden. Dieser Vorgang lässt sich nicht automatisch rückgängig machen.',
            'Each occurrence will be saved as a standalone event. The events can then be edited and completed independently. This action cannot be undone automatically.',
          )
        }}
      </p>
    </template>
    <template #actions>
      <SaplingActionBar>
        <template #leading>
          <v-btn
            variant="text"
            prepend-icon="mdi-close"
            :disabled="materializeRecurrenceDialog.isSubmitting"
            @click="closeMaterializeRecurrenceDialog"
          >
            {{ $t('global.cancel') }}
          </v-btn>
        </template>
        <template #trailing>
          <v-btn
            color="warning"
            append-icon="mdi-calendar-remove-outline"
            :loading="materializeRecurrenceDialog.isSubmitting"
            @click="confirmMaterializeRecurrence"
          >
            {{ calendarLabel('materializeRecurrenceConfirm', 'Serie auflösen', 'Resolve series') }}
          </v-btn>
        </template>
      </SaplingActionBar>
    </template>
  </SaplingDialogConfirm>

  <v-menu
    v-model="eventContextMenu.visible"
    :target="eventContextMenuTarget"
    absolute
    content-class="sapling-context-menu__content"
    transition="slide-y-transition"
  >
    <SaplingSurface
      :as="SaplingRecordActionMenuList"
      density="compact"
      elevation="8"
      min-width="200"
      :menu-items="eventContextMenuItems"
      :show-edit="false"
      @select="handleEventContextMenuAction"
      @close="closeEventContextMenu"
    />
  </v-menu>

  <SaplingTableRowUpload
    v-if="showUploadDialog"
    :show="showUploadDialog"
    :item="uploadDialogItem"
    entityHandle="event"
    @close="closeUploadDialog"
    @uploaded="closeUploadDialog"
  />

  <SaplingTableRowInformation
    v-if="showInformationDialog"
    :show="showInformationDialog"
    :item="informationDialogItem"
    entityHandle="event"
    @close="closeInformationDialog"
    @saved="closeInformationDialog"
  />
</template>

<script lang="ts" setup>
import { computed, ref, useAttrs, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
import { VSkeletonLoader } from 'vuetify/components'
import { useSaplingEvent } from '@/composables/event/useSaplingEvent'
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import SaplingSurface from '@/components/common/SaplingSurface.vue'
import SaplingCalendarTutorial from '@/components/system/tutorial/SaplingCalendarTutorial.vue'
import SaplingEventCalendarWorkspace from '@/components/event/SaplingEventCalendarWorkspace.vue'
import SaplingEventContextPanels from '@/components/event/SaplingEventContextPanels.vue'
import SaplingEventToolbar from '@/components/event/SaplingEventToolbar.vue'
import SaplingWorkFilterPanel from '@/components/filter/SaplingWorkFilterPanel.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingRecordActionMenuList from '@/components/common/SaplingRecordActionMenuList.vue'
import SaplingTableRowInformation from '@/components/table/SaplingTableRowInformation.vue'
import SaplingTableRowUpload from '@/components/table/SaplingTableRowUpload.vue'
import SaplingDialogEdit from '../dialog/SaplingDialogEdit.vue'
import SaplingDialogUpdateConflict from '@/components/dialog/SaplingDialogUpdateConflict.vue'
import SaplingDialogConfirm from '@/components/dialog/SaplingDialogConfirm.vue'
import SaplingActionBar from '@/components/actions/SaplingActionBar.vue'

defineOptions({
  inheritAttrs: false,
})

const EVENT_CONTEXT_DIALOG_BREAKPOINT = 1080

const attrs = useAttrs()
const { t, te, locale } = useI18n()
const { width } = useDisplay()

const isMobileContextLayout = computed(() => width.value <= EVENT_CONTEXT_DIALOG_BREAKPOINT)
const mobileContextDialogVisible = ref(false)

const contextDialogCloseLabel = computed(() => t('global.close'))

watch(isMobileContextLayout, (isMobile) => {
  if (!isMobile) {
    mobileContextDialogVisible.value = false
  }
})

function toggleContextDialog() {
  mobileContextDialogVisible.value = !mobileContextDialogVisible.value
}

function calendarLabel(key: string, germanFallback: string, englishFallback: string): string {
  const translationKey = `calendar.${key}`
  if (te(translationKey)) {
    return t(translationKey)
  }

  return String(locale.value).toLowerCase().startsWith('de') ? germanFallback : englishFallback
}

const {
  chooseRecurrenceEditOccurrence,
  chooseRecurrenceEditSeries,
  closeRecurrenceEditScopeDialog,
  forceEditDialogDirtyFields,
  calendarDisplayType,
  calendarIntervalHeight,
  calendarTimeGrid,
  calendarType,
  calendarTypeOptions,
  calendarMode,
  eventOverlapMode,
  calendarSyncProvider,
  currentDateRangeLabel,
  calendarViewMode,
  calendarWeekdays,
  currentMonthLabel,
  eventContextMenu,
  eventContextMenuItems,
  eventContextMenuTarget,
  entityEvent,
  chipFilters,
  events,
  getCalendarEventParticipants,
  getEventColor,
  getEvents,
  getPersonName,
  getPersonWorkHours,
  getSideBySideEvents,
  getWorkHourStyle,
  goToDate,
  goToNext,
  goToPrevious,
  goToToday,
  handleUpdateConflictVisibility,
  isCalendarDragActive,
  isLoading,
  isRefreshingCalendar,
  isSyncingExternalCalendar,
  isNarrowScreen,
  linkedScrolling,
  timeGridScale,
  timeRangeMode,
  mergeUpdateConflict,
  nowY,
  openEventContextMenu,
  handleEventContextMenuAction,
  onEditDialogCancel,
  onEditDialogItemUpdate,
  onEditDialogModeUpdate,
  onEditDialogSave,
  openUpdateConflictChangeLog,
  openEventEditor,
  onSelectedChipFiltersUpdate,
  onSelectedPeoplesUpdate,
  reloadUpdateConflictRecord,
  refreshCalendar,
  selectedPeoples,
  selectedChipFilters,
  selectedPeopleOverflowCount,
  selectedPeoplePreview,
  syncExternalCalendar,
  closeEventContextMenu,
  closeInformationDialog,
  closeMaterializeRecurrenceDialog,
  closeUploadDialog,
  confirmMaterializeRecurrence,
  showEditDialog,
  showInformationDialog,
  showWorkHourBackground,
  showUploadDialog,
  sideBySideGridStyle,
  startDrag,
  startTime,
  extendBottom,
  mouseMove,
  endDrag,
  cancelDrag,
  informationDialogItem,
  materializeRecurrenceDialog,
  recurrenceEditScopeDialog,
  isDetachingOccurrence,
  templates,
  updateConflictDialog,
  uploadDialogItem,
  editEvent,
  upcomingEvents,
  value,
  workHours,
} = useSaplingEvent()

const isCalendarTooltipBlocked = computed(
  () =>
    isCalendarDragActive.value ||
    showEditDialog.value ||
    eventContextMenu.value.visible ||
    showInformationDialog.value ||
    showUploadDialog.value ||
    materializeRecurrenceDialog.value.visible ||
    recurrenceEditScopeDialog.value.visible ||
    updateConflictDialog.value.visible,
)
</script>
