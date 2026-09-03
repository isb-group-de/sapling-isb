import { describe, expect, it } from 'vitest'
import type { PersonItem, WorkHourWeekItem } from '@/entity/entity'
import { resolvePersonWorkHours } from '../eventWorkHours'

describe('resolvePersonWorkHours', () => {
  const fallback = {
    monday: { timeFrom: '08:00', timeTo: '17:00' },
  } as unknown as WorkHourWeekItem

  it('uses populated person work hours', () => {
    const personWorkHours = {
      monday: { timeFrom: '09:00', timeTo: '16:00' },
    } as unknown as WorkHourWeekItem
    const person = { workWeek: personWorkHours } as unknown as PersonItem

    expect(resolvePersonWorkHours(person, fallback)).toBe(personWorkHours)
  })

  it('ignores an unpopulated work-week reference and keeps the endpoint fallback', () => {
    const person = { workWeek: { handle: 42 } } as unknown as PersonItem

    expect(resolvePersonWorkHours(person, fallback)).toBe(fallback)
  })

  it('uses populated company work hours when the person has none', () => {
    const companyWorkHours = {
      tuesday: { timeFrom: '08:30', timeTo: '17:30' },
    } as unknown as WorkHourWeekItem
    const person = {
      company: { workWeek: companyWorkHours },
    } as unknown as PersonItem

    expect(resolvePersonWorkHours(person, fallback)).toBe(companyWorkHours)
  })
})
