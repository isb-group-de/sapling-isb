import { describe, expect, it } from 'vitest'
import type { EntityTemplate } from '@/entity/structure'
import {
  findSaplingDateRangePair,
  getSaplingDateRangeEndShift,
  getSaplingDateRangePairs,
  isSaplingDateRangeValid,
} from '../saplingDateRangeValidation'

const field = (
  name: string,
  options: EntityTemplate['options'],
  formGroup: string | null,
  formOrder: number,
  type = 'datetime',
): EntityTemplate =>
  ({
    key: name,
    name,
    type,
    options,
    formGroup,
    formOrder,
  }) as EntityTemplate

describe('saplingDateRangeValidation', () => {
  const templates = [
    field('startDate', ['isDateStart'], 'schedule', 100),
    field('endDate', ['isDateEnd'], 'schedule', 200),
    field('firstRespondedAt', ['isDateStart'], 'sla', 100),
    field('resolvedAt', ['isDateEnd'], 'sla', 200),
    field('publishedAt', ['isDateStart'], 'lifecycle', 100),
  ]

  it('pairs start and end markers only inside the same form group', () => {
    expect(
      getSaplingDateRangePairs(templates).map((pair) => [pair.start.name, pair.end.name]),
    ).toEqual([
      ['startDate', 'endDate'],
      ['firstRespondedAt', 'resolvedAt'],
    ])
    expect(findSaplingDateRangePair(templates, 'publishedAt')).toBeNull()
  })

  it('rejects a datetime end before the local start', () => {
    const pair = findSaplingDateRangePair(templates, 'endDate')!
    expect(
      isSaplingDateRangeValid(pair, {
        startDate_date: '2026-09-01',
        startDate_time: '11:00',
        endDate_date: '2026-09-01',
        endDate_time: '10:00',
      }),
    ).toBe(false)
  })

  it('validates calendar-picker Date values used by datetime fields', () => {
    const pair = findSaplingDateRangePair(templates, 'endDate')!
    expect(
      isSaplingDateRangeValid(pair, {
        startDate_date: new Date(2026, 8, 2),
        startDate_time: '11:00',
        endDate_date: '2026-09-01',
        endDate_time: '12:00',
      }),
    ).toBe(false)
  })

  it('accepts equal datetimes and incomplete optional ranges', () => {
    const pair = findSaplingDateRangePair(templates, 'startDate')!
    expect(
      isSaplingDateRangeValid(pair, {
        startDate_date: '2026-09-01',
        startDate_time: '10:00',
        endDate_date: '2026-09-01',
        endDate_time: '10:00',
      }),
    ).toBe(true)
    expect(isSaplingDateRangeValid(pair, { startDate_date: '2026-09-01' })).toBe(true)
  })

  it('validates date-only fields with the same metadata contract', () => {
    const pair = {
      start: field('validFrom', ['isDateStart'], 'validity', 100, 'DateType'),
      end: field('validUntil', ['isDateEnd'], 'validity', 200, 'DateType'),
    }
    expect(
      isSaplingDateRangeValid(pair, {
        validFrom: '2026-09-02',
        validUntil: '2026-09-01',
      }),
    ).toBe(false)
  })

  it('shifts a datetime end by the same delta when the start date changes', () => {
    expect(
      getSaplingDateRangeEndShift(
        templates,
        {
          startDate_date: '2026-09-01',
          startDate_time: '10:00',
          endDate_date: '2026-09-01',
          endDate_time: '12:00',
        },
        'startDate_date',
        '2026-09-02',
      ),
    ).toEqual({
      endDate_date: '2026-09-02',
      endDate_time: '12:00',
    })
  })

  it('shifts the end when the date picker emits a Date object', () => {
    expect(
      getSaplingDateRangeEndShift(
        templates,
        {
          startDate_date: '2026-09-01',
          startDate_time: '10:00',
          endDate_date: '2026-09-01',
          endDate_time: '12:00',
        },
        'startDate_date',
        new Date(2026, 8, 2),
      ),
    ).toEqual({
      endDate_date: '2026-09-02',
      endDate_time: '12:00',
    })
  })

  it('shifts a datetime end when only the start time changes', () => {
    expect(
      getSaplingDateRangeEndShift(
        templates,
        {
          startDate_date: '2026-09-01',
          startDate_time: '10:00',
          endDate_date: '2026-09-01',
          endDate_time: '12:00',
        },
        'startDate_time',
        '11:30',
      ),
    ).toEqual({
      endDate_date: '2026-09-01',
      endDate_time: '13:30',
    })
  })

  it('shifts date-only ranges without introducing a time component', () => {
    const dateTemplates = [
      field('validFrom', ['isDateStart'], 'validity', 100, 'DateType'),
      field('validUntil', ['isDateEnd'], 'validity', 200, 'DateType'),
    ]

    expect(
      getSaplingDateRangeEndShift(
        dateTemplates,
        { validFrom: '2026-09-01', validUntil: '2026-09-04' },
        'validFrom',
        '2026-09-03',
      ),
    ).toEqual({ validUntil: '2026-09-06' })
  })

  it('does not shift incomplete or already invalid ranges', () => {
    expect(
      getSaplingDateRangeEndShift(
        templates,
        { startDate_date: '2026-09-01', endDate_date: '2026-09-01', endDate_time: '12:00' },
        'startDate_date',
        '2026-09-02',
      ),
    ).toBeNull()
    expect(
      getSaplingDateRangeEndShift(
        templates,
        {
          startDate_date: '2026-09-02',
          startDate_time: '10:00',
          endDate_date: '2026-09-01',
          endDate_time: '12:00',
        },
        'startDate_date',
        '2026-09-03',
      ),
    ).toBeNull()
  })
})
