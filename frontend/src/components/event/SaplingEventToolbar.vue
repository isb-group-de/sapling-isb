<template>
  <header
    ref="toolbarElement"
    data-tutorial="calendar-toolbar"
    class="sapling-split-toolbar sapling-event-toolbar"
  >
    <div class="sapling-toolbar-group sapling-event-toolbar__primary">
      <div data-tutorial="calendar-period" class="sapling-event-toolbar__period">
        <div class="sapling-icon-tile sapling-event-toolbar__period-icon">
          <v-icon size="18">{{ periodIcon }}</v-icon>
        </div>
        <div class="sapling-event-toolbar__period-copy">
          <h1>{{ periodLabel }}</h1>
          <span>{{ periodRangeLabel }}</span>
        </div>
      </div>

      <div
        data-tutorial="calendar-navigation"
        class="sapling-toolbar-nav-group sapling-event-toolbar__nav-group"
      >
        <v-btn-group class="sapling-event-toolbar__nav" density="comfortable">
          <v-btn
            variant="tonal"
            icon="mdi-chevron-left"
            :title="$t('global.previous')"
            :aria-label="$t('global.previous')"
            @click="emit('previous')"
          />
          <v-btn
            :icon="compactNavigation"
            :prepend-icon="compactNavigation ? undefined : 'mdi-calendar-today'"
            variant="tonal"
            :title="$t('event.today')"
            :aria-label="$t('event.today')"
            @click="emit('today')"
          >
            <v-icon v-if="compactNavigation">mdi-calendar-today</v-icon>
            <template v-if="$vuetify.display.mdAndUp && !compactNavigation">
              {{ $t('event.today') }}
            </template>
          </v-btn>
          <v-menu
            v-model="pickerMenuOpen"
            :close-on-content-click="false"
            location="bottom start"
            offset="12"
          >
            <template #activator="{ props: activatorProps }">
              <v-btn
                v-bind="activatorProps"
                class="sapling-button-truncate sapling-event-toolbar__picker-trigger"
                :icon="compactNavigation"
                :prepend-icon="compactNavigation ? undefined : 'mdi-calendar-search'"
                variant="tonal"
                :title="$t('calendar.selectDate')"
                :aria-label="$t('calendar.selectDate')"
              >
                <v-icon v-if="compactNavigation">mdi-calendar-search</v-icon>
                <template v-if="$vuetify.display.mdAndUp && !compactNavigation">
                  {{ $t('calendar.selectDate') }}</template
                >
              </v-btn>
            </template>

            <SaplingSurface class="sapling-picker-panel sapling-event-toolbar__picker-panel">
              <v-date-picker
                v-if="isMonthPicker"
                :model-value="pickerDateModel"
                :month="pickerMonth"
                :year="pickerYear"
                first-day-of-week="1"
                hide-title
                view-mode="months"
                @update:month="onMonthPicked"
                @update:year="onPickerYearUpdated"
              />

              <v-date-picker
                v-else
                :model-value="pickerDateModel"
                first-day-of-week="1"
                hide-title
                :show-week="isWeekPicker"
                @update:model-value="onDatePicked"
              />
            </SaplingSurface>
          </v-menu>
          <v-btn
            variant="tonal"
            icon="mdi-chevron-right"
            :title="$t('global.next')"
            :aria-label="$t('global.next')"
            @click="emit('next')"
          />
        </v-btn-group>
      </div>

      <v-btn-group
        v-if="showDataActionsInline"
        class="sapling-event-toolbar__data-actions"
        density="comfortable"
      >
        <v-btn
          data-tutorial="calendar-refresh"
          :loading="isRefreshing"
          :disabled="isRefreshing"
          prepend-icon="mdi-refresh"
          variant="tonal"
          :title="$t('global.refresh')"
          :aria-label="$t('global.refresh')"
          @click="emit('refresh')"
        >
          {{ $t('global.refresh') }}
        </v-btn>

        <v-tooltip v-if="calendarSyncProvider" :text="calendarSyncDescription" location="bottom">
          <template #activator="{ props: tooltipProps }">
            <v-btn
              v-bind="tooltipProps"
              :loading="isSyncingExternalCalendar"
              :disabled="isSyncingExternalCalendar"
              :prepend-icon="calendarSyncIcon"
              variant="tonal"
              :title="calendarSyncLabel"
              :aria-label="calendarSyncLabel"
              @click="emit('syncCalendar')"
            >
              {{ calendarSyncLabel }}
            </v-btn>
          </template>
        </v-tooltip>
      </v-btn-group>

      <div
        data-tutorial="calendar-display-options"
        class="sapling-toolbar-group sapling-event-toolbar__options"
      >
        <v-btn-toggle
          v-if="showModeInline"
          v-model="calendarModeModel"
          class="sapling-segmented-toggle sapling-toolbar-toggle sapling-event-toolbar__mode-toggle"
          density="comfortable"
          mandatory
        >
          <v-btn prepend-icon="mdi-perspective-less" variant="tonal" value="default">
            <template v-if="$vuetify.display.mdAndUp"> {{ $t('calendar.standard') }}</template>
          </v-btn>
          <v-btn prepend-icon="mdi-perspective-more" variant="tonal" value="extended">
            <template v-if="$vuetify.display.mdAndUp"> {{ $t('calendar.extended') }}</template>
          </v-btn>
        </v-btn-toggle>

        <v-btn-toggle
          v-if="showViewInline"
          v-model="calendarViewModeModel"
          class="sapling-segmented-toggle sapling-toolbar-toggle sapling-event-toolbar__view-toggle"
          density="comfortable"
          mandatory
        >
          <v-btn prepend-icon="mdi-call-merge" variant="tonal" value="single">
            <template v-if="$vuetify.display.mdAndUp"> {{ $t('calendar.combined') }}</template>
          </v-btn>
          <v-btn prepend-icon="mdi-call-split" variant="tonal" value="sidebyside">
            <template v-if="$vuetify.display.mdAndUp"> {{ $t('calendar.sideBySide') }}</template>
          </v-btn>
        </v-btn-toggle>

        <v-tooltip
          v-if="showLinkedScrollingInline"
          :text="$t('calendar.linkedScrollingDescription')"
          location="bottom"
        >
          <template #activator="{ props: tooltipProps }">
            <v-btn
              v-bind="tooltipProps"
              :active="linkedScrollingModel"
              icon="mdi-link-variant"
              variant="tonal"
              :title="$t('calendar.linkedScrolling')"
              :aria-label="$t('calendar.linkedScrolling')"
              @click="linkedScrollingModel = !linkedScrollingModel"
            />
          </template>
        </v-tooltip>

        <v-btn-toggle
          v-if="showArrangementInline"
          v-model="eventOverlapModeModel"
          class="sapling-segmented-toggle sapling-toolbar-toggle sapling-event-toolbar__arrangement-toggle"
          density="comfortable"
          mandatory
        >
          <v-btn prepend-icon="mdi-layers-outline" variant="tonal" value="stack">
            {{ $t('calendar.overlapStack') }}
          </v-btn>
          <v-btn prepend-icon="mdi-view-column-outline" variant="tonal" value="column">
            {{ $t('calendar.overlapColumns') }}
          </v-btn>
        </v-btn-toggle>

        <div
          v-if="showTypeInline"
          data-tutorial="calendar-view-types"
          class="sapling-event-toolbar__type-wrap"
        >
          <v-btn-toggle
            v-model="calendarTypeModel"
            class="sapling-segmented-toggle sapling-toolbar-toggle sapling-event-toolbar__type-toggle"
            density="comfortable"
            mandatory
          >
            <v-btn variant="tonal" value="day">{{ $t('calendar.day') }}</v-btn>
            <v-btn variant="tonal" value="workweek">{{ $t('calendar.workweek') }}</v-btn>
            <v-btn variant="tonal" value="week">{{ $t('calendar.week') }}</v-btn>
            <v-btn variant="tonal" value="month">{{ $t('calendar.month') }}</v-btn>
          </v-btn-toggle>
        </div>

        <div v-if="hasOverflowActions" class="sapling-event-toolbar__overflow">
          <v-menu location="bottom end" offset="8">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                icon="mdi-dots-horizontal"
                variant="tonal"
                :title="$t('global.more')"
                :aria-label="$t('global.more')"
              />
            </template>

            <SaplingSurface :as="VList" class="sapling-event-toolbar__overflow-menu">
              <v-list-subheader>{{ $t('calendar.timeGridHeight') }}</v-list-subheader>
              <v-list-item
                prepend-icon="mdi-arrow-collapse-vertical"
                :active="timeGridScaleModel === 'standard'"
                @click="timeGridScaleModel = 'standard'"
              >
                <v-list-item-title>{{ $t('calendar.timeGridHeightStandard') }}</v-list-item-title>
              </v-list-item>
              <v-list-item
                prepend-icon="mdi-arrow-expand-vertical"
                :active="timeGridScaleModel === 'double'"
                @click="timeGridScaleModel = 'double'"
              >
                <v-list-item-title>{{ $t('calendar.timeGridHeightDouble') }}</v-list-item-title>
              </v-list-item>

              <v-divider class="sapling-event-toolbar__overflow-divider" />

              <v-list-subheader>{{ $t('calendar.timeRange') }}</v-list-subheader>
              <v-list-item
                prepend-icon="mdi-hours-24"
                :active="timeRangeModeModel === 'fullDay'"
                @click="timeRangeModeModel = 'fullDay'"
              >
                <v-list-item-title>{{ $t('calendar.timeRangeFullDay') }}</v-list-item-title>
              </v-list-item>
              <v-list-item
                prepend-icon="mdi-briefcase-clock-outline"
                :active="timeRangeModeModel === 'workHours'"
                @click="timeRangeModeModel = 'workHours'"
              >
                <v-list-item-title>{{ $t('calendar.timeRangeWorkHours') }}</v-list-item-title>
              </v-list-item>

              <v-divider
                v-if="hasOtherOverflowActions"
                class="sapling-event-toolbar__overflow-divider"
              />

              <template v-if="showViewOverflow">
                <v-list-item
                  prepend-icon="mdi-call-merge"
                  :active="calendarViewModeModel === 'single'"
                  @click="calendarViewModeModel = 'single'"
                >
                  <v-list-item-title>{{ $t('calendar.combined') }}</v-list-item-title>
                </v-list-item>
                <v-list-item
                  prepend-icon="mdi-call-split"
                  :active="calendarViewModeModel === 'sidebyside'"
                  @click="calendarViewModeModel = 'sidebyside'"
                >
                  <v-list-item-title>{{ $t('calendar.sideBySide') }}</v-list-item-title>
                </v-list-item>
              </template>

              <v-divider
                v-if="showViewOverflow && hasOverflowActionsAfterView"
                class="sapling-event-toolbar__overflow-divider"
              />

              <v-list-item
                v-if="showLinkedScrollingOverflow"
                prepend-icon="mdi-link-variant"
                :active="linkedScrollingModel"
                @click="linkedScrollingModel = !linkedScrollingModel"
              >
                <v-list-item-title>{{ $t('calendar.linkedScrolling') }}</v-list-item-title>
              </v-list-item>

              <v-divider
                v-if="showLinkedScrollingOverflow && hasOverflowActionsAfterLinkedScrolling"
                class="sapling-event-toolbar__overflow-divider"
              />

              <template v-if="showModeOverflow">
                <v-list-item
                  prepend-icon="mdi-perspective-less"
                  :active="calendarModeModel === 'default'"
                  @click="calendarModeModel = 'default'"
                >
                  <v-list-item-title>{{ $t('calendar.standard') }}</v-list-item-title>
                </v-list-item>
                <v-list-item
                  prepend-icon="mdi-perspective-more"
                  :active="calendarModeModel === 'extended'"
                  @click="calendarModeModel = 'extended'"
                >
                  <v-list-item-title>{{ $t('calendar.extended') }}</v-list-item-title>
                </v-list-item>
              </template>

              <v-divider
                v-if="showModeOverflow && hasOverflowActionsAfterMode"
                class="sapling-event-toolbar__overflow-divider"
              />

              <template v-if="showDataActionsOverflow">
                <v-list-item
                  prepend-icon="mdi-refresh"
                  :disabled="isRefreshing"
                  @click="emit('refresh')"
                >
                  <v-list-item-title>{{ $t('global.refresh') }}</v-list-item-title>
                </v-list-item>
                <v-list-item
                  v-if="calendarSyncProvider"
                  :prepend-icon="calendarSyncIcon"
                  :disabled="isSyncingExternalCalendar"
                  @click="emit('syncCalendar')"
                >
                  <v-list-item-title>{{ calendarSyncLabel }}</v-list-item-title>
                </v-list-item>
              </template>

              <v-divider
                v-if="showDataActionsOverflow && hasOverflowActionsAfterData"
                class="sapling-event-toolbar__overflow-divider"
              />

              <template v-if="showArrangementOverflow">
                <v-list-item
                  prepend-icon="mdi-layers-outline"
                  :active="eventOverlapModeModel === 'stack'"
                  @click="eventOverlapModeModel = 'stack'"
                >
                  <v-list-item-title>{{ $t('calendar.overlapStack') }}</v-list-item-title>
                </v-list-item>
                <v-list-item
                  prepend-icon="mdi-view-column-outline"
                  :active="eventOverlapModeModel === 'column'"
                  @click="eventOverlapModeModel = 'column'"
                >
                  <v-list-item-title>{{ $t('calendar.overlapColumns') }}</v-list-item-title>
                </v-list-item>
              </template>

              <v-divider
                v-if="showArrangementOverflow && showTypeOverflow"
                class="sapling-event-toolbar__overflow-divider"
              />

              <template v-if="showTypeOverflow">
                <v-list-item
                  v-for="type in calendarTypeOptions"
                  :key="type"
                  :prepend-icon="calendarTypeIcons[type]"
                  :active="calendarTypeModel === type"
                  @click="calendarTypeModel = type"
                >
                  <v-list-item-title>{{ $t(`calendar.${type}`) }}</v-list-item-title>
                </v-list-item>
              </template>
            </SaplingSurface>
          </v-menu>
        </div>
      </div>
    </div>
  </header>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { VList } from 'vuetify/components'
