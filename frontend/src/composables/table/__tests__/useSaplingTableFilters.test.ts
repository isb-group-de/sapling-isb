import { describe, expect, it, vi } from 'vitest'
import type { ColumnFilterItem } from '@/entity/structure'
import { useSaplingTableFilters } from '../useSaplingTableFilters'

describe('useSaplingTableFilters', () => {
  it('keeps a stable filter reference across renders', () => {
    const statusFilter: ColumnFilterItem = {
      operator: 'eq',
      value: '',
      relationItems: [{ handle: 'open' }, { handle: 'in_progress' }],
    }
    const filters = useSaplingTableFilters(
      {
        sortBy: [],
        entityTemplates: [],
        columnFilters: { status: statusFilter },
      },
      vi.fn(),
    )

    const firstFilter = filters.getColumnFilterItem('status')
    const secondFilter = filters.getColumnFilterItem('status')

    expect(secondFilter).toBe(firstFilter)
    expect(secondFilter).not.toBe(statusFilter)
    expect(secondFilter?.relationItems).not.toBe(statusFilter.relationItems)
  })
})
