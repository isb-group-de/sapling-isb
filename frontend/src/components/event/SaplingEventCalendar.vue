<template>
  <SaplingSurface
    data-tutorial="calendar-events"
    :as="VCalendar"
    v-model="calendarValue"
    class="sapling-event-vcalendar"
    :glass="false"
    :class="[
      props.calendarClass,
      `sapling-event-vcalendar--${props.calendarDisplayType}`,
      {
        'sapling-event-vcalendar--drag-active': props.isDragActive,
        'sapling-event-vcalendar--has-all-day-events': hasAllDayEvents,
      },
    ]"
    color="primary"
    :event-color="props.getEventColor"
    :event-overlap-mode="props.eventOverlapMode"
    :event-ripple="false"
    :events="props.events"
    :type="props.calendarDisplayType"
    :weekdays="props.calendarWeekdays"
    @change="props.getEvents"
    @mousedown:event="onEventMouseDown"
    @mousedown:time="onTimeMouseDown"
    @mouseleave="props.cancelDrag"
    @mousemove:time="onTimeMouseMove"
    @mouseup:time="onTimeMouseUp"
  >
    <template v-slot:day-body="{ date, week }">
      <div
        v-if="props.workHours && props.showWorkHourBackground"
        class="workhour-bg"
        v-css-vars="props.getWorkHourStyle(date)"
      ></div>
      <div
        :class="{ first: date === week?.[0]?.date }"
        v-css-vars="{ '--sapling-calendar-now-offset': props.nowY() }"
        class="v-current-time"
      ></div>
    </template>

    <template v-slot:event="{ event }">
      <v-menu
        :model-value="isEventTooltipOpen(event)"
        :open-on-hover="!isTooltipInteractionBlocked"
        :open-delay="500"
        :close-delay="250"
        :disabled="isTooltipInteractionBlocked || isBufferEvent(event)"
        :close-on-content-click="false"
        :open-on-click="false"
        :content-class="[
          'sapling-calendar-event-tooltip-overlay',
          {
            'sapling-calendar-event-tooltip-overlay--blocked': isTooltipInteractionBlocked,
          },
        ]"
        location="bottom start"
        transition="fade-transition"
        @update:model-value="onEventTooltipUpdate(event, $event)"
      >
        <template #activator="{ props: tooltipActivatorProps }">
          <div
            class="sapling-calendar-event-tooltip-host"
            v-bind="tooltipActivatorProps"
            @mouseleave="releaseEventTooltipSuppression"
          >
            <div
              class="sapling-calendar-event-card"
              :class="getEventCardClasses(event)"
              v-css-vars="getEventCardStyle(event)"
              :role="isInteractiveEvent(event) ? 'button' : undefined"
              :tabindex="isInteractiveEvent(event) ? 0 : undefined"
              @mousedown.left="onEventCardMouseDown($event, event)"
              @pointerup="onEventCardPointerUp($event, event)"
              @click.left.stop="onEventClick(event)"
              @contextmenu.stop.prevent="onEventContextMenu($event, event)"
              @keydown.enter.stop.prevent="onEventActivate(event)"
              @keydown.space.stop.prevent="onEventActivate(event)"
            >
              <div
                class="sapling-calendar-event-card__accent"
                v-css-vars="{ '--sapling-calendar-event-accent': getEventAccentColor(event) }"
              ></div>

              <div class="sapling-calendar-event-card__content">
                <div class="sapling-calendar-event-card__header">
                  <div class="sapling-calendar-event-card__type">
                    <v-icon
                      class="sapling-calendar-event-card__category-icon"
                      v-css-vars="{
                        '--sapling-calendar-event-category-color': getEventCategoryColor(event),
                      }"
                      size="14"
                    >
                      {{ getEventIcon(event) }}
                    </v-icon>
                    <v-icon v-if="isRecurringOccurrence(event)" size="14">mdi-repeat</v-icon>
                    <span class="sapling-calendar-event-card__time">{{
                      formatEventTimeRange(event)
                    }}</span>
                  </div>

                  <strong
                    v-if="shouldInlineTitle(event)"
                    class="sapling-calendar-event-card__title sapling-calendar-event-card__title--inline"
                  >
                    {{ event.event?.title || event.name || '' }}
                  </strong>
                </div>

                <strong v-if="!shouldInlineTitle(event)" class="sapling-calendar-event-card__title">
                  {{ event.event?.title || event.name || '' }}
                </strong>
                <p
                  v-if="shouldShowDescription(event) && event.event?.description"
                  class="sapling-calendar-event-card__description"
                >
                  {{ event.event.description }}
                </p>
              </div>

              <button
                v-if="shouldShowResizeHandle(event)"
                class="sapling-calendar-event-card__resize v-event-drag-bottom"
                type="button"
                @mousedown.left.stop="onEventResizeMouseDown(event)"
              >
                <span class="sapling-calendar-event-card__resize-grip" aria-hidden="true"></span>
              </button>
            </div>
          </div>
        </template>

        <SaplingEventTooltipCard
          :event="event"
          class="glass-panel"
          :time-range="formatEventTimeRange(event)"
          :icon="getEventIcon(event)"
          :icon-color="getEventCategoryColor(event)"
          :participant-names="props.getEventParticipants(event)"
        />
      </v-menu>
    </template>
  </SaplingSurface>
