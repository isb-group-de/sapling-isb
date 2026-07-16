import { describe, expect, it } from 'vitest'
import type { EntityTemplate } from '@/entity/structure'
import { removeUnavailableFieldFilters } from './saplingTableFilterRestore'

describe('removeUnavailableFieldFilters', () => {
  it('removes denied clauses from the active filter without mutating the saved filter', () => {
    const savedFilter = {
      $and: [{ title: { $ilike: '%visible%' } }, { secret: { $ilike: '%hidden%' } }],
    }
    const snapshot = structuredClone(savedFilter)
    const templates = [
      {
        name: 'title',
        fieldAccess: { allowRead: true, allowInsert: true, allowUpdate: true },
      },
      {
        name: 'secret',
        fieldAccess: { allowRead: false, allowInsert: true, allowUpdate: true },
      },
    ] as EntityTemplate[]

    expect(removeUnavailableFieldFilters(savedFilter, templates)).toEqual({
      filter: { $and: [{ title: { $ilike: '%visible%' } }] },
      removed: true,
    })
    expect(savedFilter).toEqual(snapshot)
  })
})
