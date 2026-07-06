import { describe, expect, it } from 'vitest'
import type { EntityTemplate } from '@/entity/structure'
import type { SaplingChipFilterGroup } from '@/components/filter/saplingWorkFilter.types'
import {
  buildChipColumnFilterFromSelection,
  extractPartnerHandlesFromFilter,
  getChipSelectionFromColumnFilter,
} from './useSaplingPartner'

describe('useSaplingPartner filter synchronization helpers', () => {
  it('stores partial chip selections as table column filters and treats full selections as unfiltered', () => {
    const statusFilter = createChipFilter()

    expect(buildChipColumnFilterFromSelection(statusFilter, ['open', 'waiting'])).toEqual({
      operator: 'eq',
      value: '',
      relationItems: [{ handle: 'open' }, { handle: 'waiting' }],
    })

    expect(
      buildChipColumnFilterFromSelection(statusFilter, [
        'closed',
        'in_progress',
        'open',
        'waiting',
      ]),
    ).toBeNull()
  })

  it('hydrates chip selections from table column filters', () => {
    const statusFilter = createChipFilter()

    expect(getChipSelectionFromColumnFilter(statusFilter)).toEqual([
      'closed',
      'in_progress',
      'open',
      'waiting',
    ])

    expect(
      getChipSelectionFromColumnFilter(statusFilter, {
        operator: 'nin',
        value: '',
        relationItems: [{ handle: 'closed' }],
      }),
    ).toEqual(['in_progress', 'open', 'waiting'])
  })

  it('extracts partner person handles from favorite-style URL filters', () => {
    const templates = [
      createPartnerTemplate('assigneePerson'),
      createPartnerTemplate('creatorPerson'),
      createPartnerTemplate('observerPerson'),
    ]

    expect(
      extractPartnerHandlesFromFilter(
        {
          $and: [
            { status: { handle: { $in: ['open'] } } },
            {
              $or: [
                { assigneePerson: { $in: [1] } },
                { creatorPerson: { handle: { $in: [1, '2'] } } },
              ],
            },
          ],
        },
        templates,
      ),
    ).toEqual([1, 2])
  })
})

function createChipFilter(): SaplingChipFilterGroup {
  return {
    key: 'status',
    fieldName: 'status',
    referenceName: 'ticketStatus',
    identifierKey: 'handle',
    label: 'Status',
    options: [
      { handle: 'closed', label: 'Geschlossen' },
      { handle: 'in_progress', label: 'In Bearbeitung' },
      { handle: 'open', label: 'Offen' },
      { handle: 'waiting', label: 'Wartend' },
    ],
  }
}

function createPartnerTemplate(name: string): EntityTemplate {
  return {
    name,
    key: name,
    title: name,
    type: 'string',
    kind: 'm:1',
    options: ['isPartner'],
    isAutoIncrement: false,
    isPersistent: true,
    isReference: true,
    referencedPks: ['handle'],
    referenceName: 'person',
  } as EntityTemplate
}
