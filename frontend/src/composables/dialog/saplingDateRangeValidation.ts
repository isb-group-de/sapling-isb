import type { EntityTemplate } from '@/entity/structure'

export type SaplingDateRangePair = {
  start: EntityTemplate
  end: EntityTemplate
}

type OrderedTemplate = {
  template: EntityTemplate
  index: number
}

const UNGROUPED_DATE_RANGE = '__sapling_ungrouped_date_range__'

export function getSaplingDateRangePairs(templates: EntityTemplate[]): SaplingDateRangePair[] {
  const groups = new Map<string, { starts: OrderedTemplate[]; ends: OrderedTemplate[] }>()

  templates.forEach((template, index) => {
    const isStart = template.options?.includes('isDateStart') === true
    const isEnd = template.options?.includes('isDateEnd') === true
    if (!isStart && !isEnd) return

    const groupKey = template.formGroup ?? UNGROUPED_DATE_RANGE
    const group = groups.get(groupKey) ?? { starts: [], ends: [] }
    if (isStart) group.starts.push({ template, index })
    if (isEnd) group.ends.push({ template, index })
    groups.set(groupKey, group)
  })

  const sortByFormOrder = (left: OrderedTemplate, right: OrderedTemplate) =>
    (left.template.formOrder ?? left.index) - (right.template.formOrder ?? right.index)

  return Array.from(groups.values()).flatMap((group) => {
    const starts = [...group.starts].sort(sortByFormOrder)
    const ends = [...group.ends].sort(sortByFormOrder)
    return starts.slice(0, Math.min(starts.length, ends.length)).map((start, index) => ({
      start: start.template,
      end: ends[index].template,
    }))
  })
}

export function findSaplingDateRangePair(
  templates: EntityTemplate[],
  fieldName: string,
): SaplingDateRangePair | null {
  return (
    getSaplingDateRangePairs(templates).find(
      (pair) => pair.start.name === fieldName || pair.end.name === fieldName,
    ) ?? null
  )
}

export function isSaplingDateRangeValid(
  pair: SaplingDateRangePair,
  form: Record<string, unknown>,
): boolean {
  const start = getTemplateTimestamp(pair.start, form)
  const end = getTemplateTimestamp(pair.end, form)
  return start === null || end === null || end >= start
}

/**
 * Preserves the current interval when a generated form changes the start of a
 * metadata-driven date range. The returned values belong to the paired end
 * field and can be applied before the edited start value itself.
 */
export function getSaplingDateRangeEndShift(
  templates: EntityTemplate[],
  form: Record<string, unknown>,
  changedField: string,
  changedValue: unknown,
): Record<string, string> | null {
  const pair = getSaplingDateRangePairs(templates).find(({ start }) =>
    isStartFieldChange(start, changedField),
  )
  if (
    !pair ||
    !hasCompleteTemplateValue(pair.start, form) ||
    !hasCompleteTemplateValue(pair.end, form)
  ) {
    return null
  }

  const previousStart = getTemplateTimestamp(pair.start, form)
  const previousEnd = getTemplateTimestamp(pair.end, form)
  const nextStart = getTemplateTimestamp(pair.start, { ...form, [changedField]: changedValue })
  if (
    previousStart === null ||
    previousEnd === null ||
    nextStart === null ||
    previousEnd < previousStart
  ) {
    return null
  }

  const shiftedEnd = new Date(previousEnd + (nextStart - previousStart))
  if (pair.end.type === 'datetime') {
    return {
      [`${pair.end.name}_date`]: formatLocalDate(shiftedEnd),
      [`${pair.end.name}_time`]: formatLocalTime(shiftedEnd),
    }
  }

  return { [pair.end.name]: formatUtcDate(shiftedEnd) }
}

function getTemplateTimestamp(
  template: EntityTemplate,
  form: Record<string, unknown>,
): number | null {
  const value =
    template.type === 'datetime'
      ? joinLocalDateTime(form[`${template.name}_date`], form[`${template.name}_time`])
      : form[template.name]

  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return null
  }

  const date =
    value instanceof Date
      ? value
      : typeof value === 'string' || typeof value === 'number'
        ? new Date(value)
        : null

  return date && !Number.isNaN(date.getTime()) ? date.getTime() : null
}

function joinLocalDateTime(dateValue: unknown, timeValue: unknown): string | null {
  const date =
    dateValue instanceof Date && !Number.isNaN(dateValue.getTime())
      ? formatLocalDate(dateValue)
      : typeof dateValue === 'string'
        ? dateValue.trim()
        : ''
  if (!date) return null
  const time = typeof timeValue === 'string' ? timeValue.trim() : ''
  return time ? `${date}T${time}` : date
}

function isStartFieldChange(template: EntityTemplate, changedField: string): boolean {
  return template.type === 'datetime'
    ? changedField === `${template.name}_date` || changedField === `${template.name}_time`
    : changedField === template.name
}

function hasCompleteTemplateValue(
  template: EntityTemplate,
  form: Record<string, unknown>,
): boolean {
  if (template.type === 'datetime') {
    return hasValue(form[`${template.name}_date`]) && hasValue(form[`${template.name}_time`])
  }

  return hasValue(form[template.name])
}

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== ''
}

function formatLocalDate(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatLocalTime(value: Date): string {
  const hours = String(value.getHours()).padStart(2, '0')
  const minutes = String(value.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function formatUtcDate(value: Date): string {
  const year = value.getUTCFullYear()
  const month = String(value.getUTCMonth() + 1).padStart(2, '0')
  const day = String(value.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
