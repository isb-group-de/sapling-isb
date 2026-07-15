<template>
  <v-container
    class="sapling-page-shell sapling-page-shell--panel sapling-page-shell--uniform-inset sapling-config-page sapling-ai-agent-builder"
    fluid
  >
    <v-skeleton-loader
      v-if="isPageLoading"
      class="sapling-ai-agent-builder__page-skeleton"
      type="article, actions, list-item-three-line, list-item-three-line, article"
    />

    <template v-else>
      <SaplingPageHero
        class="sapling-config-hero sapling-ai-agent-builder__hero"
        variant="system"
        :eyebrow="t('aiAgentBuilder.eyebrow')"
        :title="t('aiAgentBuilder.title')"
        :subtitle="t('aiAgentBuilder.subtitle')"
      >
        <template #meta>
          <v-chip size="small" color="primary" variant="tonal" prepend-icon="mdi-creation">
            {{ agents.length }} {{ t('aiAgentBuilder.agentCount') }}
          </v-chip>
          <v-chip size="small" variant="outlined" prepend-icon="mdi-check-circle-outline">
            {{ activeAgentCount }} {{ t('aiAgentBuilder.activeAgents') }}
          </v-chip>
        </template>
        <template #side>
          <div class="sapling-action-cluster sapling-ai-agent-builder__hero-actions">
            <v-btn color="primary" prepend-icon="mdi-plus" @click="startNewAgent">
              {{ t('aiAgentBuilder.newAgent') }}
            </v-btn>
          </div>
        </template>
      </SaplingPageHero>

      <section class="sapling-config-workspace sapling-ai-agent-builder__workspace">
        <SaplingSurface
          class="sapling-panel-shell sapling-section-panel sapling-config-panel sapling-config-panel--blurred sapling-ai-agent-builder__rail"
        >
          <div class="sapling-ai-agent-builder__rail-header">
            <span>{{ t('aiAgentBuilder.agentList') }}</span>
            <v-btn
              icon="mdi-plus"
              variant="tonal"
              size="small"
              :title="t('aiAgentBuilder.newAgent')"
              @click="startNewAgent"
            />
          </div>
          <v-list class="sapling-ai-agent-builder__list" density="comfortable" nav>
            <v-list-item
              v-for="agent in agents"
              :key="agent.handle"
              :active="agent.handle === selectedAgent?.handle"
              :prepend-icon="agent.icon || 'mdi-creation'"
              :title="agent.title"
              :subtitle="getAgentSubtitle(agent)"
              rounded="lg"
              @click="selectAgent(agent)"
            />
          </v-list>
        </SaplingSurface>

        <SaplingSurface
          class="sapling-panel-shell sapling-section-panel sapling-config-panel sapling-config-panel--blurred sapling-ai-agent-builder__editor"
        >
          <v-tabs
            v-model="activeTab"
            class="sapling-ai-agent-builder__tabs"
            density="comfortable"
            show-arrows
          >
            <v-tab value="profile">{{ t('aiAgentBuilder.tabProfile') }}</v-tab>
            <v-tab value="prompt">{{ t('aiAgentBuilder.tabPrompt') }}</v-tab>
            <v-tab value="data">{{ t('aiAgentBuilder.tabData') }}</v-tab>
            <v-tab value="tools">{{ t('aiAgentBuilder.tabTools') }}</v-tab>
            <v-tab value="runtime">{{ t('aiAgentBuilder.tabRuntime') }}</v-tab>
            <v-tab value="release">{{ t('aiAgentBuilder.tabRelease') }}</v-tab>
            <v-tab value="versions">{{ t('aiAgentBuilder.tabVersions') }}</v-tab>
            <v-tab value="test">{{ t('aiAgentBuilder.tabTestRuns') }}</v-tab>
            <v-tab value="memory">{{ t('aiAgentBuilder.tabMemory') }}</v-tab>
            <v-tab value="quality">{{ t('aiAgentBuilder.tabQuality') }}</v-tab>
            <v-tab value="usage">{{ t('aiAgentBuilder.tabUsage') }}</v-tab>
          </v-tabs>

          <v-window v-model="activeTab" class="sapling-ai-agent-builder__window">
            <AiAgentConfigurationPanels
              v-model:draft="draft"
              v-model:selected-allowed-entities="selectedAllowedEntities"
              v-model:selected-allowed-knowledge-entities="selectedAllowedKnowledgeEntities"
              v-model:selected-roles="selectedRoles"
              :is-editing-existing="isEditingExisting"
              :providers="providers"
              :models="filteredModels"
              :internal-tool-options="internalToolOptions"
              :external-tool-options="externalToolOptions"
              :mutation-mode-options="mutationModeOptions"
              :knowledge-entity-filter="knowledgeEntityFilter"
            />
            <AiAgentWorkbenchPanels
              v-model:test-prompt="testPrompt"
              v-model:selected-test-version-handle="selectedTestVersionHandle"
              v-model:selected-test-playbook-handle="selectedTestPlaybookHandle"
              v-model:evaluation-draft="evaluationDraft"
              :has-selected-agent="!!selectedAgent"
              :versions="workbenchVersions"
              :playbooks="workbenchPlaybooks"
              :memories="workbenchMemories"
              :evaluations="workbenchEvaluations"
              :runs="workbenchRuns"
              :stats="workbenchStats"
              :version-options="versionOptions"
              :playbook-options="playbookOptions"
              :is-running-test="isRunningTest"
              :latest-test-run="latestTestRun"
              :format-date="formatDate"
              :get-provider-handle="getProviderHandle"
              :get-model-handle="getModelHandle"
              @create-version="createVersionFromDraft"
              @run-test="runAgentTest"
              @create-evaluation="createEvaluation"
            />
          </v-window>

          <div class="sapling-ai-agent-builder__actions">
            <v-btn variant="text" @click="resetDraft">{{ t('global.cancel') }}</v-btn>
            <v-btn
              color="primary"
              prepend-icon="mdi-content-save"
              :disabled="!canSaveAgent"
              :loading="isSaving"
              @click="saveAgent"
            >
              {{ t('global.save') }}
            </v-btn>
          </div>
        </SaplingSurface>
      </section>
    </template>
  </v-container>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import SaplingPageHero from '@/components/common/SaplingPageHero.vue'
