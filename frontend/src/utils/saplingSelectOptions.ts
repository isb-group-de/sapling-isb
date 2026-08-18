/**
 * Compares user-facing option labels consistently across searchable selects.
 * Numeric fragments are ordered naturally and casing does not affect the result.
 */
export function compareSelectOptionLabels(left: string, right: string): number {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

/**
 * Returns a sorted copy so source catalogs and deliberately ordered option lists
 * remain unchanged.
 */
export function sortSelectOptions<T>(items: readonly T[], getLabel: (item: T) => string): T[] {
  return [...items].sort((left, right) =>
    compareSelectOptionLabels(getLabel(left), getLabel(right)),
  )
}
