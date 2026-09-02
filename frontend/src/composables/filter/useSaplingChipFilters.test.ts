import { describe, expect, it } from 'vitest'
import type { SaplingChipFilterGroup } from '@/components/filter/saplingWorkFilter.types'
import { getDefaultChipFilterHandles } from './useSaplingChipFilters'

describe('getDefaultChipFilterHandles', () => {
  it('does not reselect chip options whose isOpen value made every option non-default', () => {
    expect(
      getDefaultChipFilterHandles(
        createFilter([
          { handle: 'completed', isDefaultSelected: false },
          { handle: 'cancelled', isDefaultSelected: false },
        ]),
      ),
    ).toEqual([])
  })

  it('selects every option when the reference catalog has no isOpen values', () => {
    expect(
      getDefaultChipFilterHandles(createFilter([{ handle: 'normal' }, { handle: 'high' }])),
    ).toEqual(['normal', 'high'])
  })
})

function createFilter(
  options: Array<{ handle: string; isDefaultSelected?: boolean }>,
): SaplingChipFilterGroup {
  return {
    key: 'status',
    fieldName: 'status',
    referenceName: 'ticketStatus',
    label: 'Status',
    options: options.map((option) => ({
      label: option.handle,
      ...option,
    })),
  }
}
