import { useI18n } from 'vue-i18n'
import type { Customer360Section } from '@/services/api.customer360.service'

type RelatedBadgeTone = 'neutral' | 'info' | 'success' | 'warning'
export interface RelatedBadge {
  text: string
  tone: RelatedBadgeTone
}
export interface RelatedDetail {
  label: string
  value: string
  icon?: string
}
export interface RelatedPresentation {
  eyebrow: string
  title: string
  description: string
  badges: RelatedBadge[]
  details: RelatedDetail[]
  items: string[]
}

export function textValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

export function relationLabel(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const item = value as Record<string, unknown>
  return (
    textValue(item.name) ||
    textValue(item.title) ||
    textValue(item.description) ||
    [textValue(item.firstName), textValue(item.lastName)].filter(Boolean).join(' ')
  )
}

export function useCustomer360RelatedPresentation(recordHandle: () => string) {
  const { t, d, n, locale } = useI18n()
  const formatDate = (value: string | null | undefined) =>
    value ? d(new Date(value), 'short') : t('global.notAvailable')
  const money = (value: number) =>
    new Intl.NumberFormat(locale.value, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(value)
  const hours = (value: number) => t('customer360.hours', { count: n(value) })
  const recordLabel = (item: Record<string, unknown>) =>
    textValue(item.title) ||
    textValue(item.name) ||
    textValue(item.subject) ||
    [textValue(item.firstName), textValue(item.lastName)].filter(Boolean).join(' ') ||
    `#${textValue(item.handle)}`
  const objectValue = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  const objectArray = (value: unknown): Array<Record<string, unknown>> =>
    Array.isArray(value)
      ? value.filter((entry): entry is Record<string, unknown> => Boolean(objectValue(entry)))
      : []
  const badge = (text: string, tone: RelatedBadgeTone): RelatedBadge | null =>
    text ? { text, tone } : null
  const compactBadges = (values: Array<RelatedBadge | null>): RelatedBadge[] =>
    values.filter((value): value is RelatedBadge => value != null)
  const detail = (label: string, value: string, icon?: string): RelatedDetail | null =>
    value ? { label, value, icon } : null
  const compactDetails = (values: Array<RelatedDetail | null>): RelatedDetail[] =>
    values.filter((value): value is RelatedDetail => value != null)
  const previewText = (value: unknown, maxLength = 180): string => {
    const text = textValue(value)
      .replace(/[#*_>`~\[\]]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text
  }
  const formatOptionalDate = (value: unknown): string => {
    const raw = textValue(value)
    return raw ? formatDate(raw) : ''
  }
  const firstText = (...values: string[]): string => values.find(Boolean) ?? ''
  const optionalMoney = (value: unknown): string => {
    const amount = Number(value)
    return Number.isFinite(amount) ? money(amount) : ''
  }
  const optionalPercent = (value: unknown): string => {
    const amount = Number(value)
    return Number.isFinite(amount) ? `${n(amount)} %` : ''
  }
  const optionalHours = (value: unknown): string => {
    const amount = Number(value)
    return Number.isFinite(amount) ? hours(amount) : ''
  }
  const closedLabel = () => (locale.value.toLowerCase().startsWith('de') ? 'Geschlossen' : 'Closed')
  const activeLabel = () => (locale.value.toLowerCase().startsWith('de') ? 'Aktiv' : 'Active')
  const openStateLabel = (value: unknown) =>
    value === false ? closedLabel() : t('ticketStatus.isOpen')

  function relatedPresentation(
    section: Customer360Section,
    item: Record<string, unknown>,
  ): RelatedPresentation {
    const base: RelatedPresentation = {
      eyebrow: '',
      title: recordLabel(item),
      description: '',
      badges: [],
      details: [],
      items: [],
    }
    if (section === 'tickets') {
      const status = objectValue(item.status)
      const statusLabel = relationLabel(status)
      const stateLabel = status ? openStateLabel(status.isOpen) : ''
      base.eyebrow = textValue(item.number) || `#${textValue(item.handle)}`
      base.description = previewText(item.problemDescription)
      base.badges = compactBadges([
        badge(statusLabel, status?.isOpen === false ? 'neutral' : 'info'),
        badge(
          statusLabel === stateLabel ? '' : stateLabel,
          status?.isOpen === false ? 'neutral' : 'success',
        ),
        badge(relationLabel(item.priority), 'warning'),
      ])
      base.details = compactDetails([
        detail(
          t('ticket.startDate'),
          firstText(formatOptionalDate(item.startDate), formatOptionalDate(item.createdAt)),
          'mdi-calendar-plus',
        ),
        detail(
          t('global.updatedAt'),
          firstText(
            formatOptionalDate(item.updatedAt),
            formatOptionalDate(item.resolvedAt),
            formatOptionalDate(item.endDate),
          ),
          'mdi-update',
        ),
        detail(
          t('ticket.assigneePerson'),
          relationLabel(item.assigneePerson),
          'mdi-account-outline',
        ),
        detail(
          t('ticket.deadlineDate'),
          firstText(
            formatOptionalDate(item.deadlineDate),
            formatOptionalDate(item.resolutionDueAt),
          ),
          'mdi-timer-alert-outline',
        ),
      ])
      return base
    }
    if (section === 'opportunities') {
      base.eyebrow = textValue(item.number) || `#${textValue(item.handle)}`
      base.description = previewText(item.description)
      base.badges = compactBadges([
        badge(relationLabel(item.type), 'info'),
        badge(relationLabel(item.resultStatus), item.isActive === false ? 'neutral' : 'success'),
        item.isActive === false ? badge(closedLabel(), 'neutral') : null,
      ])
      base.details = compactDetails([
        detail(
          t('salesOpportunity.expectedRevenue'),
          optionalMoney(item.expectedRevenue),
          'mdi-cash-multiple',
        ),
        detail(
          t('salesOpportunity.probability'),
          optionalPercent(item.probability),
          'mdi-percent-outline',
        ),
        detail(
          t('salesOpportunity.closeDate'),
          formatOptionalDate(item.closeDate),
          'mdi-calendar-check-outline',
        ),
        detail(t('global.updatedAt'), formatOptionalDate(item.updatedAt), 'mdi-update'),
      ])
      const nextStep = previewText(item.nextStep, 120)
      if (nextStep) base.items.push(`${t('salesOpportunity.nextStep')}: ${nextStep}`)
      return base
    }
    if (section === 'effortEstimates') {
      base.eyebrow = `#${textValue(item.handle)}`
      base.description = previewText(item.requirementsMarkdown)
      base.badges = compactBadges([badge(relationLabel(item.status), 'info')])
      base.details = compactDetails([
        detail(
          t('customer360.estimates'),
          optionalHours(item.totalEstimatedHours),
          'mdi-timer-sand',
        ),
        detail(
          t('effortEstimate.expectedCompletionDate'),
          formatOptionalDate(item.expectedCompletionDate),
          'mdi-calendar-clock',
        ),
        detail(t('global.updatedAt'), formatOptionalDate(item.updatedAt), 'mdi-update'),
        detail(
          t('customer360.section.opportunities'),
          relationLabel(item.salesOpportunity),
          'mdi-chart-line',
        ),
      ])
      base.items = objectArray(item.positions)
        .slice(0, 4)
        .map((position) =>
          [relationLabel(position) || recordLabel(position), optionalHours(position.estimatedHours)]
            .filter(Boolean)
            .join(' · '),
        )
      return base
    }
    if (section === 'contracts') {
      base.eyebrow = relationLabel(item.serviceLevel) || `#${textValue(item.handle)}`
      base.description = previewText(item.description)
      base.badges = compactBadges([
        badge(
          item.isActive === false ? closedLabel() : activeLabel(),
          item.isActive === false ? 'neutral' : 'success',
        ),
        badge(relationLabel(item.slaPolicy), 'info'),
      ])
      base.details = compactDetails([
        detail(t('contract.startDate'), formatOptionalDate(item.startDate), 'mdi-calendar-start'),
        detail(t('contract.endDate'), formatOptionalDate(item.endDate), 'mdi-calendar-end'),
        detail(
          t('contract.annualIncludedHours'),
          optionalHours(item.annualIncludedHours),
          'mdi-clock-check-outline',
        ),
        detail(
          t('contract.nextServiceDate'),
          formatOptionalDate(item.nextServiceDate),
          'mdi-calendar-wrench',
        ),
      ])
      base.items = objectArray(item.products)
        .slice(0, 5)
        .map((product) => relationLabel(product) || recordLabel(product))
        .filter(Boolean)
      return base
    }
    if (section === 'contacts') {
      base.eyebrow = [relationLabel(item.jobTitle), relationLabel(item.jobFunction)]
        .filter(Boolean)
        .join(' · ')
      base.badges = compactBadges([
        badge(relationLabel(item.decisionRole), 'info'),
        item.isActive === false ? badge(closedLabel(), 'neutral') : null,
      ])
      base.details = compactDetails([
        detail(t('person.email'), textValue(item.email), 'mdi-email-outline'),
        detail(t('person.phone'), textValue(item.phone), 'mdi-phone-outline'),
        detail(t('person.mobile'), textValue(item.mobile), 'mdi-cellphone'),
        detail(
          t('person.department'),
          relationLabel(item.department),
          'mdi-office-building-outline',
        ),
      ])
      return base
    }
    if (section === 'relationships') {
      const source = objectValue(item.sourceCompany)
      const target = objectValue(item.targetCompany)
      const counterpart = String(source?.handle ?? '') === recordHandle() ? target : source
      base.eyebrow = relationLabel(item.type)
      base.title =
        relationLabel(counterpart) ||
        [relationLabel(source), relationLabel(target)].filter(Boolean).join(' ↔ ') ||
        `#${textValue(item.handle)}`
      base.description = previewText(item.description)
      base.details = compactDetails([
        detail(t('companyRelationship.sourceCompany'), relationLabel(source), 'mdi-domain'),
        detail(t('companyRelationship.targetCompany'), relationLabel(target), 'mdi-domain'),
        detail(t('global.updatedAt'), formatOptionalDate(item.updatedAt), 'mdi-update'),
      ])
      return base
    }
    base.eyebrow = relationLabel(item.type)
    base.description = previewText(item.description)
    base.details = compactDetails([
      detail(t('global.createdAt'), formatOptionalDate(item.createdAt), 'mdi-calendar-plus'),
      detail(t('global.updatedAt'), formatOptionalDate(item.updatedAt), 'mdi-update'),
    ])
    return base
  }

  return { relatedPresentation, closedLabel, formatDate }
}
