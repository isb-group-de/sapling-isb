import type { SaplingGenericItem } from '@/entity/entity'
import type { DvelopHealthCheckStatus } from '@/services/api.dvelop.service'

export function dvelopHealthStatusColor(status?: DvelopHealthCheckStatus): string {
  if (status === 'success') return 'success'
  if (status === 'warning') return 'warning'
  if (status === 'error') return 'error'
  return 'default'
}

export function dvelopHealthStatusIcon(status?: DvelopHealthCheckStatus): string {
  if (status === 'success') return 'mdi-check-circle-outline'
  if (status === 'warning') return 'mdi-alert-circle-outline'
  if (status === 'error') return 'mdi-close-circle-outline'
  return 'mdi-circle-outline'
}

export function capitalizeDvelopKey(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function formatDvelopReference(
  value: SaplingGenericItem | string | number | null | undefined,
  fallback: string,
): string {
  if (!value) return fallback
  if (typeof value !== 'object') return String(value)

  const title = typeof value.title === 'string' ? value.title : null
  const dvelopId = typeof value.dvelopId === 'string' ? value.dvelopId : null
  if (title && dvelopId && title !== dvelopId) return `${title} (${dvelopId})`
  return title ?? dvelopId ?? String(value.handle ?? fallback)
}

export function formatDvelopDateTime(
  value: string | Date | null | undefined,
  fallback: string,
): string {
  if (!value) return fallback
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return fallback
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}
