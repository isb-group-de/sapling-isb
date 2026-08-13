<template>
  <header
    ref="toolbarElement"
    data-tutorial="calendar-toolbar"
    class="sapling-split-toolbar sapling-event-toolbar"
  >
    <div class="sapling-toolbar-group sapling-event-toolbar__primary">
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
            prepend-icon="mdi-calendar-today"
            variant="tonal"
            :title="$t('event.today')"
            :aria-label="$t('event.today')"
            @click="emit('today')"
          >
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
                prepend-icon="mdi-calendar-search"
                variant="tonal"
                :title="$t('calendar.selectDate')"
                :aria-label="$t('calendar.selectDate')"
              >
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

        <v-tooltip
          v-if="calendarSyncProvider && showSyncInline"
          :text="calendarSyncDescription"
          location="bottom"
        >
          <template #activator="{ props: tooltipProps }">
            <v-btn
              v-bind="tooltipProps"
              :loading="isSyncingExternalCalendar"
              :disabled="isSyncingExternalCalendar"
              :prepend-icon="calendarSyncIcon"
              variant="tonal"
              @click="emit('syncCalendar')"
            >
              <template v-if="$vuetify.display.mdAndUp">
                {{ calendarSyncLabel }}
              </template>
            </v-btn>
          </template>
        </v-tooltip>

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
              <template v-if="!showModeInline">
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
                <v-divider />
              </template>

              <v-list-item
                v-if="calendarSyncProvider && !showSyncInline"
                :prepend-icon="calendarSyncIcon"
                :disabled="isSyncingExternalCalendar"
                @click="emit('syncCalendar')"
              >
                <v-list-item-title>{{ calendarSyncLabel }}</v-list-item-title>
              </v-list-item>

              <template v-if="!isNarrowScreen && !showViewInline">
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
                v-if="
                  !showTypeInline &&
                  (!showModeInline ||
                    (calendarSyncProvider && !showSyncInline) ||
                    (!isNarrowScreen && !showViewInline))
                "
              />

              <template v-if="!showTypeInline">
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
    </div>
  </header>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { VList } from 'vuetify/components'
import SaplingSurface from '@/components/common/SaplingSurface.vue'

type CalendarType = 'workweek' | 'month' | 'day' | 'week'
type CalendarViewMode = 'single' | 'sidebyside'
type CalendarMode = 'default' | 'extended'
type CalendarSyncProvider = 'azure' | 'google'

const TOOLBAR_TYPE_INLINE_MIN_WIDTH = 1460
const TOOLBAR_VIEW_INLINE_MIN_WIDTH = 1140
const TOOLBAR_SYNC_INLINE_MIN_WIDTH = 860
const TOOLBAR_MODE_INLINE_MIN_WIDTH = 680

const props = defineProps<{
  isNarrowScreen: boolean
  calendarType: CalendarType
  calendarTypeOptions: CalendarType[]
  calendarViewMode: CalendarViewMode
  calendarMode: CalendarMode
  modelValue: string
  isSyncingExternalCalendar: boolean
  calendarSyncProvider: CalendarSyncProvider | null
}>()

const { t } = useI18n()

const emit = defineEmits<{
  (event: 'update:calendarType', value: CalendarType): void
  (event: 'update:calendarViewMode', value: CalendarViewMode): void
  (event: 'update:calendarMode', value: CalendarMode): void
  (event: 'previous'): void
  (event: 'today'): void
  (event: 'next'): void
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
const compactNavigation = computed(() => toolbarWidth.value < TOOLBAR_MODE_INLINE_MIN_WIDTH)
const showModeInline = computed(() => toolbarWidth.value >= TOOLBAR_MODE_INLINE_MIN_WIDTH)
const showSyncInline = computed(() => toolbarWidth.value >= TOOLBAR_SYNC_INLINE_MIN_WIDTH)
const showViewInline = computed(
  () => !props.isNarrowScreen && toolbarWidth.value >= TOOLBAR_VIEW_INLINE_MIN_WIDTH,
)
const showTypeInline = computed(
  () => !props.isNarrowScreen && toolbarWidth.value >= TOOLBAR_TYPE_INLINE_MIN_WIDTH,
)
const hasOverflowActions = computed(
  () =>
    !showModeInline.value ||
    (props.calendarSyncProvider != null && !showSyncInline.value) ||
    (!props.isNarrowScreen && !showViewInline.value) ||
    !showTypeInline.value,
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

function toDate(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsedDate = new Date(value)
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
  }

  return null
}

function resolvePickerDate(input: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim())
  if (!match) {
    const parsedDate = new Date(input)
    return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate
  }

  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day))
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
</script>
