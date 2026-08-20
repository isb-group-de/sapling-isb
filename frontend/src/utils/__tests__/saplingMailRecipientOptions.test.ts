import { describe, expect, it } from 'vitest'
import type { EntityTemplate } from '@/entity/structure'
import {
  buildMailRecipientOptions,
  buildMailRecipientTitle,
  getContextCompanyHandles,
  getContextCompanyTemplates,
} from '@/utils/saplingMailRecipientOptions'

describe('saplingMailRecipientOptions', () => {
  const templates = [
    {
      name: 'handle',
      isPrimaryKey: true,
      options: [],
    },
    {
      name: 'assigneeCompany',
      isReference: true,
      referenceName: 'company',
      options: ['isCompany'],
    },
    {
      name: 'creatorCompany',
      isReference: true,
      referenceName: 'company',
      options: ['isCompany', 'isCustomer'],
    },
    {
      name: 'unmarkedCompany',
      isReference: true,
      referenceName: 'company',
      options: [],
    },
    {
      name: 'restrictedCompany',
      isReference: true,
      referenceName: 'company',
      options: ['isCompany'],
      fieldAccess: { allowRead: false, allowInsert: false, allowUpdate: false },
    },
  ] as EntityTemplate[]

  it('uses every company reference marked with isCompany regardless of customer metadata', () => {
    expect(getContextCompanyTemplates(templates).map((template) => template.name)).toEqual([
      'assigneeCompany',
      'creatorCompany',
    ])

    expect(
      getContextCompanyHandles(templates, {
        assigneeCompany: { handle: 10 },
        creatorCompany: 42,
        unmarkedCompany: { handle: 99 },
        restrictedCompany: { handle: 100 },
      }),
    ).toEqual([10, 42])
  })

  it('uses the current record handle for a company entity and removes duplicate handles', () => {
    const companyTemplates = [
      {
        name: 'handle',
        isPrimaryKey: true,
        options: ['isCompany'],
      },
    ] as EntityTemplate[]

    expect(getContextCompanyHandles(companyTemplates, undefined, 17)).toEqual([17])
    expect(getContextCompanyHandles(companyTemplates, { handle: '17' }, 17)).toEqual(['17'])
  })

  it('sorts active contacts by company and then by person name', () => {
    const options = buildMailRecipientOptions(
      [
        {
          firstName: 'Ada',
          lastName: 'Alpha',
          email: 'ada@example.com',
          company: { handle: 2, name: 'Beta AG' },
          department: { description: 'Support' },
        },
        {
          firstName: 'Zoë',
          lastName: 'Zimmer',
          email: 'zoe@example.com',
          company: { handle: 1, name: 'Acme GmbH' },
          department: { description: 'Entwicklung' },
        },
        {
          firstName: 'Inactive',
          lastName: 'Contact',
          email: 'inactive@example.com',
          isActive: false,
        },
      ],
      'de',
    )

    expect(options.map((option) => option.name)).toEqual(['Zoë Zimmer', 'Ada Alpha'])
    expect(buildMailRecipientTitle(options[0])).toBe(
      'Zoë Zimmer (Acme GmbH, Entwicklung) – zoe@example.com',
    )
  })

  it('places the current company first and prefers it when duplicate emails exist', () => {
    const options = buildMailRecipientOptions(
      [
        {
          firstName: 'Ada',
          lastName: 'Other',
          email: 'shared@example.com',
          company: { handle: 1, name: 'Acme GmbH' },
        },
        {
          firstName: 'Zoe',
          lastName: 'Current',
          email: 'SHARED@example.com',
          company: { handle: 2, name: 'Beta AG' },
        },
      ],
      'de',
      2,
    )

    expect(options).toEqual([
      expect.objectContaining({
        email: 'SHARED@example.com',
        name: 'Zoe Current',
        companyHandle: 2,
        companyName: 'Beta AG',
        isCurrentCompany: true,
      }),
    ])
  })

  it('deduplicates email addresses case-insensitively after sorting', () => {
    expect(
      buildMailRecipientOptions([
        { firstName: 'Zora', lastName: 'Zulu', email: 'TEAM@example.com' },
        { firstName: 'Ada', lastName: 'Alpha', email: 'team@example.com' },
      ]),
    ).toEqual([
      {
        email: 'team@example.com',
        name: 'Ada Alpha',
        companyHandle: null,
        companyName: '',
        departmentName: '',
        isCurrentCompany: false,
      },
    ])
  })
})
