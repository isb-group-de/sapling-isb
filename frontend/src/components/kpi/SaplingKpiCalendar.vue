<template>
  <div class="sapling-kpi-widget sapling-kpi-calendar">
    <v-skeleton-loader v-if="loading && !isLoaded" type="list-item-two-line@3" />

    <div
      v-else-if="hasConfigurationError"
      class="sapling-kpi-widget__state sapling-kpi-widget__state--error"
    >
      <v-icon size="20">mdi-calendar-alert</v-icon>
      <span>{{ t('kpi.calendarConfigurationError') }}</span>
    </div>

    <div v-else-if="!hasError && !hasData" class="sapling-kpi-widget__state">
      <v-icon size="20">mdi-calendar-blank-outline</v-icon>
      <span>{{ t('kpi.calendarEmpty') }}</span>
    </div>

    <ol
      v-else-if="!hasError"
      class="sapling-kpi-calendar__agenda"
      :aria-label="t('kpi.calendarAgenda')"
    >
      <li v-for="entry in entries" :key="entry.key" class="sapling-kpi-calendar__item">
        <button
          type="button"
          class="sapling-kpi-calendar__entry"
          :disabled="entry.handle == null"
          :aria-label="entryAriaLabel(entry)"
          @click="openEvent(entry)"
        >
          <span
            class="sapling-kpi-calendar__accent"
            v-css-vars="{ '--sapling-kpi-calendar-accent-color': entry.color }"
            aria-hidden="true"
          />
          <v-icon class="sapling-kpi-calendar__icon" size="20" :color="entry.color">
            {{ entry.icon }}
          </v-icon>
          <span class="sapling-kpi-calendar__date">
            <strong>{{ formatDate(entry.start) }}</strong>
            <small>{{ formatTime(entry) }}</small>
          </span>
          <span class="sapling-kpi-calendar__content">
            <strong class="sapling-kpi-calendar__title" :title="entry.title">
              {{ entry.title }}
            </strong>
            <small v-if="entry.metaLabel" class="sapling-kpi-calendar__meta">
              {{ entry.metaLabel }}
            </small>
          </span>
          <v-icon size="17" aria-hidden="true">mdi-chevron-right</v-icon>
        </button>
      </li>
    </ol>
  </div>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import type { KPIItem } from '@/entity/entity'
import {
  useSaplingKpiCalendar,
  type SaplingKpiCalendarEntry,
} from '@/composables/kpi/useSaplingKpiCalendar'

const props = defineProps<{
  kpi: KPIItem
}>()

const { t, locale } = useI18n()
const {
  entries,
  loading,
  hasError,
  isLoaded,
  hasData,
  hasConfigurationError,
  loadKpiValue,
  refresh,
  openEvent,
} = useSaplingKpiCalendar(() => props.kpi)

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(locale.value, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

function formatTime(entry: SaplingKpiCalendarEntry): string {
  if (entry.isAllDay) {
    return t('kpi.calendarAllDay')
  }

  const formatter = new Intl.DateTimeFormat(locale.value, {
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${formatter.format(entry.start)}–${formatter.format(entry.end)}`
}

function entryAriaLabel(entry: SaplingKpiCalendarEntry): string {
  return `${entry.title}, ${formatDate(entry.start)}, ${formatTime(entry)}`
}

defineExpose({ loadKpiValue, refresh, loading, hasError, hasData, isLoaded })
</script>
