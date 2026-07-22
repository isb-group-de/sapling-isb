import type {
  CrmCompany,
  CrmOpportunity,
  CrmRelationHandle,
  CrmWorkspaceItem,
} from './crmWorkspace.types'

export function relationObject(value: unknown): CrmRelationHandle | null {
  return typeof value === 'object' && value !== null ? (value as CrmRelationHandle) : null
}

export function getRelationHandle(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }
  return relationObject(value)?.handle ?? null
}

export function relationLabel(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }
  const relation = relationObject(value)
  return relation?.title || relation?.name || ''
}

export function normalizeText(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim().toLocaleLowerCase()
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).toLocaleLowerCase()
  }
  return ''
}

export function normalizeMoney(value: unknown): number {
  const numberValue = Number(value ?? 0)
  return Number.isFinite(numberValue) ? numberValue : 0
}

export function normalizeProbability(value: unknown): number {
  const numberValue = Number(value ?? 0)
  return Number.isFinite(numberValue) ? Math.min(100, Math.max(0, numberValue)) : 0
}

export function parseDate(value: unknown): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

export function startOfDay(value: Date): Date {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

export function diffInDays(left: Date, right: Date): number {
  return Math.floor((left.getTime() - right.getTime()) / 86_400_000)
}

export function updateLatestDate(map: Map<string, Date>, key: string, value: Date | null): void {
  if (!value) return
  const current = map.get(key)
  if (!current || value > current) map.set(key, value)
}

export function isOpportunityOpen(opportunity: CrmOpportunity): boolean {
  if (opportunity.isActive === false) return false
  if (relationObject(opportunity.resultStatus)?.isClosed === true) return false
  return relationObject(opportunity.type)?.isClosed !== true
}

export function isOpportunityWithinHorizon(
  opportunity: CrmOpportunity,
  horizonDays: number | null,
  today = new Date(),
): boolean {
  if (!horizonDays) return true

  const closeDate = parseDate(opportunity.closeDate)
  if (!closeDate) return false

  const horizon = startOfDay(today)
  horizon.setDate(horizon.getDate() + horizonDays)
  return startOfDay(closeDate) <= horizon
}

export function isCustomerCompany(company: CrmCompany): boolean {
  const segmentHandle = String(getRelationHandle(company.segment) ?? '')
  return ['customer', 'strategic_customer'].includes(segmentHandle)
}

export function companyValue(company: CrmCompany): number {
  return normalizeMoney(
    company.annualRecurringRevenue ?? company.contractValue ?? company.monthlyRecurringRevenue,
  )
}

export function getOpportunityUrgencyTone(opportunity: CrmOpportunity): CrmWorkspaceItem['tone'] {
  const closeDate = parseDate(opportunity.closeDate)
  if (!closeDate) return 'warning'

  const days = diffInDays(startOfDay(closeDate), startOfDay(new Date()))
  if (days <= 7) return 'error'
  return days <= 21 ? 'warning' : 'info'
}
