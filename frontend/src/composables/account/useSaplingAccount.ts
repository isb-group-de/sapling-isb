import { computed, onMounted, ref, watch } from 'vue'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import { i18n } from '@/i18n'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import ApiAuthService from '@/services/api.auth.service'
import ApiCurrentService, {
  type CalendarClassificationMapping,
  type CalendarSyncSubscription,
  type CurrentSessionDto,
  type OutlookCalendarCategory,
  type TerminateSessionsResult,
} from '@/services/api.current.service'
import type {
  AiProviderModelItem,
  AiProviderTypeItem,
  EventCategoryItem,
  EventTypeItem,
  WorkHourWeekItem,
} from '@/entity/entity'
import ApiGenericService from '@/services/api.generic.service'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import { useSaplingPreferences } from '@/composables/system/useSaplingPreferences'
import ApiAiService from '@/services/api.ai.service'
import {
  getDefaultModelForProvider,
  getModelProviderHandle,
  resolveRuntimeTarget,
} from '@/components/system/ai-chat/aiChatRuntimeTargets'
import {
  loadSaplingAiPreferences,
  saveSaplingAiPreferences,
  type SaplingAiPreferences,
} from '@/services/ai-preferences.service'
import {
  loadSaplingNotificationPreferences,
  saveSaplingNotificationPreferences,
  type SaplingNotificationPreferences,
} from '@/services/notification-preferences.service'
import {
  WORK_HOUR_DAY_KEYS,
  appendMissingOutlookCategoryMappings,
  calculateAge,
  formatAccountValue,
  formatBirthDay,
  formatCalendarSyncResult,
  formatDateTime,
  getCurrentWeekday,
  mapModelOptions,
  mapProviderOptions,
  normalizeHandle,
  type AccountDetailItem,
  type AccountTab,
  type AccountTabItem,
  type CalendarSyncOption,
  type CalendarSyncRange,
  type ProfileForm,
  type WorkHourRow,
} from './saplingAccount.utils'

export type { AccountTab } from './saplingAccount.utils'

/**
 * Composable function to manage the Sapling Account functionality.
 * Provides state, lifecycle hooks, and methods for managing user account details.
 */