</template>

<script lang="ts" setup>
import { computed, ref, shallowRef, watch } from 'vue'
import { VCalendar } from 'vuetify/components'
import type { CSSProperties } from 'vue'
import type { WorkHourWeekItem } from '@/entity/entity'
import type { CalendarEvent } from 'vuetify/lib/components/VCalendar/types.mjs'
import SaplingSurface from '@/components/common/SaplingSurface.vue'
import SaplingEventTooltipCard from '@/components/event/SaplingEventTooltipCard.vue'
import { formatDateValue, formatTimeValue } from '@/utils/saplingFormatUtil'
import {
  getCalendarEventCategoryColor as resolveCalendarEventCategoryColor,
  getCalendarEventIcon as resolveCalendarEventIcon,
  getCalendarEventStatusColor as resolveCalendarEventStatusColor,
  type CalendarEventOverlapMode,
} from '@/composables/event/eventCalendar.utils'

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
type EventCardDensity = 'default' | 'compact' | 'inline'

const COMPACT_EVENT_MAX_MINUTES = 90
const INLINE_EVENT_MAX_MINUTES = 90

const props = withDefaults(
  defineProps<{
    modelValue: string
    events: CalendarEvent[]
    calendarDisplayType: CalendarDisplayType
    eventOverlapMode: CalendarEventOverlapMode
    calendarWeekdays?: number[]
    isDragActive?: boolean
    isTooltipBlocked?: boolean
    workHours: WorkHourWeekItem | null
    showWorkHourBackground: boolean
    calendarClass?: string | string[] | Record<string, boolean>
    showResizeHandle?: boolean
    getWorkHourStyle: (date: string) => CSSProperties
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
  }>(),
  {
    calendarWeekdays: undefined,
    calendarClass: '',
    isDragActive: false,
    isTooltipBlocked: false,
    showResizeHandle: false,
  },
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

const calendarValue = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
})
const hasAllDayEvents = computed(() => props.events.some((event) => !event.timed))
const activeTooltipEvent = shallowRef<CalendarEvent | null>(null)
const isTooltipLocallySuppressed = ref(false)
const isTooltipInteractionBlocked = computed(
  () => props.isDragActive || props.isTooltipBlocked || isTooltipLocallySuppressed.value,
)

watch(isTooltipInteractionBlocked, (isBlocked) => {
  if (isBlocked) {
    closeEventTooltip()
  }
})

function formatEventTimeRange(event: CalendarEvent) {
  const start = new Date(event.start)
  const end = new Date(event.end)

  if (!event.timed) {
    const sameDay = start.toDateString() === end.toDateString()
    return sameDay ? formatDateValue(start) : `${formatDateValue(start)} - ${formatDateValue(end)}`
  }

  return `${formatTimeValue(start)} - ${formatTimeValue(end)}`
}

function getEventDurationMinutes(event: CalendarEvent) {
  if (!event.timed) {
    return Number.POSITIVE_INFINITY
  }

  const start = new Date(event.start).getTime()
  const end = new Date(event.end).getTime()

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return Number.POSITIVE_INFINITY
  }

  return Math.max(Math.round((end - start) / 60000), 0)
}

function getEventCardDensity(event: CalendarEvent): EventCardDensity {
  if (props.calendarDisplayType === 'month') {
    return 'inline'
  }

  const durationMinutes = getEventDurationMinutes(event)

  if (durationMinutes <= INLINE_EVENT_MAX_MINUTES) {
    return 'inline'
  }

  if (durationMinutes <= COMPACT_EVENT_MAX_MINUTES) {
    return 'compact'
  }

  return 'default'
}

function getEventCardClasses(event: CalendarEvent) {
  const density = getEventCardDensity(event)

  return {
    'v-event-draggable': isDraggableEvent(event),
    'sapling-calendar-event-card--all-day': !event.timed,
    'sapling-calendar-event-card--compact': density !== 'default',
    'sapling-calendar-event-card--inline': density === 'inline',
    'sapling-calendar-event-card--resizable': shouldShowResizeHandle(event),
    'sapling-calendar-event-card--recurring': isRecurringOccurrence(event),
    'sapling-calendar-event-card--readonly': !isInteractiveEvent(event),
    'sapling-calendar-event-card--buffer': isBufferEvent(event),
  }
}

