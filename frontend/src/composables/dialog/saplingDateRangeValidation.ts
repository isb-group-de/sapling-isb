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
  if (typeof dateValue !== 'string' || dateValue.trim() === '') return null
  const date = dateValue.trim()
  const time = typeof timeValue === 'string' ? timeValue.trim() : ''
  return time ? `${date}T${time}` : date
}