import SaplingSurface from '@/components/common/SaplingSurface.vue'
import AiAgentConfigurationPanels from '@/components/ai/AiAgentConfigurationPanels.vue'
import AiAgentWorkbenchPanels from '@/components/ai/AiAgentWorkbenchPanels.vue'
import { useAiAgentBuilder } from '@/composables/ai/useAiAgentBuilder'

const { t } = useI18n()
const {
  activeAgentCount,
  activeTab,
  agents,
  canSaveAgent,
  createEvaluation,
  createVersionFromDraft,
  draft,
  evaluationDraft,
  externalToolOptions,
  filteredModels,
  formatDate,
  getAgentSubtitle,
  getModelHandle,
  getProviderHandle,
  internalToolOptions,
  isEditingExisting,
  isPageLoading,
  isRunningTest,
  isSaving,
  knowledgeEntityFilter,
  latestTestRun,
  mutationModeOptions,
  playbookOptions,
  providers,
  resetDraft,
  runAgentTest,
  saveAgent,
  selectedAgent,
  selectedAllowedEntities,
  selectedAllowedKnowledgeEntities,
  selectedRoles,
  selectedTestPlaybookHandle,
  selectedTestVersionHandle,
  selectAgent,
  startNewAgent,
  testPrompt,
  versionOptions,
  workbenchEvaluations,
  workbenchMemories,
  workbenchPlaybooks,
  workbenchRuns,
  workbenchStats,
  workbenchVersions,
} = useAiAgentBuilder()
</script>