function shouldShowResizeHandle(event: CalendarEvent) {
  return Boolean(event.timed && props.showResizeHandle && isDraggableEvent(event))
}

function getEventCardStyle(event: CalendarEvent): CSSProperties {
  return {
    '--sapling-calendar-event-card-color': props.getEventColor(event),
  }
}

function shouldInlineTitle(event: CalendarEvent) {
  return getEventCardDensity(event) === 'inline'
}

function shouldShowDescription(event: CalendarEvent) {
  return getEventCardDensity(event) === 'default'
}

function isInteractiveEvent(event: CalendarEvent) {
  return !isHolidayEvent(event) && !isBufferEvent(event)
}

function isDraggableEvent(event: CalendarEvent) {
  return isInteractiveEvent(event) && getEventDurationMinutes(event) > 0
}

function isHolidayEvent(event: CalendarEvent) {
  return (event as CalendarEvent & { saplingSource?: string }).saplingSource === 'holiday'
}

function isBufferEvent(event: CalendarEvent) {
  return (event as CalendarEvent & { saplingSource?: string }).saplingSource === 'eventBuffer'
}

function getEventAccentColor(event: CalendarEvent) {
  return resolveCalendarEventStatusColor(event, props.getEventColor(event))
}

function getEventCategoryColor(event: CalendarEvent) {
  return resolveCalendarEventCategoryColor(event, props.getEventColor(event))
}

function getEventIcon(event: CalendarEvent) {
  return resolveCalendarEventIcon(event)
}

function isEventTooltipOpen(event: CalendarEvent) {
  return (
    !isTooltipInteractionBlocked.value &&
    !isBufferEvent(event) &&
    activeTooltipEvent.value === event
  )
}

function onEventTooltipUpdate(event: CalendarEvent, isOpen: boolean) {
  if (isOpen) {
    if (!isTooltipInteractionBlocked.value && !isBufferEvent(event)) {
      activeTooltipEvent.value = event
    }
    return
  }

  if (activeTooltipEvent.value === event) {
    closeEventTooltip()
  }
}

function closeEventTooltip() {
  activeTooltipEvent.value = null
}

function suppressEventTooltip() {
  isTooltipLocallySuppressed.value = true
  closeEventTooltip()
}

function releaseEventTooltipSuppression() {
  isTooltipLocallySuppressed.value = false
}

function onEventActivate(event: CalendarEvent) {
  suppressEventTooltip()

  if (!isInteractiveEvent(event)) {
    return
  }

  props.openEvent(event)
}

function onEventCardMouseDown(nativeEvent: MouseEvent, event: CalendarEvent) {
  if (!isDraggableEvent(event)) {
    nativeEvent.stopPropagation()
  }
}

function onEventCardPointerUp(nativeEvent: PointerEvent, event: CalendarEvent) {
  if (!nativeEvent.isPrimary || isDraggableEvent(event) || !isInteractiveEvent(event)) {
    return
  }

  nativeEvent.stopPropagation()
  onEventActivate(event)
}

function onEventClick(event: CalendarEvent) {
  if (isDraggableEvent(event)) {
    onEventActivate(event)
  }
}

function onEventContextMenu(nativeEvent: MouseEvent, event: CalendarEvent) {
  suppressEventTooltip()

  if (!isInteractiveEvent(event)) {
    return
  }

  nativeEvent.preventDefault()
  props.openContextMenu(nativeEvent, event)
}

function isPrimaryMouseButton(event: Event) {
  return !(event instanceof MouseEvent) || event.button === 0
}

function onEventMouseDown(nativeEvent: Event, payload: { event: CalendarEvent; timed: boolean }) {
  suppressEventTooltip()

  if (!isPrimaryMouseButton(nativeEvent) || !isDraggableEvent(payload.event)) {
    return
  }

  props.startDrag(nativeEvent, payload)
}

function onTimeMouseDown(nativeEvent: Event, timeSlot: CalendarDateItem) {
  closeEventTooltip()

  if (!isPrimaryMouseButton(nativeEvent)) {
    return
  }

  props.startTime(nativeEvent, timeSlot)
}

function onEventResizeMouseDown(event: CalendarEvent) {
  suppressEventTooltip()
  props.extendBottom(event)
}

function onTimeMouseMove(nativeEvent: Event, timeSlot: CalendarDateItem) {
  if (nativeEvent instanceof MouseEvent && (nativeEvent.buttons & 1) !== 1) {
    return
  }

  props.mouseMove(nativeEvent, timeSlot)
}

function onTimeMouseUp(nativeEvent: Event) {
  if (!isPrimaryMouseButton(nativeEvent)) {
    return
  }

  props.endDrag()
}

function isRecurringOccurrence(event: CalendarEvent) {
  return Boolean(
    (event as CalendarEvent & { isRecurringOccurrence?: boolean }).isRecurringOccurrence,
  )
}
</script>
