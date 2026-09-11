<template>
  <section class="songbird-form-proposal" :aria-label="t('aiChat.formProposalTitle')">
    <strong>{{ t('aiChat.formProposalTitle') }}</strong>
    <p class="text-caption">{{ t('aiChat.formProposalHelp') }}</p>
    <div v-for="field in proposal.fields" :key="field.name" class="songbird-form-proposal__field">
      <v-checkbox-btn
        density="compact"
        :model-value="state.selected.includes(field.name)"
        :disabled="state.status !== 'pending' || !available"
        :aria-label="field.label"
        @update:model-value="toggleField(field.name, $event === true)"
      />
      <div class="songbird-form-proposal__field-content">
        <strong>{{ field.label }}</strong>
        <div class="songbird-form-proposal__value">{{ displayValue(field.value) }}</div>
      </div>
    </div>
    <v-alert v-if="state.error" type="warning" density="compact">
      {{ t(state.error) }}
      <div v-if="state.error === 'aiChat.formFieldsChanged'" class="mt-2">
        <v-btn
          size="small"
          color="warning"
          variant="tonal"
          prepend-icon="mdi-alert"
          :loading="state.status === 'applying'"
          :disabled="!available || !state.selected.length || state.status === 'applying'"
          @click="applySongbirdFormProposal(state, true)"
        >
          {{ t('aiChat.formApplyAnyway') }}
        </v-btn>
      </div>
    </v-alert>
    <p v-if="state.status === 'applied'" role="status">
      {{ t(state.validationFailed ? 'aiChat.formAppliedInvalid' : 'aiChat.formApplied') }}
    </p>
    <p v-else-if="state.status === 'rejected'" role="status">{{ t('aiChat.formRejected') }}</p>
    <p v-else-if="!available" role="status">{{ t('aiChat.formUnavailable') }}</p>
    <div
      v-if="state.status === 'pending' || state.status === 'applying'"
      class="songbird-form-proposal__actions"
    >
      <v-btn
        size="small"
        color="primary"
        variant="tonal"
        :loading="state.status === 'applying'"
        :disabled="!available || !state.selected.length || state.status === 'applying'"
        @click="applySongbirdFormProposal(state)"
        >{{ t('aiChat.formApply') }}</v-btn
      >
      <v-btn
        size="small"
        variant="text"
        :disabled="state.status === 'applying'"
        @click="state.status = 'rejected'"
        >{{ t('aiChat.formReject') }}</v-btn
      >
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SongbirdFormProposal } from '@/composables/system/songbirdForm.types'
import {
  applySongbirdFormProposal,
  registerSongbirdFormProposal,
  songbirdForms,
} from '@/composables/system/songbirdFormRegistry'
const props = defineProps<{ proposal: SongbirdFormProposal }>()
const { t } = useI18n()
const state = registerSongbirdFormProposal(props.proposal)
const available = computed(() => songbirdForms.get(props.proposal.formId)?.isAvailable() === true)
function toggleField(name: string, selected: boolean) {
  if (state.status !== 'pending') return
  state.selected = selected
    ? [...new Set([...state.selected, name])]
    : state.selected.filter((item) => item !== name)
}
function displayValue(value: unknown): string {
  if (value === null) return t('aiChat.formClearValue')
  if (typeof value === 'boolean') return t(value ? 'global.yes' : 'global.no')
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
}
</script>