import SaplingSurface from '@/components/common/SaplingSurface.vue'
import type {
  CalendarTimeGridScale,
  CalendarTimeRangeMode,
} from '@/composables/event/eventCalendarPreferences'
import {
  formatLocalDate,
  resolvePickerDate,
  toDate,
  TOOLBAR_ARRANGEMENT_INLINE_MIN_WIDTH,
  TOOLBAR_COMPACT_NAVIGATION_MAX_WIDTH,
  TOOLBAR_DATA_ACTIONS_INLINE_MIN_WIDTH,
  TOOLBAR_MODE_INLINE_MIN_WIDTH,
  TOOLBAR_TYPE_INLINE_MIN_WIDTH,
  TOOLBAR_VIEW_INLINE_MIN_WIDTH,
  type CalendarEventOverlapMode,
  type CalendarMode,
  type CalendarSyncProvider,
  type CalendarType,
  type CalendarViewMode,
} from './eventToolbar.utils'

const props = defineProps<{
  isNarrowScreen: boolean
  calendarType: CalendarType
  calendarTypeOptions: CalendarType[]
  calendarViewMode: CalendarViewMode
  calendarMode: CalendarMode
  eventOverlapMode: CalendarEventOverlapMode
  linkedScrolling: boolean
  timeGridScale: CalendarTimeGridScale
  timeRangeMode: CalendarTimeRangeMode
  modelValue: string
  isRefreshing: boolean
  isSyncingExternalCalendar: boolean
  calendarSyncProvider: CalendarSyncProvider | null
  periodLabel: string
  periodRangeLabel: string
  periodIcon: string
}>()

