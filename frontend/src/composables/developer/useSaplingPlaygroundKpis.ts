import { computed, onMounted, ref, type Ref } from 'vue'
import type { KPIItem } from '@/entity/entity'
import ApiGenericService from '@/services/api.generic.service'
import {
  createPlaygroundKpiCards,
  PLAYGROUND_KPI_CONFIG,
} from '@/components/developer/playground.utils'
import { useTranslationLoader } from '../generic/useTranslationLoader'

export function useSaplingPlaygroundKpis() {
  const kpis = PLAYGROUND_KPI_CONFIG.map(() => ref<KPIItem | null>(null))
  const loadingStates = PLAYGROUND_KPI_CONFIG.map(() => ref(true))
  const { isLoading: areTranslationsLoading } = useTranslationLoader('kpi', 'playground', 'global')

  async function loadKpi(handle: number, target: Ref<KPIItem | null>, loading: Ref<boolean>) {
    try {
      target.value =
        (await ApiGenericService.find<KPIItem>('kpi', { filter: { handle } })).data?.[0] ?? null
    } finally {
      loading.value = false
    }
  }

  async function loadKpis() {
    await Promise.all(
      PLAYGROUND_KPI_CONFIG.map((config, index) =>
        loadKpi(config.handle, kpis[index], loadingStates[index]),
      ),
    )
  }

  const cards = computed(() =>
    createPlaygroundKpiCards(
      kpis.map((kpi) => kpi.value),
      loadingStates.map((loading) => loading.value || areTranslationsLoading.value),
    ),
  )

  onMounted(() => {
    void loadKpis()
  })

  return {
    kpis,
    cards,
    loadKpis,
  }
}
