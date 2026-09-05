<template>
  <!-- Dialog container for the account -->
  <SaplingDialog
    v-if="dialog"
    v-model="dialog"
    persistent
    size="xl"
    @keydown.esc.stop.prevent="handleClose"
  >
    <SaplingDialogCard class="sapling-account-dialog" :tilt="false" :close="handleClose">
      <SaplingDialogShell
        fill-shell
        body-class="sapling-account-dialog__body"
        :show-divider="false"
      >
        <template #hero>
          <SaplingDialogHero
            v-if="isLoading || !currentPersonStore.loaded"
            loading
            :loading-stats-count="2"
          />
          <SaplingDialogHero
            v-else
            :eyebrow="$t('login.account')"
            :title="accountTitle"
            :subtitle="accountSubtitle"
          >
            <template #title-trailing>
              <v-btn
                icon="mdi-help-circle-outline"
                variant="text"
                size="small"
                :aria-label="$t('global.contextualHelp')"
                :title="$t('global.contextualHelp')"
                @click="openProfileContextHelp"
              />
            </template>
          </SaplingDialogHero>
        </template>

        <template #body>
          <div
            v-if="isLoading || !currentPersonStore.loaded"
            class="sapling-account-dialog__content"
          >
            <div class="sapling-account-dialog__summary-grid">
              <section class="sapling-account-dialog__details">
                <v-skeleton-loader
                  elevation="12"
                  type="list-item-two-line, list-item-two-line, list-item-two-line"
                />
              </section>
              <section class="sapling-account-dialog__workhours">
                <v-skeleton-loader elevation="12" type="table-heading, table-tbody" />
              </section>
            </div>
          </div>

          <div v-else-if="currentPersonStore.person" class="sapling-account-dialog__content">
            <div class="sapling-account-center">
              <v-tabs
                v-model="activeAccountTab"
                direction="vertical"
                mandatory
                class="sapling-account-center__tabs"
              >
                <v-tab
                  v-for="tab in accountTabs"
                  :key="tab.key"
                  :value="tab.key"
                  class="sapling-account-center__tab"
                  :aria-label="tab.label"
                  :title="tab.label"
                >
                  <v-icon :icon="tab.icon" />
                  <span class="sapling-account-center__tab-label">{{ tab.label }}</span>
                </v-tab>
              </v-tabs>

              <v-window v-model="activeAccountTab" class="sapling-account-center__panels">
                <v-window-item value="profile" class="sapling-account-center__panel">
                  <div class="sapling-account-dialog__summary-grid">
                    <section class="sapling-account-dialog__details">
                      <v-list density="comfortable">
                        <v-list-item v-for="detail in accountDetails" :key="detail.key">
                          <div class="sapling-account-dialog__detail-row">
                            <v-icon color="primary">{{ detail.icon }}</v-icon>
                            <span class="sapling-account-dialog__detail-value">
                              {{ detail.value }}
                              <template v-if="detail.suffixKey && detail.value !== '-'">
                                {{ $t(detail.suffixKey) }}
                              </template>
                            </span>
                          </div>
                        </v-list-item>
                      </v-list>
                    </section>
                    <SaplingAccountWorkHours
                      v-if="workHours"
                      :work-hour-rows="workHourRows"
                      :current-weekday="currentWeekday"
                    />
                    <section
                      class="sapling-account-dialog__panel-stack sapling-account-dialog__profile-edit"
                    >
                      <div class="sapling-account-dialog__section-heading">
                        <v-icon color="primary">mdi-account-edit-outline</v-icon>
                        <span>{{ $t('account.editProfile') }}</span>
                      </div>
                      <div class="sapling-account-dialog__profile-grid">
                        <SaplingTextField
                          v-model="profileForm.firstName"
                          density="comfortable"
                          variant="outlined"
                          hide-details
                          autocomplete="off"
                          :label="$t('person.firstName')"
                        />
                        <SaplingTextField
                          v-model="profileForm.lastName"
                          density="comfortable"
                          variant="outlined"
                          hide-details
                          autocomplete="off"
                          :label="$t('person.lastName')"
                        />
                        <SaplingTextField
                          v-model="profileForm.phone"
                          density="comfortable"
                          variant="outlined"
                          hide-details
                          autocomplete="off"
                          :label="$t('person.phone')"
                        />
                        <SaplingTextField
                          v-model="profileForm.mobile"
                          density="comfortable"
                          variant="outlined"
                          hide-details
                          autocomplete="off"
                          :label="$t('person.mobile')"
                        />
                        <SaplingTextField
                          v-model="profileForm.color"
                          density="comfortable"
                          variant="outlined"
                          hide-details
                          type="color"
                          autocomplete="off"
                          :label="$t('person.color')"
                        />
                      </div>
                      <v-btn
                        color="primary"
                        variant="flat"
                        prepend-icon="mdi-content-save-outline"
                        :loading="isProfileSaving"
                        @click="saveProfile"
                      >
                        {{ $t('account.saveProfile') }}
                      </v-btn>
                    </section>
                  </div>
                </v-window-item>

                <v-window-item value="notifications" class="sapling-account-center__panel">
                  <SaplingAccountNotificationPanel
                    v-model="notificationPreferences"
                    :is-saving="isNotificationPreferencesSaving"
                    @save="saveNotificationPreferenceSelection"
                  />
                </v-window-item>

                <v-window-item value="sync" class="sapling-account-center__panel">
                  <section v-if="calendarSync" class="sapling-account-dialog__calendar-sync">
                    <div class="sapling-account-dialog__section-heading">
                      <v-icon color="primary">mdi-calendar-sync-outline</v-icon>
                      <span>{{ $t('calendarSyncSubscription.calendarSyncSubscription') }}</span>
                    </div>
                    <template v-if="calendarSync.isAvailable">
                      <div class="sapling-account-dialog__sync-controls">
                        <SaplingSwitch
                          v-model="calendarSync.isActive"
                          color="primary"
                          hide-details
                          inset
                          :label="$t('calendarSyncSubscription.isActive')"
                        />
                        <SaplingStaticSelect
                          v-model="calendarSync.syncRange"
                          :items="calendarSyncRangeOptions"
                          :label="$t('calendarSyncSubscription.syncRange')"
                        />
                        <SaplingStaticSelect
                          v-model="calendarSync.intervalMinutes"
                          :items="calendarSyncIntervalOptions"
                          :label="$t('calendarSyncSubscription.intervalMinutes')"
                        />
                        <v-btn
                          color="primary"
                          variant="flat"
                          prepend-icon="mdi-content-save-outline"
                          :loading="isCalendarSyncSaving"
                          @click="saveCalendarSync"
                        >
                          {{ $t('calendarSyncSubscription.save') }}
                        </v-btn>
                      </div>
                      <v-divider />
                      <div class="sapling-account-dialog__section-heading">
                        <v-icon color="primary">mdi-tune-variant</v-icon>
                        <span>{{ $t('calendarSyncSubscription.classificationMapping') }}</span>
                      </div>
                      <p class="text-body-2 text-medium-emphasis">
                        {{
                          $t(
                            calendarSync.provider === 'google'
                              ? 'calendarSyncSubscription.googleMappingHint'
                              : 'calendarSyncSubscription.azureMappingHint',
                          )
                        }}
                      </p>
                      <div class="sapling-account-dialog__sync-defaults">
                        <SaplingStaticSelect
                          v-model="calendarSync.defaultEventTypeHandle"
                          :items="calendarSyncEventTypeOptions"
                          :label="$t('calendarSyncSubscription.defaultEventType')"
                        />
                        <SaplingStaticSelect
                          v-model="calendarSync.defaultEventCategoryHandle"
                          :items="calendarSyncEventCategoryOptions"
                          :label="$t('calendarSyncSubscription.defaultEventCategory')"
                        />
                      </div>
                      <div
                        v-if="calendarSync.provider === 'azure'"
                        class="sapling-account-dialog__mapping-import"
                      >
                        <v-btn
                          variant="tonal"
                          prepend-icon="mdi-microsoft-outlook"
                          :loading="isOutlookCalendarCategoriesLoading"
                          @click="loadOutlookCalendarCategories"
                        >
                          {{ $t('calendarSyncSubscription.loadOutlookCategories') }}
                        </v-btn>
                        <span class="text-caption text-medium-emphasis">
                          {{ $t('calendarSyncSubscription.loadOutlookCategoriesHint') }}
                        </span>
                      </div>
                      <div class="sapling-account-dialog__mapping-list">
                        <div
                          v-for="(mapping, index) in calendarSync.classificationMappings"
                          :key="index"
                          class="sapling-account-dialog__mapping-row"
                        >
                          <SaplingAutocomplete
                            v-if="calendarSync.provider === 'google'"
                            v-model="mapping.externalValue"
                            :items="googleCalendarColorOptions"
                            :label="$t('calendarSyncSubscription.externalValue')"
                            density="comfortable"
                            variant="outlined"
                            hide-details
                          />
                          <SaplingCombobox
                            v-else
                            v-model="mapping.externalValue"
                            :items="outlookCalendarCategoryOptions"
                            :label="$t('calendarSyncSubscription.externalValue')"
                            density="comfortable"
                            variant="outlined"
                            hide-details
                          />
                          <SaplingAutocomplete
                            v-model="mapping.eventTypeHandle"
                            :items="calendarSyncEventTypeOptions"
                            :label="$t('calendarSyncSubscription.eventType')"
                            density="comfortable"
                            variant="outlined"
                            clearable
                            hide-details
                          />
                          <SaplingAutocomplete
                            v-model="mapping.eventCategoryHandle"
                            :items="calendarSyncEventCategoryOptions"
                            :label="$t('calendarSyncSubscription.eventCategory')"
                            density="comfortable"
                            variant="outlined"
                            clearable
                            hide-details
                          />
                          <v-btn
                            icon="mdi-delete-outline"
                            variant="text"
                            color="error"
                            :aria-label="$t('calendarSyncSubscription.removeMapping')"
                            @click="removeCalendarClassificationMapping(index)"
                          />
                        </div>
                        <v-btn
                          variant="tonal"
                          prepend-icon="mdi-plus"
                          class="sapling-account-dialog__mapping-add"
                          @click="addCalendarClassificationMapping"
                        >
                          {{ $t('calendarSyncSubscription.addMapping') }}
                        </v-btn>
                      </div>
                      <v-list density="compact" class="sapling-account-dialog__sync-list">
                        <v-list-item v-for="detail in calendarSyncDetails" :key="detail.key">
                          <div class="sapling-account-dialog__detail-row">
                            <v-icon color="primary">{{ detail.icon }}</v-icon>
                            <span class="sapling-account-dialog__detail-value">
                              {{ detail.value }}
                            </span>
                          </div>
                        </v-list-item>
                      </v-list>
                    </template>
                    <div v-else class="sapling-account-dialog__sync-unavailable">
                      {{ $t('calendarSyncSubscription.notAvailable') }}
                    </div>
                  </section>
                </v-window-item>

                <v-window-item value="security" class="sapling-account-center__panel">
                  <section class="sapling-account-dialog__panel-stack">
                    <SaplingPasskeyManager v-if="isSaplingAccount" />
                    <v-btn
                      color="primary"
                      variant="tonal"
                      prepend-icon="mdi-form-textbox-password"
                      @click="changePassword"
                    >
                      {{ $t('login.changePassword') }}
                    </v-btn>
                  </section>
                </v-window-item>

                <v-window-item value="sessions" class="sapling-account-center__panel">
                  <SaplingAccountSessionPanel
                    :sessions="currentSessions"
                    :loading="isSessionsLoading"
                    :terminating="isSessionsTerminating"
                    :format-date-time="formatDateTime"
                    @refresh="loadCurrentSessions"
                    @terminate="terminateOtherSessions"
                  />
                </v-window-item>

                <v-window-item value="preferences" class="sapling-account-center__panel">
                  <SaplingAccountPreferencesPanel
                    :current-language="currentLanguage"
                    :language-options="languageOptions"
                    :appearance-actions="appearanceActions"
                    @select-language="setLanguage"
                  />
                </v-window-item>

                <v-window-item value="songbird" class="sapling-account-center__panel">
                  <SaplingAccountSongbirdPanel
                    :preferences="aiPreferences"
                    :loading="isAiPreferencesLoading"
                    :saving="isAiPreferencesSaving"
                    :ai-provider-options="aiProviderOptions"
                    :ai-model-options="aiModelOptions"
                    :transcription-provider-options="transcriptionProviderOptions"
                    :transcription-model-options="transcriptionModelOptions"
                    :speech-provider-options="speechProviderOptions"
                    :speech-model-options="speechModelOptions"
                    @update-ai-provider="updateAiProvider"
                    @update-ai-model="updateAiModel"
                    @update-transcription-provider="updateTranscriptionProvider"
                    @update-transcription-model="updateTranscriptionModel"
                    @update-speech-provider="updateSpeechProvider"
                    @update-speech-model="updateSpeechModel"
                    @save="saveAiPreferenceSelection"
                  />
                </v-window-item>
              </v-window>
            </div>
          </div>
        </template>

        <template #actions>
          <SaplingActionBarSkeleton
            v-if="isLoading || !currentPersonStore.loaded"
            :leading="1"
            :trailing="2"
          />

          <SaplingActionAccount
            v-else
            :handleClose="handleClose"
            :handleChangePassword="changePassword"
            :handleLogout="logout"
          />
        </template>
      </SaplingDialogShell>
    </SaplingDialogCard>
    <!-- Password change dialog -->
    <SaplingChangePassword v-model="showPasswordChange" />
  </SaplingDialog>