const { t } = useI18n()

const emit = defineEmits<{
  (event: 'update:calendarType', value: CalendarType): void
  (event: 'update:calendarViewMode', value: CalendarViewMode): void
  (event: 'update:calendarMode', value: CalendarMode): void
  (event: 'update:eventOverlapMode', value: CalendarEventOverlapMode): void
  (event: 'update:linkedScrolling', value: boolean): void
  (event: 'update:timeGridScale', value: CalendarTimeGridScale): void
  (event: 'update:timeRangeMode', value: CalendarTimeRangeMode): void
  (event: 'previous'): void
  (event: 'today'): void
  (event: 'next'): void
  (event: 'refresh'): void
  (event: 'selectDate', value: string): void
  (event: 'syncCalendar'): void
}>()

const calendarTypeModel = computed({
  get: () => props.calendarType,
  set: (value: CalendarType) => emit('update:calendarType', value),
})

const calendarViewModeModel = computed({
  get: () => props.calendarViewMode,
  set: (value: CalendarViewMode) => emit('update:calendarViewMode', value),
})

const calendarModeModel = computed({
  get: () => props.calendarMode,
  set: (value: CalendarMode) => emit('update:calendarMode', value),
})

const eventOverlapModeModel = computed({
  get: () => props.eventOverlapMode,
  set: (value: CalendarEventOverlapMode) => emit('update:eventOverlapMode', value),
})

