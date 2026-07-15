<template>
  <v-window-item value="profile">
    <div class="sapling-ai-agent-builder__grid">
      <v-text-field
        v-model="draft.handle"
        :disabled="isEditingExisting"
        :label="t('aiAgentBuilder.fieldHandle')"
        required
      />
      <v-text-field v-model="draft.title" :label="t('aiAgentBuilder.fieldTitle')" required />
      <v-text-field v-model="draft.icon" :label="t('aiAgentBuilder.fieldIcon')" />
      <v-text-field v-model="draft.color" :label="t('aiAgentBuilder.fieldColor')" />
      <v-textarea
        v-model="draft.description"
        class="sapling-ai-agent-builder__wide"
        :label="t('aiAgentBuilder.fieldDescription')"
        rows="3"
      />
      <v-combobox
        v-model="draft.conversationStarters"
        class="sapling-ai-agent-builder__wide"
        chips
        multiple
        :label="t('aiAgentBuilder.fieldStarters')"
      />
    </div>
  </v-window-item>

  <v-window-item value="prompt">
    <div class="sapling-ai-agent-builder__grid">
      <v-textarea
        v-model="draft.promptMarkdown"
        class="sapling-ai-agent-builder__wide"
        :label="t('aiAgentBuilder.fieldPrompt')"
        rows="12"
        required
      />
      <v-textarea
        v-model="draft.welcomeMessage"
        class="sapling-ai-agent-builder__wide"
        :label="t('aiAgentBuilder.fieldWelcome')"
        rows="4"
      />
    </div>
  </v-window-item>

  <v-window-item value="data">
    <div class="sapling-ai-agent-builder__grid">
      <SaplingFieldSelect
        v-model="selectedAllowedEntities"
        class="sapling-ai-agent-builder__wide"
        entity-handle="entity"
        :label="t('aiAgentBuilder.fieldEntities')"
        density="comfortable"
        hide-details
      />
      <SaplingFieldSelect
        v-model="selectedAllowedKnowledgeEntities"
        class="sapling-ai-agent-builder__wide"
        entity-handle="entity"
        :parent-filter="knowledgeEntityFilter"
        :label="t('aiAgentBuilder.fieldKnowledge')"
        density="comfortable"
        hide-details
      />
    </div>
  </v-window-item>

  <v-window-item value="tools">
    <div class="sapling-ai-agent-builder__grid">
      <v-select
        v-model="draft.allowedInternalTools"
        class="sapling-ai-agent-builder__wide"
        chips
        multiple
        :items="internalToolOptions"
        :label="t('aiAgentBuilder.fieldInternalTools')"
      />
      <v-select
        v-model="draft.allowedExternalTools"
        class="sapling-ai-agent-builder__wide"
        chips
        multiple
        :items="externalToolOptions"
        :label="t('aiAgentBuilder.fieldExternalTools')"
      />
    </div>
  </v-window-item>

  <v-window-item value="runtime">
    <div class="sapling-ai-agent-builder__grid">
      <v-select
        v-model="draft.provider"
        item-title="title"
        item-value="handle"
        :items="providers"
        :label="t('aiAgentBuilder.fieldProvider')"
        clearable
      />
      <v-select
        v-model="draft.model"
        item-title="title"
        item-value="handle"
        :items="models"
        :label="t('aiAgentBuilder.fieldModel')"
        clearable
      />
      <v-select
        v-model="draft.mutationMode"
        :items="mutationModeOptions"
        :label="t('aiAgentBuilder.fieldMutationMode')"
      />
    </div>
  </v-window-item>

  <v-window-item value="release">
    <div class="sapling-ai-agent-builder__grid">
      <SaplingFieldSelect
        v-model="selectedRoles"
        class="sapling-ai-agent-builder__wide"
        entity-handle="role"
        :label="t('aiAgentBuilder.fieldRoles')"
        density="comfortable"
        hide-details
      />
      <v-switch v-model="draft.isActive" :label="t('aiAgentBuilder.fieldActive')" />
      <v-switch v-model="draft.isDefault" :label="t('aiAgentBuilder.fieldDefault')" />
      <v-text-field
        v-model.number="draft.sortOrder"
        type="number"
        :label="t('aiAgentBuilder.fieldSortOrder')"
      />
    </div>
  </v-window-item>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { AiProviderModelItem, AiProviderTypeItem, SaplingGenericItem } from '@/entity/entity'
import type { FilterQuery } from '@/services/api.generic.service'
import SaplingFieldSelect from '@/components/dialog/fields/SaplingFieldSelect.vue'
import type { AgentDraft, AgentSelectOption } from './aiAgentBuilder.types'

defineProps<{
  isEditingExisting: boolean
  providers: AiProviderTypeItem[]
  models: AiProviderModelItem[]
  internalToolOptions: string[]
  externalToolOptions: string[]
  mutationModeOptions: AgentSelectOption<string>[]
  knowledgeEntityFilter: FilterQuery
}>()

const draft = defineModel<AgentDraft>('draft', { required: true })
const selectedAllowedEntities = defineModel<SaplingGenericItem[]>('selectedAllowedEntities', {
  required: true,
})
const selectedAllowedKnowledgeEntities = defineModel<SaplingGenericItem[]>(
  'selectedAllowedKnowledgeEntities',
  { required: true },
)
const selectedRoles = defineModel<SaplingGenericItem[]>('selectedRoles', { required: true })
const { t } = useI18n()
</script>
