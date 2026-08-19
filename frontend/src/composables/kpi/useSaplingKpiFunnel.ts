import type { KPIItem } from '@/entity/entity'
import { useSaplingKpiList } from '@/composables/kpi/useSaplingKpiList'
import { normalizeKpiNumericValue } from '@/utils/saplingKpiValue'
import { computed, type MaybeRefOrGetter } from 'vue'

export function useSaplingKpiFunnel(kpi: MaybeRefOrGetter<KPIItem | null | undefined>) {
  const list = useSaplingKpiList(kpi)
  const labelColumn = computed(
    () => list.columns.value.find((column) => column !== 'value') ?? null,
  )
  const items = computed(() => {
    const label = labelColumn.value
    if (!label) return []
    const ordered = list.rows.value
      .map((row, index) => ({
        key: `${String(row[label] ?? 'stage')}-${index}`,
        label: String(row[label] ?? '—'),
        value: normalizeKpiNumericValue(row.value),
        row,
      }))
      .sort((left, right) => right.value - left.value)
    const first = ordered[0]?.value ?? 0
    return ordered.map((item, index) => ({
      ...item,
      width: first > 0 ? Math.max(18, (item.value / first) * 100) : 18,
      conversion:
        index === 0 || ordered[index - 1].value === 0
          ? 100
          : (item.value / ordered[index - 1].value) * 100,
    }))
  })

  return { ...list, items }
}
