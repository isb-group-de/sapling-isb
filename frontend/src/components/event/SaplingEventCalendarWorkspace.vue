<template>
  <template v-if="calendarViewMode === 'single'">
    <SaplingEventCalendar
      v-model="calendarValue"
      :events="events"
      :calendar-display-type="calendarDisplayType"
      :event-overlap-mode="eventOverlapMode"
      :calendar-weekdays="calendarWeekdays"
      :is-drag-active="isDragActive"
      :is-tooltip-blocked="isTooltipBlocked"
      :work-hours="workHours"
      :show-work-hour-background="showWorkHourBackground"
      calendar-class="sapling-event-vcalendar--single"
      :show-resize-handle="true"
      :get-work-hour-style="getWorkHourStyle"
      :get-event-color="getEventColor"
      :get-event-participants="getEventParticipants"
      :now-y="nowY"
      :get-events="getEvents"
      :open-event="openEvent"
      :open-context-menu="openContextMenu"
      :start-drag="startDrag"
      :start-time="startTime"
      :cancel-drag="cancelDrag"
      :mouse-move="mouseMove"
      :end-drag="endDrag"
      :extend-bottom="extendBottom"
    />
  </template>

  <template v-else>
    <div
      ref="sideBySideScrollRoot"
      class="sapling-scroll-region sapling-event-sidebyside-shell"
      @scroll.capture.passive="handleCalendarScroll"
    >
      <div class="sapling-event-sidebyside-grid" :style="sideBySideGridStyle">
        <section
          v-for="personId in selectedPeoples"
          :key="personId"
          class="sapling-section-panel sapling-panel-shell sapling-page-panel sapling-event-sidebyside-column"
        >
          <header class="sapling-section-header sapling-event-sidebyside-column__header">
            <span>{{ getPersonName(personId) }}</span>
          </header>

          <div class="sapling-fill-shell sapling-event-sidebyside-column__calendar">
            <SaplingEventCalendar
              v-model="calendarValue"
              :events="getSideBySideEvents(personId)"
              :calendar-display-type="calendarDisplayType"
              :event-overlap-mode="eventOverlapMode"
              :calendar-weekdays="calendarWeekdays"
              :is-drag-active="isDragActive"
              :is-tooltip-blocked="isTooltipBlocked"
              :work-hours="getPersonWorkHours(personId)"
              :show-work-hour-background="showWorkHourBackground"
              calendar-class="sapling-event-vcalendar--column"
              :get-work-hour-style="(date) => getColumnWorkHourStyle(personId, date)"
              :get-event-color="getEventColor"
              :get-event-participants="getEventParticipants"
              :now-y="nowY"
              :get-events="getEvents"
              :open-event="openEvent"
              :open-context-menu="openContextMenu"
              :start-drag="startDrag"
              :start-time="startTime"
              :cancel-drag="cancelDrag"
              :mouse-move="mouseMove"
              :end-drag="endDrag"
              :extend-bottom="extendBottom"
            />
          </div>
        </section>
      </div>
    </div>
  </template>
</template>

<script lang="ts" setup>
import { computed, toRef } from 'vue'
import type { CSSProperties } from 'vue'
import type { WorkHourWeekItem } from '@/entity/entity'
import SaplingEventCalendar from '@/components/event/SaplingEventCalendar.vue'
import type { CalendarEvent } from 'vuetify/lib/components/VCalendar/types.mjs'
import type { CalendarEventOverlapMode } from '@/composables/event/eventCalendar.utils'
import { useSaplingCalendarLinkedScroll } from '@/composables/event/useSaplingCalendarLinkedScroll'

interface CalendarDatePair {
  start: CalendarDateItem
  end: CalendarDateItem
}

interface CalendarDateItem {
  date: string
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

type CalendarDisplayType = 'day' | 'week' | 'month'
type CalendarViewMode = 'single' | 'sidebyside'

const props = defineProps<{
  modelValue: string
  calendarViewMode: CalendarViewMode
  linkedScrolling: boolean
  events: CalendarEvent[]
  calendarDisplayType: CalendarDisplayType
  eventOverlapMode: CalendarEventOverlapMode
  calendarWeekdays?: number[]
  isDragActive: boolean
  isTooltipBlocked: boolean
  workHours: WorkHourWeekItem | null
  showWorkHourBackground: boolean
  selectedPeoples: number[]
  sideBySideGridStyle: CSSProperties
  getWorkHourStyle: (date: string, workHours?: WorkHourWeekItem | null) => CSSProperties
  getEventColor: (event: CalendarEvent) => string
  getEventParticipants: (event: CalendarEvent) => string[]
  nowY: () => string
  getEvents: (value: CalendarDatePair) => void | Promise<void>
  openEvent: (event: CalendarEvent) => void
  openContextMenu: (nativeEvent: MouseEvent, event: CalendarEvent) => void
  startDrag: (nativeEvent: Event, payload: { event: CalendarEvent; timed: boolean }) => void
  startTime: (nativeEvent: Event, timeSlot: CalendarDateItem) => void
  cancelDrag: () => void
  mouseMove: (nativeEvent: Event, timeSlot: CalendarDateItem) => void
  endDrag: () => void
  extendBottom: (event: CalendarEvent) => void
  getPersonName: (personId: number) => string
  getPersonWorkHours: (personId: number) => WorkHourWeekItem | null
  getSideBySideEvents: (personId: number) => CalendarEvent[]
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

const calendarValue = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
})
const { handleCalendarScroll, sideBySideScrollRoot } = useSaplingCalendarLinkedScroll(
  toRef(props, 'linkedScrolling'),
)

function getColumnWorkHourStyle(personId: number, date: string) {
  return props.getWorkHourStyle(date, props.getPersonWorkHours(personId))
}
</script>
