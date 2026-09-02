<template>
  <section class="sapling-account-dialog__panel-stack">
    <div class="sapling-account-dialog__section-heading">
      <v-icon color="primary">mdi-bell-outline</v-icon>
      <span>{{ $t('account.notifications') }}</span>
    </div>
    <div class="sapling-account-dialog__notification-grid">
      <SaplingSwitch
        v-for="preference in notificationSwitches"
        :key="preference.field"
        v-model="model[preference.field]"
        color="primary"
        hide-details
        inset
        :label="$t(preference.labelKey)"
      >
        <template #label>
          <span>{{ $t(preference.labelKey) }}</span>
          <SaplingHelpTooltip
            :text="$t(`${preference.labelKey}Tooltip`)"
            :aria-label="$t(preference.labelKey)"
            icon-size="16"
          />
        </template>
      </SaplingSwitch>
    </div>
    <v-divider />
    <div class="sapling-account-dialog__quiet-hours-grid">
      <SaplingSwitch
        v-model="model.quietHoursEnabled"
        color="primary"
        hide-details
        inset
        :label="$t('account.quietHoursEnabled')"
      >
        <template #label>
          <span>{{ $t('account.quietHoursEnabled') }}</span>
          <SaplingHelpTooltip
            :text="$t('account.quietHoursEnabledTooltip')"
            :aria-label="$t('account.quietHoursEnabled')"
            icon-size="16"
          />
        </template>
      </SaplingSwitch>
      <SaplingTextField
        v-model="model.quietHoursFrom"
        density="comfortable"
        variant="outlined"
        hide-details
        type="time"
        :disabled="!model.quietHoursEnabled"
        :label="$t('account.quietHoursFrom')"
      />
      <SaplingTextField
        v-model="model.quietHoursTo"
        density="comfortable"
        variant="outlined"
        hide-details
        type="time"
        :disabled="!model.quietHoursEnabled"
        :label="$t('account.quietHoursTo')"
      />
    </div>
    <v-btn
      color="primary"
      variant="flat"
      prepend-icon="mdi-content-save-outline"
      :loading="isSaving"
      @click="$emit('save')"
    >
      {{ $t('account.saveNotifications') }}
    </v-btn>
  </section>
</template>

<script setup lang="ts">
import SaplingHelpTooltip from '@/components/common/SaplingHelpTooltip.vue'
import SaplingSwitch from '@/components/common/SaplingSwitch.vue'
import SaplingTextField from '@/components/common/SaplingTextField.vue'
import type { SaplingNotificationPreferences } from '@/services/notification-preferences.service'

defineProps<{ isSaving: boolean }>()
defineEmits<{ save: [] }>()
const model = defineModel<SaplingNotificationPreferences>({ required: true })

const notificationSwitches = [
  { field: 'inboxNotificationsEnabled', labelKey: 'account.inboxNotificationsEnabled' },
  { field: 'openTaskNotificationsEnabled', labelKey: 'account.openTaskNotificationsEnabled' },
  { field: 'badgeChannelEnabled', labelKey: 'account.badgeChannelEnabled' },
  { field: 'previewChannelEnabled', labelKey: 'account.previewChannelEnabled' },
] as const
</script>
