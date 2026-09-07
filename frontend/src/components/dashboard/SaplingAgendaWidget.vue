<template>
  <div class="sapling-kpi-widget sapling-kpi-calendar">
    <v-skeleton-loader v-if="loading" type="list-item-two-line@3" />
    <div v-else-if="!hasError && !hasData" class="sapling-kpi-widget__state">
      {{ $t('kpi.calendarEmpty') }}
    </div>
    <ol
      v-else-if="!hasError"
      class="sapling-kpi-calendar__agenda"
      :aria-label="$t('kpi.calendarAgenda')"
    >
      <li v-for="entry in entries" :key="entry.key" class="sapling-kpi-calendar__item">
        <button type="button" class="sapling-kpi-calendar__entry" @click="openEvent(entry)">
          <span
            class="sapling-kpi-calendar__accent"
            v-css-vars="{ '--sapling-kpi-calendar-accent-color': entry.color }"
          />
          <v-icon size="20" :color="entry.color">{{ entry.icon }}</v-icon>
          <span class="sapling-kpi-calendar__date"
            ><strong>{{ formatDate(entry.start) }}</strong
            ><small>{{ formatTime(entry) }}</small></span
          >
          <span class="sapling-kpi-calendar__content"
            ><strong class="sapling-kpi-calendar__title" :title="entry.title">{{
              entry.title
            }}</strong
            ><small class="sapling-kpi-calendar__meta">{{ entry.metaLabel }}</small></span
          >
          <v-icon size="17">mdi-chevron-right</v-icon>
        </button>
      </li>
    </ol>
  </div>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { DashboardWidget } from '@/entity/dashboard-widget.types'
import type { SaplingKpiCalendarEntry } from '@/composables/kpi/useSaplingKpiCalendar'
import { useSaplingAgendaWidget } from '@/composables/dashboard/useSaplingAgendaWidget'
const props = defineProps<{ widget: Extract<DashboardWidget, { kind: 'AGENDA' }> }>()
const { t, locale } = useI18n()
const { entries, loading, hasError, hasData, refresh, openEvent } = useSaplingAgendaWidget(
  () => props.widget.config,
)
const formatDate = (date: Date) =>
  new Intl.DateTimeFormat(locale.value, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(date)
function formatTime(entry: SaplingKpiCalendarEntry) {
  const fmt = new Intl.DateTimeFormat(locale.value, { hour: '2-digit', minute: '2-digit' })
  return entry.isAllDay
    ? t('kpi.calendarAllDay')
    : `${fmt.format(entry.start)}–${fmt.format(entry.end)}`
}
defineExpose({ refresh })
</script>
