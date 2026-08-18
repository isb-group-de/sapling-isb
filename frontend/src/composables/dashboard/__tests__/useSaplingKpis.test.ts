import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSaplingKpis } from '../useSaplingKpis'

const apiMock = vi.hoisted(() => ({
  findAll: vi.fn(),
}))

vi.mock('@/services/api.generic.service', () => ({
  default: {
    findAll: apiMock.findAll,
    update: vi.fn(),
    createReference: vi.fn(),
    deleteReference: vi.fn(),
  },
}))

describe('useSaplingKpis', () => {
  beforeEach(() => {
    apiMock.findAll.mockReset()
  })

  it('loads every unassigned KPI and sorts the searchable catalog by display name', async () => {
    apiMock.findAll.mockResolvedValue([
      { handle: 3, name: 'KPI 10' },
      { handle: 1, name: 'Zulu' },
      { handle: 2, name: 'KPI 2' },
      { handle: 4, name: 'Alpha' },
    ])
    const dashboard = ref({ handle: 8, kpis: [{ handle: 1, name: 'Zulu' }] })
    const { availableKpis, addKpiDialog, openAddKpiDialog } = useSaplingKpis(dashboard as never)

    await openAddKpiDialog()

    expect(apiMock.findAll).toHaveBeenCalledWith('kpi', {
      orderBy: { name: 'ASC', handle: 'ASC' },
    })
    expect(availableKpis.value.map((kpi) => kpi.name)).toEqual(['Alpha', 'KPI 2', 'KPI 10'])
    expect(addKpiDialog.value).toBe(true)
  })
})
