<template>
  <article class="sapling-monitor-chart monitoring-panel">
    <div class="sapling-section-header">
      <div>
        <p class="sapling-eyebrow">{{ eyebrow }}</p>
        <h3>{{ title }}</h3>
      </div>
    </div>
    <VChart
      v-if="points.length"
      class="sapling-monitor-chart__canvas"
      :option="option"
      autoresize
    />
    <v-empty-state v-else icon="mdi-chart-line" :text="$t('system.monitoringNoData')" />
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components'
import { useI18n } from 'vue-i18n'
import type { MonitoringChartPoint } from '@/entity/system'
import { useSaplingAppearance } from '@/composables/system/useSaplingAppearance'
import { monitoringMetricLabel } from './systemMonitoringLabels'

use([
  CanvasRenderer,
  LineChart,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
])

const props = withDefaults(
  defineProps<{
    title: string
    eyebrow?: string
    points: MonitoringChartPoint[]
    unit?: string
    valueFormat?: 'number' | 'bytes' | 'bytesPerSecond'
  }>(),
  { eyebrow: '', unit: '', valueFormat: 'number' },
)
const { locale, t } = useI18n()
const { currentTheme } = useSaplingAppearance()

const option = computed(() => {
  const mutedText = currentTheme.value === 'dark' ? 'rgba(255,255,255,.68)' : 'rgba(58,58,58,.7)'
  const gridLine = currentTheme.value === 'dark' ? 'rgba(255,255,255,.1)' : 'rgba(58,58,58,.12)'
  const groups = new Map<string, MonitoringChartPoint[]>()
  for (const point of props.points) {
    const metricLabel = monitoringMetricLabel(t, locale.value, point.metricKey)
    const name = point.dimensionKey ? `${metricLabel} · ${point.dimensionKey}` : metricLabel
    groups.set(name, [...(groups.get(name) ?? []), point])
  }
  return {
    animation: false,
    grid: { left: 62, right: 24, top: groups.size > 1 ? 72 : 32, bottom: 94 },
    legend: {
      show: groups.size > 1,
      type: 'scroll',
      top: 4,
      textStyle: { color: mutedText },
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: unknown) => formatValue(Number(value)),
    },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 22, bottom: 12 }],
    xAxis: { type: 'time', axisLabel: { color: mutedText, margin: 18 } },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: mutedText,
        formatter: (value: number) => formatValue(value),
      },
      splitLine: { lineStyle: { color: gridLine } },
    },
    series: [...groups.entries()].map(([name, values]) => ({
      name,
      type: 'line',
      showSymbol: false,
      connectNulls: false,
      smooth: 0.18,
      lineStyle: { width: 2 },
      areaStyle: groups.size === 1 ? { opacity: 0.1 } : undefined,
      data: withVisibleGaps(values),
    })),
  }
})

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return '–'
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)
}

function formatValue(value: number): string {
  if (props.valueFormat === 'bytes') return formatBytes(value)
  if (props.valueFormat === 'bytesPerSecond') return `${formatBytes(value)}/s`
  return `${formatNumber(value)}${props.unit}`
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value)) return '–'
  const absolute = Math.abs(value)
  const units = ['B', 'kB', 'MB', 'GB', 'TB']
  const exponent =
    absolute > 0 ? Math.max(0, Math.min(Math.floor(Math.log(absolute) / Math.log(1024)), 4)) : 0
  return `${formatNumber(value / 1024 ** exponent)} ${units[exponent]}`
}

function withVisibleGaps(values: MonitoringChartPoint[]) {
  const sorted = values
    .map((point) => ({
      point,
      timestamp: new Date(point.capturedAt).getTime(),
      value: Number(point.average ?? point.last),
    }))
    .filter(({ timestamp, value }) => Number.isFinite(timestamp) && Number.isFinite(value))
    .sort((left, right) => left.timestamp - right.timestamp)
  const intervals = sorted
    .slice(1)
    .map((point, index) => point.timestamp - sorted[index].timestamp)
    .filter((interval) => interval > 0)
    .sort((left, right) => left - right)
  const expected = intervals[Math.floor(intervals.length / 2)] ?? 0
  const data: Array<[number, number | null]> = []
  for (let index = 0; index < sorted.length; index += 1) {
    const point = sorted[index]
    if (index > 0 && expected > 0) {
      const previousTime = sorted[index - 1].timestamp
      const currentTime = point.timestamp
      if (currentTime - previousTime > expected * 1.75) {
        data.push([previousTime + expected, null])
      }
    }
    data.push([point.timestamp, point.value])
  }
  return data
}
</script>
