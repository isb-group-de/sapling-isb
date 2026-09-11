<template>
  <div class="sapling-stack-sm">
    <div v-if="failed" class="d-flex align-center ga-2">
      {{ $t('aiChat.widgetLoadFailed') }}
      <v-btn variant="text" @click="load">{{ $t('global.refresh') }}</v-btn>
    </div>
    <SaplingAutocomplete
      :model-value="model.agentHandle"
      :items="agents"
      item-title="title"
      item-value="handle"
      :label="$t('aiChat.agent')"
      clearable
      :loading="loading"
      :rules="[available(agents)]"
      @update:model-value="update('agentHandle', $event)"
    />
    <SaplingAutocomplete
      :model-value="model.providerHandle"
      :items="providers"
      item-title="title"
      item-value="handle"
      :label="$t('aiChat.provider')"
      clearable
      :loading="loading"
      :rules="[available(providers)]"
      @update:model-value="setProvider"
    />
    <SaplingAutocomplete
      :model-value="model.modelHandle"
      :items="filteredModels"
      item-title="title"
      item-value="handle"
      :label="$t('aiChat.model')"
      clearable
      :loading="loading"
      :rules="[available(filteredModels)]"
      @update:model-value="setModel"
    />
    <SaplingTextarea
      :model-value="model.instruction"
      :label="$t('aiChat.workspaceInstruction')"
      :hint="$t('aiChat.workspaceInstructionHint')"
      persistent-hint
      rows="5"
      maxlength="8000"
      counter
      @update:model-value="update('instruction', $event)"
    />
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingAutocomplete from '@/components/common/SaplingAutocomplete.vue'
import SaplingTextarea from '@/components/common/SaplingTextarea.vue'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import ApiAiService from '@/services/api.ai.service'
import type { AiAgentItem, AiProviderModelItem, AiProviderTypeItem } from '@/entity/entity'
import type { AiWidget } from '@/components/system/ai-chat/songbirdWorkspaceRegistry'
const model = defineModel<AiWidget['config']>({ required: true })
const { t } = useI18n()
const { pushMessage } = useSaplingMessageCenter()
const agents = ref<AiAgentItem[]>([])
const providers = ref<AiProviderTypeItem[]>([])
const models = ref<AiProviderModelItem[]>([])
const failed = ref(false)
const loading = ref(false)
const providerOf = (item: AiProviderModelItem) =>
  typeof item.provider === 'string' ? item.provider : item.provider?.handle
const filteredModels = computed(() =>
  models.value.filter(
    (m) => !model.value.providerHandle || providerOf(m) === model.value.providerHandle,
  ),
)
const available = (items: { handle?: string | null }[]) => (value: unknown) =>
  !value || items.some((item) => item.handle === value) || t('aiChat.widgetConfigurationError')
function update(field: keyof AiWidget['config'], value: string | null | undefined) {
  model.value = { ...model.value, [field]: value || undefined }
}
function setProvider(value: string | null | undefined) {
  model.value = { ...model.value, providerHandle: value || undefined, modelHandle: undefined }
}
function setModel(value: string | null | undefined) {
  const selected = models.value.find((m) => m.handle === value)
  model.value = {
    ...model.value,
    modelHandle: value || undefined,
    ...(selected ? { providerHandle: providerOf(selected) ?? undefined } : {}),
  }
}
async function load() {
  loading.value = true
  failed.value = false
  try {
    ;[agents.value, providers.value, models.value] = await Promise.all([
      ApiAiService.listAgents(),
      ApiAiService.listProviders(),
      ApiAiService.listModels(),
    ])
  } catch {
    failed.value = true
    pushMessage('error', 'aiChat.widgetLoadFailed', '', 'aiChat')
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>
