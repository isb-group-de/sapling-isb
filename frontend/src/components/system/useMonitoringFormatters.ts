import { useI18n } from 'vue-i18n'

export function useMonitoringFormatters() {
  const { t, n, locale } = useI18n()
  function number(value: unknown): string {
    const numeric = Number(value ?? 0)
    return n(Number.isFinite(numeric) ? numeric : 0, { maximumFractionDigits: 1 })
  }

  function bytes(value: unknown): string {
    const numeric = Number(value ?? 0)
    if (!Number.isFinite(numeric) || numeric <= 0) return '0 B'
    const units = ['B', 'kB', 'MB', 'GB', 'TB']
    const unitIndex = Math.min(Math.floor(Math.log(numeric) / Math.log(1024)), units.length - 1)
    return `${number(numeric / 1024 ** unitIndex)} ${units[unitIndex]}`
  }

  function compactNumber(value: unknown): string {
    return new Intl.NumberFormat(locale.value, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(Number(value ?? 0))
  }

  function percent(value: unknown): string {
    return `${number(value)} %`
  }

  function dateTime(value: string | null | undefined): string {
    if (!value) return t('global.notAvailable')
    return new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }).format(
      new Date(value),
    )
  }

  return { number, bytes, compactNumber, percent, dateTime }
}