export function useSaplingAccount() {
  //#region State
  const dialog = ref(true)
  const { isLoading } = useTranslationLoader(
    'global',
    'person',
    'login',
    'workHour',
    'workHourWeek',
    'calendarSyncSubscription',
    'eventType',
    'eventCategory',
    'account',
    'navigation',
    'aiChat',
    'ai',
  )

  const showPasswordChange = ref(false)
  const { pushMessage } = useSaplingMessageCenter()
  const { currentLanguage, languageOptions, appearanceActions, setLanguage } =
    useSaplingPreferences()
  const currentPersonStore = useCurrentPersonStore()
  const workHours = ref<WorkHourWeekItem | null>(null)
  const profileForm = ref<ProfileForm>({
    firstName: '',
    lastName: '',
    phone: '',
    mobile: '',
    color: '#4CAF50',
  })
  const isProfileSaving = ref(false)
  const calendarSync = ref<CalendarSyncSubscription | null>(null)
  const isCalendarSyncSaving = ref(false)
  const isOutlookCalendarCategoriesLoading = ref(false)
  const outlookCalendarCategories = ref<OutlookCalendarCategory[]>([])
  const eventTypes = ref<EventTypeItem[]>([])
  const eventCategories = ref<EventCategoryItem[]>([])
  const notificationPreferences = ref<SaplingNotificationPreferences>(
    loadSaplingNotificationPreferences(),
  )
  const isNotificationPreferencesSaving = ref(false)
  const currentSessions = ref<CurrentSessionDto[]>([])
  const isSessionsLoading = ref(false)
  const isSessionsTerminating = ref(false)
  const activeAccountTab = ref<AccountTab>('profile')
  const isAiPreferencesLoading = ref(false)
  const isAiPreferencesSaving = ref(false)
  const aiProviderConfigs = ref<AiProviderTypeItem[]>([])
  const aiModelConfigs = ref<AiProviderModelItem[]>([])
  const transcriptionProviderConfigs = ref<AiProviderTypeItem[]>([])
  const transcriptionModelConfigs = ref<AiProviderModelItem[]>([])
  const speechProviderConfigs = ref<AiProviderTypeItem[]>([])
  const speechModelConfigs = ref<AiProviderModelItem[]>([])
  const aiPreferences = ref<SaplingAiPreferences>(loadSaplingAiPreferences())
  const currentWeekday = getCurrentWeekday()

  const accountDetails = computed<AccountDetailItem[]>(() => {
    const person = currentPersonStore.person
    const age = person?.birthDay ? calculateAge(person.birthDay) : null

    return [
      {
        key: 'email',
        icon: 'mdi-mail',
        value: formatAccountValue(person?.email),
      },
      {
        key: 'mobile',
        icon: 'mdi-cellphone',
        value: formatAccountValue(person?.mobile),
      },
      {
        key: 'phone',
        icon: 'mdi-phone',
        value: formatAccountValue(person?.phone),
      },
      {
        key: 'birthday',
        icon: 'mdi-cake-variant',
        value: formatBirthDay(person?.birthDay),
      },
      {
        key: 'age',
        icon: 'mdi-account-clock',
        value: age ?? i18n.global.t('global.notAvailable'),
        suffixKey: age != null ? 'global.years' : undefined,
      },
    ]
  })

  const workHourRows = computed<WorkHourRow[]>(() =>
    WORK_HOUR_DAY_KEYS.map((dayKey) => ({
      key: dayKey,
      timeFrom: workHours.value?.[dayKey]?.timeFrom || i18n.global.t('global.notAvailable'),
      timeTo: workHours.value?.[dayKey]?.timeTo || i18n.global.t('global.notAvailable'),
    })),
  )

  const calendarSyncRangeOptions = computed<CalendarSyncOption<CalendarSyncRange>[]>(() => [
    { title: i18n.global.t('calendarSyncSubscription.rangeDay'), value: 'day' },
    { title: i18n.global.t('calendarSyncSubscription.rangeWeek'), value: 'week' },
    { title: i18n.global.t('calendarSyncSubscription.rangeMonth'), value: 'month' },
  ])

  const calendarSyncIntervalOptions = computed<CalendarSyncOption<number>[]>(() => [
    { title: i18n.global.t('calendarSyncSubscription.interval15'), value: 15 },
    { title: i18n.global.t('calendarSyncSubscription.interval30'), value: 30 },
    { title: i18n.global.t('calendarSyncSubscription.interval60'), value: 60 },
    { title: i18n.global.t('calendarSyncSubscription.interval240'), value: 240 },
  ])

  const calendarSyncEventTypeOptions = computed<CalendarSyncOption<string>[]>(() =>
    eventTypes.value.map((item) => ({
      title: item.title,
      value: item.handle,
    })),
  )

  const calendarSyncEventCategoryOptions = computed<CalendarSyncOption<string>[]>(() =>
    eventCategories.value.map((item) => ({
      title: item.title,
      value: item.handle,
    })),
  )

  const googleCalendarColorOptions = computed<CalendarSyncOption<string>[]>(() =>
    Array.from({ length: 11 }, (_, index) => ({
      title: i18n.global.t('calendarSyncSubscription.googleColor', {
        id: index + 1,
      }),
      value: String(index + 1),
    })),
  )

  const outlookCalendarCategoryOptions = computed<CalendarSyncOption<string>[]>(() => {
    const names = new Set(outlookCalendarCategories.value.map((category) => category.displayName))
    for (const mapping of calendarSync.value?.classificationMappings ?? []) {
      if (mapping.externalValue.trim()) {
        names.add(mapping.externalValue.trim())
      }
    }
    return Array.from(names)
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
      .map((name) => ({ title: name, value: name }))
  })

  const calendarSyncDetails = computed<AccountDetailItem[]>(() => {
    const subscription = calendarSync.value

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
  })

  const accountTabs = computed<AccountTabItem[]>(() => [
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
  ])

  const aiProviderOptions = computed(() => mapProviderOptions(aiProviderConfigs.value))
  const aiModelOptions = computed(() =>
    mapModelOptions(
      aiModelConfigs.value.filter(
        (item) => getModelProviderHandle(item) === aiPreferences.value.chatProviderHandle,
      ),
    ),
  )
  const transcriptionProviderOptions = computed(() =>
    mapProviderOptions(transcriptionProviderConfigs.value),
  )
  const transcriptionModelOptions = computed(() =>
    mapModelOptions(
      transcriptionModelConfigs.value.filter(
        (item) => getModelProviderHandle(item) === aiPreferences.value.transcriptionProviderHandle,
      ),
    ),
  )
  const speechProviderOptions = computed(() => mapProviderOptions(speechProviderConfigs.value))
  const speechModelOptions = computed(() =>
    mapModelOptions(
      speechModelConfigs.value.filter(
        (item) => getModelProviderHandle(item) === aiPreferences.value.speechProviderHandle,
      ),
    ),
  )
  //#endregion

  //#region Lifecycle
  /**
   * Loads the current account payload as soon as the dialog is mounted.
   */
  onMounted(async () => {
    await Promise.all([
      currentPersonStore.fetchCurrentPerson(),
      loadWorkHours(),
      loadCalendarSync(),
      loadCalendarClassificationOptions(),
      loadCurrentSessions(),
      loadAiPreferences(),
    ])
  })

  watch(
    () => currentPersonStore.person,
    () => {
      syncProfileForm()
    },
    { immediate: true },
  )
  //#endregion

  //#region Methods
  /**
   * Opens the password change dialog.
   */
  function changePassword() {
    showPasswordChange.value = true
  }

  /**
   * Formats a nullable account value for direct UI rendering.
   */

  /**
   * Logs the user out by calling the backend logout endpoint and redirecting to the login page.
   */
  async function logout() {
    await ApiAuthService.logout()
    window.location.href = '/login'
  }

  /**
   * Loads the work hours of the current user from the backend.
   */
  async function loadWorkHours() {
    workHours.value = await ApiCurrentService.getWorkWeek()
  }

  function syncProfileForm() {
    const person = currentPersonStore.person

    if (!person) {
      return
    }

    profileForm.value = {
      firstName: person.firstName || '',
      lastName: person.lastName || '',
      phone: person.phone || '',
      mobile: person.mobile || '',
      color: person.color || '#4CAF50',
    }
  }

  async function saveProfile() {
    isProfileSaving.value = true

    try {
      await ApiCurrentService.updateProfile({
        firstName: profileForm.value.firstName,
        lastName: profileForm.value.lastName,
        phone: profileForm.value.phone,
        mobile: profileForm.value.mobile,
        color: profileForm.value.color,
      })
      await currentPersonStore.fetchCurrentPerson(true)
      syncProfileForm()
      pushMessage('success', 'account.profileSaved', '', 'account')
    } finally {
      isProfileSaving.value = false
    }
  }

  /**
   * Loads the current user's automatic Outlook or Google import settings.
   */
  async function loadCalendarSync() {
    calendarSync.value = await ApiCurrentService.getCalendarSync()
  }

  async function loadCalendarClassificationOptions() {
    const [typeResponse, categoryResponse] = await Promise.all([
      ApiGenericService.find<EventTypeItem>('eventType', {
        limit: 100,
        page: 1,
      }),
      ApiGenericService.find<EventCategoryItem>('eventCategory', {
        limit: 100,
        page: 1,
      }),
    ])
    eventTypes.value = typeResponse.data
    eventCategories.value = categoryResponse.data
  }

  /**
   * Persists the current user's automatic Outlook or Google import settings.
   */
  async function saveCalendarSync() {
    if (!calendarSync.value) {
      return
    }

    isCalendarSyncSaving.value = true

    try {
      calendarSync.value = await ApiCurrentService.updateCalendarSync({
        isActive: calendarSync.value.isActive,
        syncRange: calendarSync.value.syncRange,
        intervalMinutes: calendarSync.value.intervalMinutes,
        defaultEventTypeHandle: calendarSync.value.defaultEventTypeHandle,
        defaultEventCategoryHandle: calendarSync.value.defaultEventCategoryHandle,
        classificationMappings: calendarSync.value.classificationMappings,
      })
      pushMessage('success', 'calendarSyncSubscription.saveSuccess', '', 'calendarSyncSubscription')
    } finally {
      isCalendarSyncSaving.value = false
    }
  }

  async function loadOutlookCalendarCategories() {
    if (!calendarSync.value || calendarSync.value.provider !== 'azure') {
      return
    }

    const subscription = calendarSync.value
    isOutlookCalendarCategoriesLoading.value = true
    try {
      const categories = await ApiCurrentService.getOutlookCalendarCategories()
      outlookCalendarCategories.value = categories
      appendMissingOutlookCategoryMappings(subscription.classificationMappings, categories)

      pushMessage(
        'success',
        'calendarSyncSubscription.outlookCategoriesLoaded',
        '',
        'calendarSyncSubscription',
      )
    } finally {
      isOutlookCalendarCategoriesLoading.value = false
    }
  }

  function addCalendarClassificationMapping() {
    if (!calendarSync.value) {
      return
    }

    const mapping: CalendarClassificationMapping = {
      externalValue: calendarSync.value.provider === 'google' ? '1' : '',
      eventTypeHandle: null,
      eventCategoryHandle: null,
    }
    calendarSync.value.classificationMappings.push(mapping)
  }

  function removeCalendarClassificationMapping(index: number) {
    calendarSync.value?.classificationMappings.splice(index, 1)
  }

  function saveNotificationPreferenceSelection() {
    isNotificationPreferencesSaving.value = true

    try {
      saveSaplingNotificationPreferences(notificationPreferences.value)
      pushMessage('success', 'account.notificationPreferencesSaved', '', 'account')
    } finally {
      isNotificationPreferencesSaving.value = false
    }
  }

  async function loadCurrentSessions() {
    isSessionsLoading.value = true

    try {
      currentSessions.value = await ApiCurrentService.getSessions()
    } finally {
      isSessionsLoading.value = false
    }
  }

  async function terminateOtherSessions() {
    isSessionsTerminating.value = true

    try {
      const result: TerminateSessionsResult = await ApiCurrentService.terminateOtherSessions()
      currentSessions.value = result.sessions
      pushMessage('success', 'account.sessionsTerminated', '', 'account')
    } finally {
      isSessionsTerminating.value = false
    }
  }

  async function loadAiPreferences() {
    isAiPreferencesLoading.value = true

    try {
      const [
        providers,
        models,
        transcriptionProviders,
        transcriptionModels,
        speechProviders,
        speechModels,
      ] = await Promise.all([
        ApiAiService.listProviders(),
        ApiAiService.listModels(),
        ApiAiService.listTranscriptionProviders(),
        ApiAiService.listTranscriptionModels(),
        ApiAiService.listSpeechProviders(),
        ApiAiService.listSpeechModels(),
      ])

      aiProviderConfigs.value = providers
      aiModelConfigs.value = models
      transcriptionProviderConfigs.value = transcriptionProviders
      transcriptionModelConfigs.value = transcriptionModels
      speechProviderConfigs.value = speechProviders
      speechModelConfigs.value = speechModels
      syncAiPreferenceTargets()
    } finally {
      isAiPreferencesLoading.value = false
    }
  }

  function updateAiProvider(value: unknown) {
    const providerHandle = normalizeHandle(value)

    aiPreferences.value.chatProviderHandle = providerHandle
    aiPreferences.value.chatModelHandle =
      getDefaultModelForProvider(
        aiModelConfigs.value,
        providerHandle,
        aiPreferences.value.chatModelHandle,
      )?.handle ?? null
  }

  function updateAiModel(value: unknown) {
    const model =
      aiModelConfigs.value.find((item) => item.handle === normalizeHandle(value)) ?? null

    aiPreferences.value.chatProviderHandle = getModelProviderHandle(model)
    aiPreferences.value.chatModelHandle = model?.handle ?? null
  }

  function updateTranscriptionProvider(value: unknown) {
    const providerHandle = normalizeHandle(value)

    aiPreferences.value.transcriptionProviderHandle = providerHandle
    aiPreferences.value.transcriptionModelHandle =
      getDefaultModelForProvider(
        transcriptionModelConfigs.value,
        providerHandle,
        aiPreferences.value.transcriptionModelHandle,
      )?.handle ?? null
  }

  function updateTranscriptionModel(value: unknown) {
    const model =
      transcriptionModelConfigs.value.find((item) => item.handle === normalizeHandle(value)) ?? null

    aiPreferences.value.transcriptionProviderHandle = getModelProviderHandle(model)
    aiPreferences.value.transcriptionModelHandle = model?.handle ?? null
  }

  function updateSpeechProvider(value: unknown) {
    const providerHandle = normalizeHandle(value)

    aiPreferences.value.speechProviderHandle = providerHandle
    aiPreferences.value.speechModelHandle =
      getDefaultModelForProvider(
        speechModelConfigs.value,
        providerHandle,
        aiPreferences.value.speechModelHandle,
      )?.handle ?? null
  }

  function updateSpeechModel(value: unknown) {
    const model =
      speechModelConfigs.value.find((item) => item.handle === normalizeHandle(value)) ?? null

    aiPreferences.value.speechProviderHandle = getModelProviderHandle(model)
    aiPreferences.value.speechModelHandle = model?.handle ?? null
  }

  function saveAiPreferenceSelection() {
    isAiPreferencesSaving.value = true

    try {
      saveSaplingAiPreferences(aiPreferences.value)
      pushMessage('success', 'account.aiPreferencesSaved', '', 'account')
    } finally {
      isAiPreferencesSaving.value = false
    }
  }

  /**
   * Maps the native JavaScript weekday to the Monday-first representation used in the UI.
   */

  function syncAiPreferenceTargets() {
    const chatTarget = resolveRuntimeTarget({
      providerConfigs: aiProviderConfigs.value,
      modelConfigs: aiModelConfigs.value,
      requestedProviderHandle: aiPreferences.value.chatProviderHandle,
      requestedModelHandle: aiPreferences.value.chatModelHandle,
      preferredModelHandle: aiPreferences.value.chatModelHandle,
    })
    const transcriptionTarget = resolveRuntimeTarget({
      providerConfigs: transcriptionProviderConfigs.value,
      modelConfigs: transcriptionModelConfigs.value,
      requestedProviderHandle: aiPreferences.value.transcriptionProviderHandle,
      requestedModelHandle: aiPreferences.value.transcriptionModelHandle,
      preferredModelHandle: aiPreferences.value.transcriptionModelHandle,
    })
    const speechTarget = resolveRuntimeTarget({
      providerConfigs: speechProviderConfigs.value,
      modelConfigs: speechModelConfigs.value,
      requestedProviderHandle: aiPreferences.value.speechProviderHandle,
      requestedModelHandle: aiPreferences.value.speechModelHandle,
      preferredModelHandle: aiPreferences.value.speechModelHandle,
    })

    aiPreferences.value = {
      chatProviderHandle: chatTarget.providerHandle,
      chatModelHandle: chatTarget.modelHandle,
      transcriptionProviderHandle: transcriptionTarget.providerHandle,
      transcriptionModelHandle: transcriptionTarget.modelHandle,
      speechProviderHandle: speechTarget.providerHandle,
      speechModelHandle: speechTarget.modelHandle,
    }
  }

  //#endregion

  //#region Return
  return {
    isLoading,
    showPasswordChange,
    currentPersonStore,
    workHours,
    profileForm,
    isProfileSaving,
    calendarSync,
    notificationPreferences,
    isNotificationPreferencesSaving,
    currentSessions,
    isSessionsLoading,
    isSessionsTerminating,
    activeAccountTab,
    accountTabs,
    calendarSyncRangeOptions,
    calendarSyncIntervalOptions,
    calendarSyncDetails,
    calendarSyncEventTypeOptions,
    calendarSyncEventCategoryOptions,
    googleCalendarColorOptions,
    outlookCalendarCategoryOptions,
    isCalendarSyncSaving,
    isOutlookCalendarCategoriesLoading,
    currentLanguage,
    languageOptions,
    appearanceActions,
    aiPreferences,
    aiProviderOptions,
    aiModelOptions,
    transcriptionProviderOptions,
    transcriptionModelOptions,
    speechProviderOptions,
    speechModelOptions,
    isAiPreferencesLoading,
    isAiPreferencesSaving,
    dialog,
    currentWeekday,
    accountDetails,
    workHourRows,
    changePassword,
    calculateAge,
    saveProfile,
    saveCalendarSync,
    loadOutlookCalendarCategories,
    addCalendarClassificationMapping,
    removeCalendarClassificationMapping,
    saveNotificationPreferenceSelection,
    loadCurrentSessions,
    terminateOtherSessions,
    formatDateTime,
    setLanguage,
    updateAiProvider,
    updateAiModel,
    updateTranscriptionProvider,
    updateTranscriptionModel,
    updateSpeechProvider,
    updateSpeechModel,
    saveAiPreferenceSelection,
    logout,
  }
  //#endregion
}
