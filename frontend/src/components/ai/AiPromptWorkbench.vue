<template>
  <SaplingDialog
    :model-value="true"
    max-width="1500"
    scrollable
    @update:model-value="emit('close')"
  >
    <SaplingDialogCard :close="() => emit('close')">
      <v-card-title>{{ t('aiPrompt.title') }}</v-card-title>
      <v-card-text>
        <v-progress-linear v-if="loading" indeterminate />
        <v-tabs v-model="tab"
          ><v-tab value="library">{{ t('aiPrompt.library') }}</v-tab
          ><v-tab v-if="agentHandle" value="quality">{{ t('aiPrompt.quality') }}</v-tab
          ><v-tab v-if="agentHandle" value="context" @click="loadContext">{{
            t('aiPrompt.effectiveContext')
          }}</v-tab></v-tabs
        >
        <div v-if="tab === 'library'" class="sapling-prompt-workbench">
          <aside class="sapling-prompt-workbench__catalog">
            <SaplingTextField v-model="search" :label="t('global.search')" hide-details clearable />
            <v-list
              ><v-list-item
                v-for="item in filtered"
                :key="item.handle"
                :title="item.title"
                :subtitle="item.purpose"
                :disabled="loading"
                :active="selected?.handle === item.handle"
                @click="select(item)"
            /></v-list>
          </aside>
          <section v-if="selected" class="sapling-prompt-workbench__editor">
            <h3>{{ selected.title }}</h3>
            <p>{{ selected.handle }}</p>
            <p>{{ selected.description }}</p>
            <p>{{ t('aiPrompt.usage') }}: {{ usages.join(', ') || '—' }}</p>
            <SaplingTextarea v-model="draft" :label="t('aiPrompt.draft')" rows="12" auto-grow />
            <p>{{ t('aiPrompt.variables') }}: {{ selected.variables.join(', ') || '—' }}</p>
            <SaplingTextarea v-model="values" :label="t('aiPrompt.previewValues')" rows="3" />
            <SaplingTextField v-model="changeNote" :label="t('aiPrompt.changeNote')" />
            <div class="sapling-action-cluster">
              <v-btn :disabled="loading" @click="save">{{ t('aiPrompt.saveDraft') }}</v-btn>
              <v-btn :disabled="loading || draft !== selected.draft" @click="preview">{{
                t('aiPrompt.preview')
              }}</v-btn>
              <v-btn
                color="primary"
                :disabled="loading || draft !== selected.draft"
                @click="publish()"
                >{{ t('aiPrompt.publish') }}</v-btn
              >
            </div>
            <p>{{ t('aiPrompt.publishExplanation') }}</p>
            <SaplingTextarea
              v-if="previewText"
              :model-value="previewText"
              :label="t('aiPrompt.preview')"
              readonly
              rows="8"
            />
            <v-select
              v-model="versionHandle"
              :items="
                versions.map((v) => ({
                  title: `v${v.version} · ${new Date(v.publishedAt).toLocaleString()} · ${v.changeNote ?? ''}`,
                  value: v.handle,
                }))
              "
              :label="t('aiPrompt.version')"
              clearable
            />
            <template v-if="version">
              <p>
                {{
                  t(version.content === draft ? 'aiPrompt.noDifference' : 'aiPrompt.compareDraft')
                }}
              </p>
              <SaplingTextarea
                :model-value="version.content"
                :label="t('aiPrompt.publishedText')"
                readonly
                rows="8"
              />
              <v-btn :disabled="loading" @click="publish(version!.handle)">{{
                t('aiPrompt.restore')
              }}</v-btn>
            </template>
          </section>
        </div>
        <template v-else-if="tab === 'quality'">
          <p>{{ t('aiPrompt.qualityExplanation') }}</p>
          <v-select
            v-model="caseHandle"
            :items="evaluations.map((e) => ({ title: e.title, value: e.handle }))"
            :label="t('aiPrompt.testCase')"
            @update:model-value="selectCase"
          />
          <template v-if="testCase">
            <SaplingTextarea
              :model-value="testCase.prompt"
              readonly
              :label="t('aiPrompt.testPrompt')"
            />
            <SaplingTextarea v-model="expectations" :label="t('aiPrompt.expectations')" rows="4" />
            <SaplingTextarea v-model="fixtures" :label="t('aiPrompt.fixtures')" rows="5" />
            <v-btn :disabled="loading" @click="saveCase">{{ t('global.save') }}</v-btn>
          </template>
          <SaplingTextarea v-model="manifest" :label="t('aiPrompt.manifestOverride')" rows="3" />
          <v-btn :disabled="loading || !testCase" color="primary" @click="runTests">{{
            t('aiPrompt.runTests')
          }}</v-btn>
          <v-alert v-if="!evaluations.length" type="info">{{ t('aiPrompt.noTests') }}</v-alert>
          <v-expansion-panels class="mt-4">
            <v-expansion-panel
              v-for="run in runs"
              :key="run.handle"
              :title="`${run.evaluationResult?.title ?? run.handle} · ${run.status} · ${run.durationMs ?? 0} ms`"
            >
              <v-expansion-panel-text>
                <p>{{ t(run.evaluationResult?.passed ? 'aiPrompt.passed' : 'aiPrompt.failed') }}</p>
                <SaplingTextarea
                  :model-value="
                    JSON.stringify(
                      {
                        checks: run.evaluationResult,
                        usage: run.usagePayload,
                        prompts: run.promptManifest,
                        tools: run.toolCalls,
                        error: run.errorPayload,
                      },
                      null,
                      2,
                    )
                  "
                  readonly
                  rows="10"
                />
                <SaplingTextarea :model-value="run.responseText ?? ''" readonly rows="6" />
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </template>
        <template v-else-if="tab === 'context'">
          <p>{{ t('aiPrompt.contextExplanation') }}</p>
          <SaplingTextarea :model-value="effectiveContext" readonly rows="20" />
        </template>
      </v-card-text>
      <v-card-actions
        ><v-spacer /><v-btn @click="emit('close')">{{ t('global.close') }}</v-btn></v-card-actions
      >
    </SaplingDialogCard>
  </SaplingDialog>