const linkedScrollingModel = computed({
  get: () => props.linkedScrolling,
  set: (value: boolean) => emit('update:linkedScrolling', value),
})

const timeGridScaleModel = computed({
  get: () => props.timeGridScale,
  set: (value: CalendarTimeGridScale) => emit('update:timeGridScale', value),
})

const timeRangeModeModel = computed({
  get: () => props.timeRangeMode,
  set: (value: CalendarTimeRangeMode) => emit('update:timeRangeMode', value),
})

const toolbarElement = ref<HTMLElement | null>(null)
const toolbarWidth = ref(Number.POSITIVE_INFINITY)
const pickerMenuOpen = ref(false)
const pickerYear = ref(resolvePickerDate(props.modelValue).getFullYear())
let toolbarResizeObserver: ResizeObserver | null = null

const pickerDateModel = computed(() => resolvePickerDate(props.modelValue))
const pickerMonth = computed(() => pickerDateModel.value.getMonth())
const isWeekPicker = computed(() => ['week', 'workweek'].includes(props.calendarType))
const isMonthPicker = computed(() => props.calendarType === 'month')
const calendarSyncLabel = computed(() =>
  props.calendarSyncProvider === 'google' ? t('calendar.syncGoogle') : t('calendar.syncOutlook'),
)
const calendarSyncDescription = computed(() =>
  props.calendarSyncProvider === 'google'
    ? t('calendar.syncGoogleDescription')
    : t('calendar.syncOutlookDescription'),
)
const calendarSyncIcon = computed(() =>
  props.calendarSyncProvider === 'google' ? 'mdi-google' : 'mdi-microsoft-outlook',
)
const compactNavigation = computed(() => toolbarWidth.value < TOOLBAR_COMPACT_NAVIGATION_MAX_WIDTH)
const showViewInline = computed(
  () => !props.isNarrowScreen && toolbarWidth.value >= TOOLBAR_VIEW_INLINE_MIN_WIDTH,
)
const showLinkedScrollingInline = computed(
  () => props.calendarViewMode === 'sidebyside' && showViewInline.value,
)
const showModeInline = computed(() => toolbarWidth.value >= TOOLBAR_MODE_INLINE_MIN_WIDTH)
const showDataActionsInline = computed(
  () => toolbarWidth.value >= TOOLBAR_DATA_ACTIONS_INLINE_MIN_WIDTH,
)
const showArrangementInline = computed(
  () => toolbarWidth.value >= TOOLBAR_ARRANGEMENT_INLINE_MIN_WIDTH,
)
const showTypeInline = computed(
  () => !props.isNarrowScreen && toolbarWidth.value >= TOOLBAR_TYPE_INLINE_MIN_WIDTH,
)
const showViewOverflow = computed(() => !showViewInline.value)
const showLinkedScrollingOverflow = computed(
  () => props.calendarViewMode === 'sidebyside' && !showLinkedScrollingInline.value,
)
const showModeOverflow = computed(() => !showModeInline.value)
const showDataActionsOverflow = computed(() => !showDataActionsInline.value)
const showArrangementOverflow = computed(() => !showArrangementInline.value)
const showTypeOverflow = computed(() => !showTypeInline.value)
const hasOverflowActionsAfterView = computed(
  () =>
    showLinkedScrollingOverflow.value ||
    showModeOverflow.value ||
    showDataActionsOverflow.value ||
    showArrangementOverflow.value ||
    showTypeOverflow.value,
)
const hasOverflowActionsAfterLinkedScrolling = computed(
  () =>
    showModeOverflow.value ||
    showDataActionsOverflow.value ||
    showArrangementOverflow.value ||
    showTypeOverflow.value,
)
const hasOverflowActionsAfterMode = computed(
  () => showDataActionsOverflow.value || showArrangementOverflow.value || showTypeOverflow.value,
)
const hasOverflowActionsAfterData = computed(
  () => showArrangementOverflow.value || showTypeOverflow.value,
)
const hasOverflowActions = true
const hasOtherOverflowActions = computed(
  () =>
    showViewOverflow.value ||
    showLinkedScrollingOverflow.value ||
    showModeOverflow.value ||
    showDataActionsOverflow.value ||
    showArrangementOverflow.value ||
    showTypeOverflow.value,
)
const calendarTypeIcons: Record<CalendarType, string> = {
  day: 'mdi-calendar-today-outline',
  workweek: 'mdi-calendar-week-outline',
  week: 'mdi-calendar-range-outline',
  month: 'mdi-calendar-month-outline',
}

