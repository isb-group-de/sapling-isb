export type EmailCondition = {
  key: string
  handle?: string | number
  observedField: string
  oldValue?: string | null
  newValue?: string | null
  groupOrder: number
  sortOrder?: number
}

export type EmailConditionGroup = {
  groupOrder: number
  conditions: Array<{ condition: EmailCondition; index: number }>
}

export function normalizeEmailConditions(
  value: unknown,
  createKey: () => string,
): EmailCondition[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object',
    )
    .map((entry, index) => ({
      key: createKey(),
      handle: normalizeHandle(entry.handle),
      observedField:
        typeof (entry.observedField || entry.field) === 'string'
          ? String(entry.observedField || entry.field)
          : '',
      oldValue: normalizeNullableString(entry.oldValue),
      newValue: normalizeNullableString(entry.newValue),
      groupOrder: normalizeConditionGroupOrder(entry.groupOrder),
      sortOrder: typeof entry.sortOrder === 'number' ? entry.sortOrder : index,
    }))
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
}

export function normalizeConditionGroupOrder(value: unknown): number {
  const numericValue = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isInteger(numericValue) && numericValue >= 0 ? numericValue : 0
}

export function normalizeOptionalEmailConditionValue(value: unknown): string | null {
  const normalized = normalizeNullableString(value)
  return normalized && normalized.trim().length > 0 ? normalized : null
}

export function normalizeEmailConditionValue(value: unknown): string | null {
  return value === null || value === undefined || value === '' ? null : String(value)
}

export function normalizeEmailConditionString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeNullableString(value: unknown): string | null {
  return value === null || value === undefined || value === '' ? null : String(value)
}

function normalizeHandle(value: unknown): string | number | undefined {
  return typeof value === 'string' || typeof value === 'number' ? value : undefined
}
