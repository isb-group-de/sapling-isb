import { describe, expect, it } from 'vitest'

import { buildWorkSearchFilter } from '../useSaplingFilterWork'

describe('buildWorkSearchFilter', () => {
  it('matches whitespace-separated person terms across different fields', () => {
    expect(
      buildWorkSearchFilter('  Max   Mustermann  ', ['firstName', 'lastName', 'email']),
    ).toEqual({
      $and: [
        {
          $or: [
            { firstName: { $ilike: '%Max%' } },
            { lastName: { $ilike: '%Max%' } },
            { email: { $ilike: '%Max%' } },
          ],
        },
        {
          $or: [
            { firstName: { $ilike: '%Mustermann%' } },
            { lastName: { $ilike: '%Mustermann%' } },
            { email: { $ilike: '%Mustermann%' } },
          ],
        },
      ],
    })
  })

  it('keeps the employee company restriction alongside every search term', () => {
    expect(
      buildWorkSearchFilter('Max Mustermann', ['firstName', 'lastName'], { company: 23 }),
    ).toEqual({
      $and: [
        { company: 23 },
        {
          $or: [{ firstName: { $ilike: '%Max%' } }, { lastName: { $ilike: '%Max%' } }],
        },
        {
          $or: [
            { firstName: { $ilike: '%Mustermann%' } },
            { lastName: { $ilike: '%Mustermann%' } },
          ],
        },
      ],
    })
  })

  it('returns only the required filter for an empty employee search', () => {
    expect(buildWorkSearchFilter('   ', ['firstName', 'lastName'], { company: 23 })).toEqual({
      company: 23,
    })
  })
})
