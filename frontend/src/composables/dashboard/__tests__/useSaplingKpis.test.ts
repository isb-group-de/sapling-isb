import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSaplingKpis } from '../useSaplingKpis'

vi.mock('@/services/api.generic.service', () => ({
  default: {
    update: vi.fn(),
    createReference: vi.fn(),
    deleteReference: vi.fn(),
  },
}))

describe('useSaplingKpis', () => {
  beforeEach(() => vi.clearAllMocks())

  it('opens the standard KPI selector without maintaining a parallel option catalog', () => {
    const dashboard = ref({ handle: 8, kpis: [{ handle: 1, name: 'Zulu' }] })
    const { addKpiDialog, selectedKpi, openAddKpiDialog } = useSaplingKpis(dashboard as never)

    selectedKpi.value = { handle: 4, name: 'Alpha' } as never
    openAddKpiDialog()

    expect(selectedKpi.value).toBeNull()
    expect(addKpiDialog.value).toBe(true)
  })
})