</template>
<script setup lang="ts">
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import SaplingTextarea from '@/components/common/SaplingTextarea.vue'
import SaplingTextField from '@/components/common/SaplingTextField.vue'
import { computed, onMounted, ref } from 'vue'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import ApiGenericService from '@/services/api.generic.service'
import { buildApiUrl } from '@/services/api.client'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
interface PromptVersion {
  handle: number
  version: number
  content: string
  changeNote: string | null
  publishedAt: string
}
interface PromptTemplate {
  handle: string
  title: string
  description: string
  purpose: string
  draft: string
  variables: string[]
  publishedVersion?: PromptVersion
}
interface Evaluation {
  handle: number
  title: string
  prompt: string
  expectations?: object
  toolFixtures?: object
}
interface Run {
  handle: number
  status: string
  durationMs?: number
  evaluationResult?: { title?: string; passed?: boolean }
  usagePayload?: object
  promptManifest?: object
  toolCalls?: object[]
  errorPayload?: object
  responseText?: string
}
const props = defineProps<{ agentHandle?: string | null }>(),
  emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const { pushMessage } = useSaplingMessageCenter()
useTranslationLoader('aiPrompt', 'global')
const tab = ref('library'),
  search = ref(''),
  loading = ref(false),
  error = ref(''),
  draft = ref(''),
  values = ref('{}'),
  changeNote = ref(''),
  previewText = ref(''),
  effectiveContext = ref('')
const templates = ref<PromptTemplate[]>([]),
  selected = ref<PromptTemplate | null>(null),
  versions = ref<PromptVersion[]>([]),
  usages = ref<string[]>([]),
  versionHandle = ref<number | null>(null)
const filtered = computed(() =>
  templates.value.filter((item) =>
    `${item.title} ${item.handle}`.toLowerCase().includes((search.value ?? '').toLowerCase()),
  ),
)
const version = computed(() => versions.value.find((v) => v.handle === versionHandle.value))
const evaluations = ref<Evaluation[]>([]),
  caseHandle = ref<number | null>(null),
  expectations = ref('{}'),
  fixtures = ref('{}'),
  manifest = ref('{}'),
  runs = ref<Run[]>([])
