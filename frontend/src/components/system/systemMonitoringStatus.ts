export function maximumActiveCollectorGapSeconds(
  collectorStatus: Record<string, unknown> | null,
): number {
  const instances = collectorStatus?.instances
  if (!Array.isArray(instances)) return 0

  const gaps = instances
    .filter((item) => {
      const instance = item as Record<string, unknown>
      return instance.status === 'active' && instance.enabled === true
    })
    .map((item) => Number((item as Record<string, unknown>).gapSeconds ?? 0))
    .filter(Number.isFinite)

  return Math.max(0, ...gaps)
}
