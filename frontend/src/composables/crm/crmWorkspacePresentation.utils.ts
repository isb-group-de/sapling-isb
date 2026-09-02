import type { CrmSignal } from '@/components/crm/crmWorkspace.types'
import { normalizeMoney, parseDate } from '@/components/crm/crmWorkspace.utils'

type Translate = (key: string) => string

export function buildContactThresholdOptions(translate: Translate) {
  return [30, 45, 60, 90, 120].map((days) => ({
    title: translate(`crmWorkspace.days${days}`),
    value: days,
  }))
}

export function buildOpportunityHorizonOptions(translate: Translate) {
  return [
    { title: translate('crmWorkspace.allCloseDates'), value: null },
    ...[30, 90, 180, 365].map((days) => ({
      title: translate(`crmWorkspace.days${days}`),
      value: days,
    })),
  ]
}

export function createCrmSignal(
  key: CrmSignal['key'],
  icon: string,
  label: string,
  value: string,
): CrmSignal {
  return { key, icon, label, value }
}

export function formatCrmMoney(value: unknown, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(normalizeMoney(value))
}

export function formatCrmDate(
  value: unknown,
  formatDate: (date: Date) => string,
  fallback: string,
): string {
  const date = parseDate(value)
  return date ? formatDate(date) : fallback
}
