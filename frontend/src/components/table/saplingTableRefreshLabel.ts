import type { SaplingTableAutoRefreshInterval } from '@/composables/table/useSaplingTableAutoRefresh'

type TranslateRefreshLabel = (key: string, named?: { count: number }) => string

export function getTableRefreshIntervalLabel(
  intervalMinutes: SaplingTableAutoRefreshInterval,
  translate: TranslateRefreshLabel,
): string {
  return intervalMinutes === 1
    ? translate('global.refreshEveryMinute')
    : translate('global.refreshEveryMinutes', { count: intervalMinutes })
}