</template>

<script setup lang="ts">
import SaplingAccountWorkHours from './SaplingAccountWorkHours.vue'
// #region Imports
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSaplingAccount, type AccountTab } from '@/composables/account/useSaplingAccount'
import { openContextHelpArticle } from '@/composables/knowledge/useSaplingContextHelp'
import SaplingChangePassword from '@/components/account/SaplingChangePassword.vue'
import SaplingPasskeyManager from '@/components/account/SaplingPasskeyManager.vue'
import SaplingAccountSessionPanel from '@/components/account/SaplingAccountSessionPanel.vue'
import SaplingAccountSongbirdPanel from '@/components/account/SaplingAccountSongbirdPanel.vue'
import SaplingAccountNotificationPanel from '@/components/account/SaplingAccountNotificationPanel.vue'
import SaplingAccountPreferencesPanel from '@/components/account/SaplingAccountPreferencesPanel.vue'
import SaplingActionAccount from '@/components/actions/SaplingActionAccount.vue'
import SaplingActionBarSkeleton from '@/components/actions/SaplingActionBarSkeleton.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingAutocomplete from '@/components/common/SaplingAutocomplete.vue'
import SaplingCombobox from '@/components/common/SaplingCombobox.vue'
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import SaplingDialogHero from '@/components/common/SaplingDialogHero.vue'
import SaplingDialogShell from '@/components/common/SaplingDialogShell.vue'
import SaplingStaticSelect from '@/components/common/SaplingStaticSelect.vue'
import SaplingSwitch from '@/components/common/SaplingSwitch.vue'
import SaplingTextField from '@/components/common/SaplingTextField.vue'
// #endregion

// #region Composable
const router = useRouter()
const emit = defineEmits<{
  (event: 'close'): void
}>()

const props = withDefaults(
  defineProps<{
    initialTab?: AccountTab
  }>(),
  {
    initialTab: 'profile',
  },
)

const {
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
} = useSaplingAccount()

watch(
  () => props.initialTab,
  (tab) => {
    activeAccountTab.value = tab
  },
  { immediate: true },
)

const accountTitle = computed(() => {
  const person = currentPersonStore.person

  if (!person) {
    return ''
  }

  return `${person.firstName} ${person.lastName}`.trim()
})

const accountSubtitle = computed(
  () => currentPersonStore.person?.email || currentPersonStore.person?.mobile || '',
)

const isSaplingAccount = computed(() => {
  const personType = currentPersonStore.person?.type

  return typeof personType === 'string'
    ? personType === 'sapling'
    : personType?.handle === 'sapling'
})

function handleClose() {
  emit('close')
}

async function openProfileContextHelp() {
  if (await openContextHelpArticle(router, 'app.profile')) {
    handleClose()
  }
}
// #endregion
</script>
