import { i18n } from '@/i18n'
import type { AiProviderModelItem, AiProviderTypeItem, PersonItem } from '@/entity/entity'
import { sortSelectOptions } from '@/utils/saplingSelectOptions'
import type {
  CalendarClassificationMapping,
  CalendarSyncSubscription,
  OutlookCalendarCategory,
} from '@/services/api.current.service'

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

export function buildAccountDetails(person?: PersonItem | null): AccountDetailItem[] {
  const age = person?.birthDay ? calculateAge(person.birthDay) : null
  return [
    { key: 'email', icon: 'mdi-mail', value: formatAccountValue(person?.email) },
    { key: 'mobile', icon: 'mdi-cellphone', value: formatAccountValue(person?.mobile) },
    { key: 'phone', icon: 'mdi-phone', value: formatAccountValue(person?.phone) },
    { key: 'birthday', icon: 'mdi-cake-variant', value: formatBirthDay(person?.birthDay) },
    {
      key: 'age',
      icon: 'mdi-account-clock',
      value: age ?? i18n.global.t('global.notAvailable'),
      suffixKey: age != null ? 'global.years' : undefined,
    },
  ]
}

export function buildCalendarSyncDetails(
  subscription?: CalendarSyncSubscription | null,
): AccountDetailItem[] {
  return [
    {
      key: 'lastRunAt',
      icon: 'mdi-calendar-clock-outline',
      value: formatDateTime(subscription?.lastRunAt),
    },
    {
      key: 'lastSuccessAt',
      icon: 'mdi-calendar-check-outline',
      value: formatDateTime(subscription?.lastSuccessAt),
    },
    {
      key: 'lastImportedCount',
      icon: 'mdi-calendar-import-outline',
      value: formatCalendarSyncResult(subscription),
    },
    {
      key: 'lastError',
      icon: 'mdi-alert-circle-outline',
      value: subscription?.lastError || i18n.global.t('global.notAvailable'),
    },
  ]
}

export function buildAccountTabs(): AccountTabItem[] {
  return [
    { key: 'profile', icon: 'mdi-account-outline', label: i18n.global.t('account.profile') },
    {
      key: 'notifications',
      icon: 'mdi-bell-outline',
      label: i18n.global.t('account.notifications'),
    },
    { key: 'sync', icon: 'mdi-sync', label: i18n.global.t('account.synchronizations') },
    { key: 'security', icon: 'mdi-shield-key-outline', label: i18n.global.t('account.security') },
    { key: 'sessions', icon: 'mdi-devices', label: i18n.global.t('account.sessions') },
    {
      key: 'preferences',
      icon: 'mdi-palette-outline',
      label: i18n.global.t('account.preferences'),
    },
    { key: 'songbird', icon: 'mdi-creation-outline', label: i18n.global.t('account.songbird') },
  ]
}

export function createProfileForm(person: PersonItem): ProfileForm {
  return {
    firstName: person.firstName || '',
    lastName: person.lastName || '',
    phone: person.phone || '',
    mobile: person.mobile || '',
    color: person.color || '#4CAF50',
  }
}

export function buildCalendarSyncRangeOptions(): CalendarSyncOption<CalendarSyncRange>[] {
  return [
    { title: i18n.global.t('calendarSyncSubscription.rangeDay'), value: 'day' },
    { title: i18n.global.t('calendarSyncSubscription.rangeWeek'), value: 'week' },
    { title: i18n.global.t('calendarSyncSubscription.rangeMonth'), value: 'month' },
  ]
}

export function buildCalendarSyncIntervalOptions(): CalendarSyncOption<number>[] {
  return [15, 30, 60, 240].map((value) => ({
    title: i18n.global.t(`calendarSyncSubscription.interval${value}`),
    value,
  }))
}

export function appendMissingOutlookCategoryMappings(
  mappings: CalendarClassificationMapping[],
  categories: OutlookCalendarCategory[],
): number {
  const existingNames = new Set(
    mappings.map((mapping) => mapping.externalValue.trim().toLowerCase()),
  )
  let added = 0

  for (const category of categories) {
    const displayName = category.displayName.trim()
    const normalizedName = displayName.toLowerCase()
    if (!displayName || existingNames.has(normalizedName)) {
      continue
    }

    mappings.push({
      externalValue: displayName,
      eventTypeHandle: null,
      eventCategoryHandle: null,
    })
    existingNames.add(normalizedName)
    added += 1
  }

  return added
}

export function mapProviderOptions(providers: AiProviderTypeItem[]): AccountSelectOption<string>[] {
  return sortSelectOptions(
    providers.map((provider) => ({
      title: provider.title || provider.handle || '',
      value: provider.handle || '',
    })),
    (provider) => provider.title,
  )
}

export function mapModelOptions(models: AiProviderModelItem[]): AccountSelectOption<string>[] {
  return sortSelectOptions(
    models.map((model) => ({
      title: model.providerModel ? `${model.title} (${model.providerModel})` : model.title,
      value: model.handle || '',
    })),
    (model) => model.title,
  )
}

export function normalizeHandle(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  return null
}
