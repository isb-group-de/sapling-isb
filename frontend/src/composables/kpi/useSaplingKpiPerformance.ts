import type { KPIItem } from '@/entity/entity'
import type { KpiFormulaValue, KpiTargetValue } from '@/entity/structure'
import ApiKpiService from '@/services/api.kpi.service'
import { useSaplingKpiLoader } from '@/composables/kpi/useSaplingKpiLoader'
import { computed, ref, type MaybeRefOrGetter } from 'vue'

type PerformanceValue = KpiFormulaValue | KpiTargetValue

export function useSaplingKpiPerformance(kpi: MaybeRefOrGetter<KPIItem | null | undefined>) {
  const result = ref<PerformanceValue | null>(null)
  const hasData = computed(() => result.value?.value != null)
  const isTarget = computed(() => result.value !== null && 'targetValue' in result.value)
  const displayValue = computed(() => {
    const value = result.value?.value
    if (value == null) return '—'
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
  })
  const unitLabel = computed(() => {
    if (result.value?.unit === 'percent') return '%'
    if (result.value?.unit === 'hours') return 'h'
    if (result.value?.unit === 'days') return 'd'
    if (result.value?.unit === 'currency') return '€'
    return result.value?.unit ?? ''
  })
  const progress = computed(() => {
    if (!isTarget.value) return 0
    const value = (result.value as KpiTargetValue).progressPercent ?? 0
    return Math.min(100, Math.max(0, value))
  })
  const status = computed(() => (isTarget.value ? (result.value as KpiTargetValue).status : null))

  const { loading, hasError, isLoaded, loadKpiValue } = useSaplingKpiLoader(kpi, {
    load: async (currentKpi) => {
      const response = await ApiKpiService.execute<PerformanceValue>(currentKpi.handle)
      result.value = response?.value ?? null
    },
    reset: () => {
      result.value = null
    },
  })

  return {
    result,
    displayValue,
    unitLabel,
    progress,
    status,
    isTarget,
    hasData,
    loading,
    hasError,
    isLoaded,
    loadKpiValue,
  }
}