onMounted(() => {
  updateToolbarWidth()

  if (typeof ResizeObserver !== 'undefined' && toolbarElement.value) {
    toolbarResizeObserver = new ResizeObserver(updateToolbarWidth)
    toolbarResizeObserver.observe(toolbarElement.value)
  }
})

onBeforeUnmount(() => {
  toolbarResizeObserver?.disconnect()
  toolbarResizeObserver = null
})

watch(
  () => props.modelValue,
  (value) => {
    pickerYear.value = resolvePickerDate(value).getFullYear()
  },
  { immediate: true },
)

function onDatePicked(value: unknown) {
  const selectedDate = toDate(value)
  if (!selectedDate) {
    return
  }

  emit('selectDate', formatLocalDate(selectedDate))
  pickerMenuOpen.value = false
}

function updateToolbarWidth() {
  const nextWidth = toolbarElement.value?.getBoundingClientRect().width
  if (nextWidth && nextWidth > 0) {
    toolbarWidth.value = nextWidth
  }
}

function onMonthPicked(value: unknown) {
  const selectedMonth = Number(value)
  if (Number.isNaN(selectedMonth)) {
    return
  }

  const nextDate = new Date(pickerYear.value, selectedMonth, 1)
  emit('selectDate', formatLocalDate(nextDate))
  pickerMenuOpen.value = false
}

function onPickerYearUpdated(value: unknown) {
  const selectedYear = Number(value)
  if (Number.isNaN(selectedYear)) {
    return
  }

  pickerYear.value = selectedYear
}
</script>
