<template>
  <v-window-item value="versions">
    <div class="sapling-ai-agent-builder__panel-stack">
      <div class="sapling-row-between-xs">
        <div>
          <strong>{{ t('aiAgentBuilder.versionsTitle') }}</strong>
          <p>{{ t('aiAgentBuilder.versionsSubtitle') }}</p>
        </div>
        <v-btn
          color="primary"
          variant="tonal"
          prepend-icon="mdi-source-branch-plus"
          :disabled="!hasSelectedAgent"
          @click="emit('createVersion')"
        >
          {{ t('aiAgentBuilder.createVersion') }}
        </v-btn>
      </div>
      <SaplingDataTable
        :items="versions"
        :columns="[
          { key: 'c0', title: t('global.version'), value: (version) => version.version },
          { key: 'c1', title: t('global.status'), value: (version) => version.status },
          {
            key: 'c2',
            title: t('aiAgentBuilder.fieldProvider'),
            value: (version) => getProviderHandle(version.provider),
          },
          {
            key: 'c3',
            title: t('aiAgentBuilder.fieldModel'),
            value: (version) => getModelHandle(version.model),
          },
          {
            key: 'c4',
            title: t('aiAgentBuilder.updatedAt'),
            value: (version) => version.updatedAt,
          },
        ]"
      >
        <template #row="{ item: version }">
          <tr>
            <td>v{{ version.version }}</td>
            <td>
              <v-chip size="small" variant="tonal">{{ version.status }}</v-chip>
            </td>
            <td>{{ getProviderHandle(version.provider) || t('global.notAvailable') }}</td>
            <td>{{ getModelHandle(version.model) || t('global.notAvailable') }}</td>
            <td>{{ formatDate(version.updatedAt) }}</td>
          </tr>
        </template>
      </SaplingDataTable>
    </div>
  </v-window-item>

  <v-window-item value="test">
    <div class="sapling-ai-agent-builder__panel-stack">
      <SaplingTextarea v-model="testPrompt" :label="t('aiAgentBuilder.testPrompt')" rows="5" />
      <div class="sapling-row-md">
        <SaplingAutocomplete
          v-model="selectedTestVersionHandle"
          :items="versionOptions"
          item-title="title"
          item-value="value"
          clearable
          :label="t('aiAgentBuilder.testVersion')"
        />
        <SaplingAutocomplete
          v-model="selectedTestPlaybookHandle"
          :items="playbookOptions"
          item-title="title"
          item-value="value"
          clearable
          :label="t('aiAgentBuilder.testPlaybook')"
        />
        <v-btn
          color="primary"
          prepend-icon="mdi-play-circle-outline"
          :disabled="!hasSelectedAgent || !testPrompt.trim()"
          :loading="isRunningTest"
          @click="emit('runTest')"
        >
          {{ t('aiAgentBuilder.runTest') }}
        </v-btn>
      </div>
      <v-alert v-if="latestTestRun" type="info" variant="tonal">
        {{ latestTestRun.status }} - {{ latestTestRun.durationMs ?? '-' }} ms
      </v-alert>
    </div>
  </v-window-item>

  <v-window-item value="memory">
    <div class="sapling-ai-agent-builder__panel-stack">
      <strong>{{ t('aiAgentBuilder.memoryTitle') }}</strong>
      <article
        v-for="playbook in playbooks"
        :key="playbook.handle"
        class="sapling-section-panel sapling-ai-agent-builder__mini-card"
      >
        <div class="sapling-row-between-xs">
          <strong>{{ playbook.title }}</strong>
          <v-chip size="small" variant="tonal" :color="playbook.isActive ? 'success' : undefined">
            {{ playbook.isActive ? t('global.active') : t('global.inactive') }}
          </v-chip>
        </div>
        <p v-if="playbook.description">{{ playbook.description }}</p>
        <div v-if="playbook.triggerEntityHandles?.length" class="sapling-row-xs">
          <v-chip
            v-for="entityHandle in playbook.triggerEntityHandles"
            :key="entityHandle"
            size="small"
            variant="outlined"
          >
            {{ entityHandle }}
          </v-chip>
        </div>
        <ol v-if="playbook.steps?.length" class="sapling-stack-xs">
          <li v-for="(step, index) in playbook.steps" :key="`${playbook.handle}-${index}`">
            {{ step }}
          </li>
        </ol>
        <p v-if="playbook.expectedOutput">{{ playbook.expectedOutput }}</p>
      </article>
      <v-alert v-if="playbooks.length === 0" type="info" variant="tonal">
        {{ t('aiAgentBuilder.noPlaybooks') }}
      </v-alert>
      <article
        v-for="memory in memories"
        :key="memory.handle ?? memory.title"
        class="sapling-section-panel sapling-ai-agent-builder__mini-card"
      >
        <div class="sapling-row-between-xs">
          <strong>{{ memory.title }}</strong>
          <v-chip size="small" variant="tonal">{{ memory.type }}</v-chip>
        </div>
        <p>{{ memory.contentMarkdown }}</p>
      </article>
      <v-alert v-if="memories.length === 0" type="info" variant="tonal">
        {{ t('aiAgentBuilder.noMemory') }}
      </v-alert>
    </div>
  </v-window-item>

  <v-window-item value="quality">
    <div class="sapling-ai-agent-builder__panel-stack">
      <div class="sapling-ai-agent-builder__grid">
        <SaplingTextField
          v-model="evaluationDraft.title"
          :label="t('aiAgentBuilder.evaluationTitle')"
        />
        <SaplingAutocomplete
          v-model="evaluationDraft.agentVersionHandle"
          :items="versionOptions"
          item-title="title"
          item-value="value"
          clearable
          :label="t('aiAgentBuilder.testVersion')"
        />
        <SaplingTextarea
          v-model="evaluationDraft.prompt"
          class="sapling-ai-agent-builder__wide"
          :label="t('aiAgentBuilder.testPrompt')"
          rows="4"
        />
        <SaplingTextarea
          v-model="evaluationDraft.expectedCriteria"
          class="sapling-ai-agent-builder__wide"
          :label="t('aiAgentBuilder.expectedCriteria')"
          rows="3"
        />
      </div>
      <v-btn
        color="primary"
        variant="tonal"
        prepend-icon="mdi-clipboard-check-outline"
        :disabled="
          !hasSelectedAgent || !evaluationDraft.title.trim() || !evaluationDraft.prompt.trim()
        "
        @click="emit('createEvaluation')"
      >
        {{ t('aiAgentBuilder.createEvaluation') }}
      </v-btn>
      <SaplingDataTable
        :items="evaluations"
        :columns="[
          {
            key: 'c0',
            title: t('aiAgentBuilder.evaluationTitle'),
            value: (evaluation) => evaluation.title,
          },
          { key: 'c1', title: t('global.status'), value: (evaluation) => evaluation.status },
          {
            key: 'c2',
            title: t('aiAgentBuilder.updatedAt'),
            value: (evaluation) => evaluation.updatedAt,
          },
        ]"
      >
        <template #row="{ item: evaluation }">
          <tr>
            <td>{{ evaluation.title }}</td>
            <td>
              <v-chip size="small" variant="tonal">{{ evaluation.status }}</v-chip>
            </td>
            <td>{{ formatDate(evaluation.updatedAt) }}</td>
          </tr>
        </template>
      </SaplingDataTable>
    </div>
  </v-window-item>

  <v-window-item value="usage">
    <div class="sapling-ai-agent-builder__panel-stack sapling-ai-agent-builder__panel-stack--usage">
      <div class="sapling-ai-agent-builder__usage-metrics">
        <article class="sapling-ai-agent-builder__usage-metric">
          <v-icon color="primary" icon="mdi-history" size="20" />
          <div>
            <span>{{ t('aiAgentBuilder.runs') }}</span>
            <strong>{{ stats.runsTotal ?? 0 }}</strong>
          </div>
        </article>
        <article class="sapling-ai-agent-builder__usage-metric">
          <v-icon color="error" icon="mdi-alert-circle-outline" size="20" />
          <div>
            <span>{{ t('aiAgentBuilder.failedRuns') }}</span>
            <strong>{{ stats.failedRuns ?? 0 }}</strong>
          </div>
        </article>
        <article class="sapling-ai-agent-builder__usage-metric">
          <v-icon color="info" icon="mdi-shield-lock-outline" size="20" />
          <div>
            <span>{{ t('aiAgentBuilder.actions') }}</span>
            <strong>{{ stats.pendingActions ?? 0 }}</strong>
          </div>
        </article>
        <article class="sapling-ai-agent-builder__usage-metric">
          <v-icon color="success" icon="mdi-clipboard-check-outline" size="20" />
          <div>
            <span>{{ t('aiAgentBuilder.tabQuality') }}</span>
            <strong>{{ formatPercentage(stats.evaluationPassRate) }}</strong>
          </div>
        </article>
      </div>
      <AiAgentRunTraceList :runs="runs" />
    </div>
  </v-window-item>
