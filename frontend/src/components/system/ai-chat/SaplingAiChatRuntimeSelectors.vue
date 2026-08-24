<template>
  <div class="sapling-chat-runtime-selectors sapling-ai-chat__selectors">
    <v-alert
      v-if="!hasConfiguredProviders"
      class="sapling-chat-runtime-selectors__alert sapling-ai-chat__runtime-alert"
      density="comfortable"
      type="info"
      variant="tonal"
    >
      <div>{{ t('aiChat.noConfiguredProviders') }}</div>
      <div class="sapling-chat-runtime-selectors__alert-copy sapling-ai-chat__runtime-alert-copy">
        {{ t('aiChat.contactAdministrator') }}
      </div>
    </v-alert>
    <SaplingAutocomplete
      v-if="providerOptions.length > 0"
      :model-value="selectedProviderHandle"
      class="sapling-chat-runtime-selectors__select sapling-chat-runtime-selectors__select--provider sapling-ai-chat__provider-select"
      density="compact"
      :disabled="isSending || isLoadingProviders || isLoadingModels"
      hide-details
      item-title="label"
      item-value="value"
      :items="providerOptions"
      :label="t('aiChat.provider')"
      variant="outlined"
      @update:model-value="emit('update:selectedProvider', $event)"
    >
      <template #label>
        <span>{{ t('aiChat.provider') }}</span>
        <SaplingHelpTooltip
          :text="t('aiChat.providerTooltip')"
          :aria-label="t('aiChat.provider')"
          icon-size="16"
        />
      </template>
    </SaplingAutocomplete>
    <SaplingAutocomplete
      v-if="modelOptions.length > 0"
      :model-value="selectedModelHandle"
      class="sapling-chat-runtime-selectors__select sapling-chat-runtime-selectors__select--model sapling-ai-chat__model-select"
      density="compact"
      :disabled="isSending || isLoadingModels || !selectedProviderHandle"
      hide-details
      item-title="label"
      item-value="value"
      :items="modelOptions"
      :label="t('aiChat.model')"
      variant="outlined"
      @update:model-value="emit('update:selectedModel', $event)"
    >
      <template #label>
        <span>{{ t('aiChat.model') }}</span>
        <SaplingHelpTooltip
          :text="t('aiChat.modelTooltip')"
          :aria-label="t('aiChat.model')"
          icon-size="16"
        />
      </template>
    </SaplingAutocomplete>
  </div>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import SaplingAutocomplete from '@/components/common/SaplingAutocomplete.vue'
import SaplingHelpTooltip from '@/components/common/SaplingHelpTooltip.vue'

type SelectOption = {
  label: string
  value: string
}

defineProps<{
  providerOptions: SelectOption[]
  modelOptions: SelectOption[]
  selectedProviderHandle: string | null
  selectedModelHandle: string | null
  hasConfiguredProviders: boolean
  isSending: boolean
  isLoadingProviders: boolean
  isLoadingModels: boolean
}>()

const emit = defineEmits<{
  (event: 'update:selectedProvider', value: unknown): void
  (event: 'update:selectedModel', value: unknown): void
}>()

const { t } = useI18n()
</script>
