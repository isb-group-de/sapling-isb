import { describe, expect, it } from 'vitest'

import type { EntityTemplate } from '@/entity/structure'
import {
  getCommunicationOwnerReferenceNames,
  getCommunicationRecordLabel,
  getCommunicationValueLabel,
} from '@/utils/saplingCommunicationRecordUtil'

const ticketTemplates: EntityTemplate[] = [
  { key: 'number', name: 'number', type: 'string', options: ['isValue'] },
  {
    key: 'creatorPerson',
    name: 'creatorPerson',
    type: 'object',
    kind: 'm:1',
    isReference: true,
    referenceName: 'person',
  },
  {
    key: 'creatorPersonPhone',
    name: 'creatorPersonPhone',
    type: 'string',
    isPersistent: false,
    options: ['isPhone'],
  },
]

const personTemplates: EntityTemplate[] = [
  { key: 'firstName', name: 'firstName', type: 'string', options: ['isValue'] },
  { key: 'lastName', name: 'lastName', type: 'string', options: ['isValue'] },
  {
    key: 'company',
    name: 'company',
    type: 'object',
    isReference: true,
    referenceName: 'company',
    options: ['isValue'],
  },
]

describe('saplingCommunicationRecordUtil', () => {
  it('uses the referenced master record isValue fields for a named assistant', () => {
    expect(getCommunicationOwnerReferenceNames(['creatorPersonPhone'], ticketTemplates)).toEqual([
      'person',
    ])
    expect(
      getCommunicationRecordLabel(
        {
          number: 'T-1042',
          creatorPerson: { handle: 42 },
          creatorPersonFirstName: 'Ada',
          creatorPersonLastName: 'Lovelace',
          creatorPersonCompany: { handle: 5 },
          creatorPersonPhone: '+49 30 7654321',
        },
        ticketTemplates,
        ['creatorPersonPhone'],
        { person: personTemplates },
      ),
    ).toBe('Ada Lovelace')
  })

  it('keeps the edited record label for a direct contact field', () => {
    const companyTemplates: EntityTemplate[] = [
      { key: 'name', name: 'name', type: 'string', options: ['isValue'] },
      { key: 'phone', name: 'phone', type: 'string', options: ['isPhone'] },
    ]

    expect(
      getCommunicationRecordLabel(
        { name: 'Keller Food Solutions', phone: '+49 30 1234567' },
        companyTemplates,
        ['phone'],
      ),
    ).toBe('Keller Food Solutions')
  })

  it('does not fall back to handles when only reference isValue fields exist', () => {
    expect(
      getCommunicationValueLabel(
        { handle: 7, company: { handle: 5 } },
        [
          {
            key: 'company',
            name: 'company',
            type: 'object',
            isReference: true,
            referenceName: 'company',
            options: ['isValue'],
          },
        ],
        { company: [{ key: 'name', name: 'name', type: 'string', options: ['isValue'] }] },
      ),
    ).toBe('')
  })
})