</template>

<script setup lang="ts">
import SaplingDataTable from '@/components/table/SaplingDataTable.vue'
import { useI18n } from 'vue-i18n'
import type {
  AiAgentEvaluationItem,
  AiAgentMemoryItem,
  AiAgentPlaybookItem,
  AiAgentRunItem,
  AiAgentVersionItem,
  AiProviderModelItem,
  AiProviderTypeItem,
} from '@/entity/entity'
import SaplingAutocomplete from '@/components/common/SaplingAutocomplete.vue'
import SaplingTextField from '@/components/common/SaplingTextField.vue'
import SaplingTextarea from '@/components/common/SaplingTextarea.vue'
import AiAgentRunTraceList from './AiAgentRunTraceList.vue'
import type {
  AgentEvaluationDraft,
  AgentSelectOption,
  AgentWorkbenchStats,
} from './aiAgentBuilder.types'

defineProps<{
  hasSelectedAgent: boolean
  versions: AiAgentVersionItem[]
  playbooks: AiAgentPlaybookItem[]
  memories: AiAgentMemoryItem[]
  evaluations: AiAgentEvaluationItem[]
  runs: AiAgentRunItem[]
  stats: AgentWorkbenchStats
  versionOptions: AgentSelectOption<number | null>[]
  playbookOptions: AgentSelectOption<string>[]
  isRunningTest: boolean
  latestTestRun: AiAgentRunItem | null
  formatDate: (value?: Date | string | null) => string
  getProviderHandle: (value?: AiProviderTypeItem | string | null) => string | null
  getModelHandle: (value?: AiProviderModelItem | string | null) => string | null
}>()

const testPrompt = defineModel<string>('testPrompt', { required: true })
const selectedTestVersionHandle = defineModel<number | null>('selectedTestVersionHandle', {
  required: true,
})
const selectedTestPlaybookHandle = defineModel<string | null>('selectedTestPlaybookHandle', {
  required: true,
})
const evaluationDraft = defineModel<AgentEvaluationDraft>('evaluationDraft', { required: true })
const emit = defineEmits<{
  createVersion: []
  runTest: []
  createEvaluation: []
}>()
const { t } = useI18n()

function formatPercentage(value: number | null | undefined): string {
  return value == null ? t('global.notAvailable') : `${value}%`
}
</script>
