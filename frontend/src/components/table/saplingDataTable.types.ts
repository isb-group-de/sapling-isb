export interface SaplingDataColumn<T> {
  key: string
  title: string
  value?: (item: T) => unknown
  sortable?: boolean
  align?: 'start' | 'center' | 'end'
}

export function sortDataRows<T>(
  items: readonly T[],
  value: (item: T) => unknown,
  direction: 'asc' | 'desc',
  locale: string,
): T[] {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' })
  return [...items].sort((left, right) => {
    const a = value(left)
    const b = value(right)
    // Missing values stay at the end in either direction.
    if (a == null || a === '') return b == null || b === '' ? 0 : 1
    if (b == null || b === '') return -1
    const result =
      typeof a === 'number' && typeof b === 'number'
        ? a - b
        : a instanceof Date && b instanceof Date
          ? a.getTime() - b.getTime()
          : collator.compare(String(a), String(b))
    return direction === 'asc' ? result : -result
  })
}
