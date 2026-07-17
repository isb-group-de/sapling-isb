import { i18n } from '@/i18n'
import type { AiProviderModelItem, AiProviderTypeItem } from '@/entity/entity'
import type { CalendarSyncSubscription } from '@/services/api.current.service'

export interface AccountDetailItem {
  key: string
  icon: string
  value: number | string
  suffixKey?: string
}

export type WorkHourDayKey =
  'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export interface WorkHourRow {
  key: WorkHourDayKey
  timeFrom: string
  timeTo: string
}

export type CalendarSyncRange = 'day' | 'week' | 'month'

export interface CalendarSyncOption<T> {
  title: string
  value: T
}

export type AccountTab =
  'profile' | 'notifications' | 'sync' | 'security' | 'sessions' | 'preferences' | 'songbird'

export interface AccountTabItem {
  key: AccountTab
  icon: string
  label: string
}

export interface AccountSelectOption<T> {
  title: string
  value: T
}

export interface ProfileForm {
  firstName: string
  lastName: string
  phone: string
  mobile: string
  color: string
}

export const WORK_HOUR_DAY_KEYS: WorkHourDayKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

export function formatAccountValue(value?: string | null): string {
  return value || i18n.global.t('global.notAvailable')
}

/**
 * Formats the birthday for the account detail list.
 */
export function formatBirthDay(birthDay?: Date | string | null): string {
  if (!birthDay) {
    return i18n.global.t('global.notAvailable')
  }

  return new Date(birthDay).toLocaleDateString()
}

/**
 * Calculates the age of the user based on their birth date.
 * @param birthDay - The birth date of the user as a Date, string, or null.
 * @returns The calculated age or null if the birth date is invalid.
 */
export function calculateAge(birthDay: Date | string | null): number | null {
  if (!birthDay) return null
  const birth = new Date(birthDay)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

export function getCurrentWeekday(): number {
  const jsDay = new Date().getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) {
    return i18n.global.t('global.notAvailable')
  }

  return new Date(value).toLocaleString()
}

export function formatCalendarSyncResult(subscription?: CalendarSyncSubscription | null): string {
  if (!subscription?.lastSuccessAt) {
    return i18n.global.t('global.notAvailable')
  }

  return `${subscription.lastImportedCount} / ${subscription.lastCreatedCount} / ${subscription.lastUpdatedCount} / ${subscription.lastSkippedCount}`
}

export function mapProviderOptions(providers: AiProviderTypeItem[]): AccountSelectOption<string>[] {
  return providers.map((provider) => ({
    title: provider.title || provider.handle || '',
    value: provider.handle || '',
  }))
}

export function mapModelOptions(models: AiProviderModelItem[]): AccountSelectOption<string>[] {
  return models.map((model) => ({
    title: model.providerModel ? `${model.title} (${model.providerModel})` : model.title,
    value: model.handle || '',
  }))
}

export function normalizeHandle(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  return null
}