const testCase = computed(() => evaluations.value.find((e) => e.handle === caseHandle.value))
async function execute(work: () => Promise<void>) {
  loading.value = true
  error.value = ''
  try {
    await work()
  } catch (e) {
    error.value = axios.isAxiosError(e)
      ? String(e.response?.data?.message ?? t('aiPrompt.failed'))
      : e instanceof Error
        ? e.message
        : t('aiPrompt.failed')
    pushMessage('error', 'aiPrompt.failed', error.value, 'aiPrompt')
  } finally {
    loading.value = false
  }
}
async function reload() {
  templates.value = (await axios.get<PromptTemplate[]>(buildApiUrl('ai/prompts'))).data
  if (selected.value) {
    const updated = templates.value.find((item) => item.handle === selected.value!.handle)
    if (updated) {
      selected.value = updated
      draft.value = updated.draft
    }
  }
}
async function select(item: PromptTemplate) {
  selected.value = item
  draft.value = item.draft
  previewText.value = ''
  versionHandle.value = null
  versions.value = []
  usages.value = []
  values.value = JSON.stringify(Object.fromEntries(item.variables.map((v) => [v, ''])), null, 2)
  await execute(async () => {
    const [versionResponse, usageResponse] = await Promise.all([
      axios.get<PromptVersion[]>(
        buildApiUrl(`ai/prompts/${encodeURIComponent(item.handle)}/versions`),
      ),
      axios.get<string[]>(buildApiUrl(`ai/prompts/${encodeURIComponent(item.handle)}/usage`)),
    ])
    versions.value = versionResponse.data
    usages.value = usageResponse.data
  })
}
const key = () => encodeURIComponent(selected.value!.handle)
async function save() {
  await execute(async () => {
    await ApiGenericService.update('aiPromptTemplate', selected.value!.handle, {
      draft: draft.value,
    })
    await reload()
  })
}
async function preview() {
  await execute(async () => {
    const result = await axios.post<{ content: string }>(
      buildApiUrl(`ai/prompts/${key()}/preview`),
      {
        values: JSON.parse(values.value),
        ...(versionHandle.value ? { versionHandle: versionHandle.value } : {}),
      },
    )
    previewText.value = result.data.content
  })
}
async function publish(restoreVersion?: number) {
  await execute(async () => {
    await axios.post(buildApiUrl(`ai/prompts/${key()}/publish`), {
      changeNote: changeNote.value,
      ...(restoreVersion ? { restoreVersion } : {}),
    })
    await reload()
    versions.value = (
      await axios.get<PromptVersion[]>(buildApiUrl(`ai/prompts/${key()}/versions`))
    ).data
  })
}
function selectCase() {
  expectations.value = JSON.stringify(
    testCase.value?.expectations ?? {
      requiredTools: [],
      forbiddenTools: ['generic_delete'],
      contains: [],
      maxToolCalls: 10,
    },
    null,
    2,
  )
  fixtures.value = JSON.stringify(testCase.value?.toolFixtures ?? {}, null, 2)
}
async function saveCase() {
  await execute(async () => {
    const data = {
      expectations: JSON.parse(expectations.value),
      toolFixtures: JSON.parse(fixtures.value),
    }
    await ApiGenericService.update('aiAgentEvaluation', caseHandle.value!, data)
    Object.assign(testCase.value!, data)
  })
}
async function runTests() {
  await execute(async () => {
    const override = JSON.parse(manifest.value)
    const result = await axios.post<Run[]>(
      buildApiUrl(`ai/agents/${props.agentHandle}/evaluations/run`),
      {
        handles: [caseHandle.value],
        ...(Object.keys(override).length ? { manifest: override } : {}),
      },
    )
    runs.value = [...result.data, ...runs.value]
  })
}
async function loadContext() {
  await execute(async () => {
    effectiveContext.value = (
      await axios.get<{ content: string }>(
        buildApiUrl(`ai/agents/${props.agentHandle}/prompt-preview`),
      )
    ).data.content
  })
}
onMounted(() =>
  execute(async () => {
    await reload()
    if (props.agentHandle) {
      const [cases, recent] = await Promise.all([
        axios.get<Evaluation[]>(buildApiUrl(`ai/agents/${props.agentHandle}/evaluations`)),
        axios.get<Run[]>(buildApiUrl(`ai/agents/${props.agentHandle}/runs`)),
      ])
      evaluations.value = cases.data
      runs.value = recent.data.filter((run) => run.evaluationResult)
    }
  }),
)
</script>
