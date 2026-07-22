import { describe, expect, it } from 'vitest'
import type { CrmCompany, CrmOpportunity } from '../crmWorkspace.types'
import {
  companyValue,
  diffInDays,
  getOpportunityUrgencyTone,
  getRelationHandle,
  isCustomerCompany,
  isOpportunityOpen,
  isOpportunityWithinHorizon,
  normalizeMoney,
  normalizeProbability,
  parseDate,
  relationLabel,
  startOfDay,
  updateLatestDate,
} from '../crmWorkspace.utils'

describe('CRM workspace utilities', () => {
  it('normalizes relation handles and labels without assuming one relation shape', () => {
    expect(getRelationHandle({ handle: 42, title: 'Customer' })).toBe(42)
    expect(getRelationHandle('customer')).toBe('customer')
    expect(relationLabel({ name: 'Northwind' })).toBe('Northwind')
    expect(relationLabel(null)).toBe('')
  })

  it('recognizes active opportunities and closed result or stage states', () => {
    expect(isOpportunityOpen({ type: { isClosed: false } } as CrmOpportunity)).toBe(true)
    expect(isOpportunityOpen({ resultStatus: { isClosed: true } } as CrmOpportunity)).toBe(false)
    expect(isOpportunityOpen({ type: { isClosed: true } } as CrmOpportunity)).toBe(false)
  })

  it('filters opportunities by their close-date horizon', () => {
    const today = new Date('2026-07-22T10:00:00.000Z')

    expect(
      isOpportunityWithinHorizon(
        { closeDate: '2026-08-15T00:00:00.000Z' } as CrmOpportunity,
        30,
        today,
      ),
    ).toBe(true)
    expect(
      isOpportunityWithinHorizon(
        { closeDate: '2026-09-30T00:00:00.000Z' } as CrmOpportunity,
        30,
        today,
      ),
    ).toBe(false)
    expect(isOpportunityWithinHorizon({ closeDate: null } as CrmOpportunity, 30, today)).toBe(false)
    expect(isOpportunityWithinHorizon({ closeDate: null } as CrmOpportunity, null, today)).toBe(
      true,
    )
  })

  it('recognizes customer segments and prioritizes recurring account value', () => {
    const company = {
      segment: { handle: 'strategic_customer' },
      annualRecurringRevenue: 120_000,
      contractValue: 80_000,
    } as CrmCompany

    expect(isCustomerCompany(company)).toBe(true)
    expect(companyValue(company)).toBe(120_000)
  })

  it('bounds probability and safely normalizes monetary values', () => {
    expect(normalizeMoney('1200.5')).toBe(1200.5)
    expect(normalizeMoney('invalid')).toBe(0)
    expect(normalizeProbability(120)).toBe(100)
    expect(normalizeProbability(-5)).toBe(0)
  })

  it('tracks only the latest valid contact date', () => {
    const dates = new Map<string, Date>()
    const latest = new Date('2026-07-15T08:00:00.000Z')

    updateLatestDate(dates, '42', new Date('2026-07-14T08:00:00.000Z'))
    updateLatestDate(dates, '42', latest)
    updateLatestDate(dates, '42', null)

    expect(dates.get('42')).toBe(latest)
    expect(diffInDays(startOfDay(latest), startOfDay(new Date('2026-07-13')))).toBe(2)
    expect(parseDate('invalid')).toBeNull()
  })

  it('marks opportunities without or near a close date as urgent', () => {
    expect(getOpportunityUrgencyTone({ closeDate: null } as CrmOpportunity)).toBe('warning')
    expect(
      getOpportunityUrgencyTone({ closeDate: new Date(Date.now() + 86_400_000) } as CrmOpportunity),
    ).toBe('error')
  })
})
