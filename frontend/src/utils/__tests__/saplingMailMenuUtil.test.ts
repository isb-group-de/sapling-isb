import { describe, expect, it } from 'vitest'
import type { EntityTemplate } from '@/entity/structure'
import {
  buildCustomerContactMailActions,
  buildMailMenuActions,
  getCustomerCompanyHandle,
} from '@/utils/saplingMailMenuUtil'

describe('saplingMailMenuUtil', () => {
  it('uses a person name instead of exposing the email address as the record action label', () => {
    const actions = buildMailMenuActions(
      [{ name: 'creatorPersonEmail', options: ['isMail'] } as EntityTemplate],
      {
        creatorPersonEmail: 'heike.wolber@example.com',
        creatorPersonFirstName: 'Heike',
        creatorPersonLastName: 'Wolber',
      },
    )

    expect(actions).toEqual([
      expect.objectContaining({
        email: 'heike.wolber@example.com',
        recipientName: 'Heike Wolber',
        source: 'record',
      }),
    ])
  })

  it('resolves only company references marked as customer-side metadata', () => {
    const templates = [
      {
        name: 'assigneeCompany',
        referenceName: 'company',
        options: ['isCompany'],
      },
      {
        name: 'creatorCompany',
        referenceName: 'company',
        options: ['isCompany', 'isCustomer'],
      },
    ] as EntityTemplate[]

    expect(
      getCustomerCompanyHandle(templates, {
        assigneeCompany: { handle: 10 },
        creatorCompany: { handle: 42 },
      }),
    ).toBe(42)
  })

  it('builds active customer contacts with their department metadata', () => {
    const actions = buildCustomerContactMailActions([
      {
        handle: 1,
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        isActive: true,
        department: {
          handle: 'information_technology',
          description: 'IT',
          icon: 'mdi-laptop',
        },
      },
      {
        handle: 2,
        firstName: 'No',
        lastName: 'Department',
        email: 'without-department@example.com',
        isActive: true,
      },
      {
        handle: 3,
        firstName: 'Inactive',
        lastName: 'Contact',
        email: 'inactive@example.com',
        isActive: false,
      },
    ])

    expect(actions).toEqual([
      expect.objectContaining({
        email: 'ada@example.com',
        recipientName: 'Ada Lovelace',
        department: {
          handle: 'information_technology',
          title: 'IT',
          icon: 'mdi-laptop',
        },
        source: 'customerContact',
      }),
    ])
  })
})
