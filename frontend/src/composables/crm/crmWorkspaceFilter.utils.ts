import type { CrmCockpitKey, CrmCompany, CrmOpportunity } from '@/components/crm/crmWorkspace.types'
import {
  getRelationHandle,
  isOpportunityWithinHorizon,
  normalizeText,
} from '@/components/crm/crmWorkspace.utils'

export function matchesCrmSearch(needle: string, ...values: unknown[]): boolean {
  return !needle || values.some((value) => normalizeText(value).includes(needle))
}

export function matchesCrmResponsible(
  selectedHandle: string | null,
  ...values: unknown[]
): boolean {
  return (
    !selectedHandle ||
    values.some((value) => String(getRelationHandle(value) ?? '') === selectedHandle)
  )
}

export function matchesCrmSegment(
  company: CrmCompany,
  cockpit: CrmCockpitKey,
  selectedHandle: string | null,
): boolean {
  return (
    cockpit === 'sales' ||
    !selectedHandle ||
    String(getRelationHandle(company.segment) ?? '') === selectedHandle
  )
}

export function matchesCrmOpportunityHorizon(
  opportunity: CrmOpportunity,
  cockpit: CrmCockpitKey,
  horizonDays: number | null,
): boolean {
  return cockpit !== 'sales' || isOpportunityWithinHorizon(opportunity, horizonDays)
}
