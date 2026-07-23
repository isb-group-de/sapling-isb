import { describe, expect, it } from 'vitest'
import type { GenericUpdateConflictField } from '@/services/api.generic.service'
import { buildUpdateConflictResolutionPayload } from '../saplingDialogUpdateConflict.utils'

describe('buildUpdateConflictResolutionPayload', () => {
  it('only submits fields selected from the attempted version', () => {
    const fields: GenericUpdateConflictField[] = [
      {
        property: 'name',
        baseValue: 'Old name',
        currentValue: 'Current name',
        attemptedValue: 'My name',
        changedInCurrent: true,
        changedInAttempt: true,
        conflict: true,
      },
      {
        property: 'city',
        baseValue: 'Berlin',
        currentValue: 'Hamburg',
        attemptedValue: 'Berlin',
        changedInCurrent: true,
        changedInAttempt: false,
        conflict: false,
      },
    ]

    expect(
      buildUpdateConflictResolutionPayload(fields, {
        name: 'attempted',
        city: 'current',
      }),
    ).toEqual({
      name: 'My name',
    })
  })

  it('does not copy system fields from the current record into the update payload', () => {
    const fields: GenericUpdateConflictField[] = [
      {
        property: 'name',
        currentValue: 'Current name',
        attemptedValue: 'My name',
        changedInCurrent: true,
        changedInAttempt: true,
        conflict: true,
      },
    ]

    const payload = buildUpdateConflictResolutionPayload(fields, {
      name: 'attempted',
    })

    expect(payload).toEqual({ name: 'My name' })
    expect(payload).not.toHaveProperty('handle')
    expect(payload).not.toHaveProperty('createdAt')
    expect(payload).not.toHaveProperty('updatedAt')
  })
})
