<template>
  <section class="sapling-account-dialog__panel-stack">
    <div class="sapling-account-dialog__section-heading">
      <v-icon color="primary">mdi-creation-outline</v-icon>
      <span>{{ $t('account.songbird') }}</span>
    </div>
    <div class="sapling-account-dialog__ai-grid">
      <SaplingStaticSelect
        v-for="field in fields"
        :key="field.key"
        :model-value="field.value"
        :loading="loading"
        :items="field.items"
        :label="$t(field.label)"
        @update:model-value="updateField(field.event, $event)"
      />
    </div>
    <v-btn
      color="primary"
      variant="flat"
      prepend-icon="mdi-content-save-outline"
      :loading="saving"
      @click="$emit('save')"
    >
      {{ $t('account.saveSongbird') }}
    </v-btn>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SaplingStaticSelect from '@/components/common/SaplingStaticSelect.vue'
import type { SaplingAiPreferences } from '@/services/ai-preferences.service'
import type { AccountSelectOption } from '@/composables/account/saplingAccount.utils'

const props = defineProps<{
  preferences: SaplingAiPreferences
  loading: boolean
  saving: boolean
  aiProviderOptions: AccountSelectOption<string>[]
  aiModelOptions: AccountSelectOption<string>[]
  transcriptionProviderOptions: AccountSelectOption<string>[]
  transcriptionModelOptions: AccountSelectOption<string>[]
  speechProviderOptions: AccountSelectOption<string>[]
  speechModelOptions: AccountSelectOption<string>[]
}>()

const emit = defineEmits<{
  updateAiProvider: [value: unknown]
  updateAiModel: [value: unknown]
  updateTranscriptionProvider: [value: unknown]
  updateTranscriptionModel: [value: unknown]
  updateSpeechProvider: [value: unknown]
  updateSpeechModel: [value: unknown]
  save: []
}>()

const fields = computed(() => [
  {
    key: 'chatProvider',
    value: props.preferences.chatProviderHandle,
    items: props.aiProviderOptions,
    label: 'aiChat.provider',
    event: 'updateAiProvider' as const,
  },
  {
    key: 'chatModel',
    value: props.preferences.chatModelHandle,
    items: props.aiModelOptions,
    label: 'aiChat.model',
    event: 'updateAiModel' as const,
  },
  {
    key: 'transcriptionProvider',
    value: props.preferences.transcriptionProviderHandle,
    items: props.transcriptionProviderOptions,
    label: 'aiChat.voiceProvider',
    event: 'updateTranscriptionProvider' as const,
  },
  {
    key: 'transcriptionModel',
    value: props.preferences.transcriptionModelHandle,
    items: props.transcriptionModelOptions,
    label: 'aiChat.voiceModel',
    event: 'updateTranscriptionModel' as const,
  },
  {
    key: 'speechProvider',
    value: props.preferences.speechProviderHandle,
    items: props.speechProviderOptions,
    label: 'aiChat.voiceOutputProvider',
    event: 'updateSpeechProvider' as const,
  },
  {
    key: 'speechModel',
    value: props.preferences.speechModelHandle,
    items: props.speechModelOptions,
    label: 'aiChat.voiceOutputModel',
    event: 'updateSpeechModel' as const,
  },
])

type FieldEvent = (typeof fields.value)[number]['event']

function updateField(event: FieldEvent, value: unknown): void {
  switch (event) {
    case 'updateAiProvider':
      emit('updateAiProvider', value)
      break
    case 'updateAiModel':
      emit('updateAiModel', value)
      break
    case 'updateTranscriptionProvider':
      emit('updateTranscriptionProvider', value)
      break
    case 'updateTranscriptionModel':
      emit('updateTranscriptionModel', value)
      break
    case 'updateSpeechProvider':
      emit('updateSpeechProvider', value)
      break
    case 'updateSpeechModel':
      emit('updateSpeechModel', value)
      break
  }
}
</script>
