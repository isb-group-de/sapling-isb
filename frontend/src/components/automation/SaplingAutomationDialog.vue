<template>
  <SaplingDialog v-model="state.visible" size="3xl" :height="SAPLING_DIALOG_HEIGHT.xl">
    <SaplingDialogCard
      class="sapling-dialog-card--fill sapling-automation-dialog"
      :close="close"
      :tilt="false"
    >
      <div class="sapling-stack-xl sapling-record-dialog-shell">
        <v-card-title class="sapling-record-dialog-header"
          ><SaplingDialogEditHero
            :title="`${t('automation.title')} · ${t(`navigation.${state.entity}`)}`"
        /></v-card-title>
        <v-tabs v-model="tab"
          ><v-tab value="plan">{{ t('automation.plan') }}</v-tab
          ><v-tab v-if="state.handle" value="history">{{ t('automation.history') }}</v-tab></v-tabs
        >
        <v-card-text class="sapling-record-dialog-content sapling-automation-dialog__body">
          <v-btn v-if="error" @click="load">{{ t('global.retry') }}</v-btn>
          <v-progress-linear v-if="loading" indeterminate />
          <template v-else-if="tab === 'plan' && graph">
            <p>{{ t('automation.planExplanation') }}</p>
            <p v-if="graph.nodes.some((node) => node.cycle)">
              {{ t('automation.cycleExplanation') }}
            </p>
            <div class="sapling-automation-dialog__toolbar">
              <SaplingSwitch
                v-model="includeInactive"
                :label="t('automation.includeInactive')"
                hide-details
                @update:model-value="load"
              />
              <v-btn @click="list = !list">{{
                t(list ? 'automation.graph' : 'automation.list')
              }}</v-btn>
              <v-btn v-if="depth < 8" @click="expand">{{ t('automation.expand') }}</v-btn>
            </div>
            <v-alert
              v-if="graph.truncated || graph.continuations.length"
              type="info"
              variant="tonal"
              >{{ t('automation.continuations') }}
              <v-btn
                v-for="entity in graph.continuations"
                :key="entity"
                @click="openAutomationInspector(entity)"
                >{{ t(`navigation.${entity}`) }}</v-btn
              >
            </v-alert>
            <p v-if="!graph.nodes.length">{{ t('automation.noRules') }}</p>
            <v-list v-if="list"
              ><v-list-item
                v-for="rule in rules"
                :key="rule.id"
                :title="rule.title"
                :subtitle="`${t(`navigation.${rule.sourceEntity}`)} → ${t(`navigation.${rule.targetEntity}`)} · ${t(`automation.kind.${rule.kind}`)}`"
                @click="selected = rule"
            /></v-list>
            <SaplingAutomationGraph
              v-else
              :graph="graph"
              :field-label="fieldLabel"
              :value-label="valueLabel"
              @select="selected = $event.rule ?? null"
            />
            <SaplingAutomationRuleDetails
              v-if="selected"
              :selected="selected"
              :field-label="fieldLabel"
              :value-label="valueLabel"
              @open="editRule"
            />
          </template>
          <SaplingAutomationHistory v-else-if="history" :history="history" @navigate="close" />
        </v-card-text>
        <SaplingActionBar>
          <template #leading
            ><v-btn variant="text" prepend-icon="mdi-close" @click="close">{{
              t('global.close')
            }}</v-btn></template
          >
          <template v-if="tab === 'history' && history" #trailing>
            <v-btn variant="text" :disabled="loading || page <= 1" @click="changePage(-1)">{{
              t('global.previous')
            }}</v-btn
            ><span>{{ page }}</span
            ><v-btn variant="text" :disabled="loading || !history.hasMore" @click="changePage(1)">{{
              t('global.next')
            }}</v-btn>
          </template></SaplingActionBar
        >
      </div>
    </SaplingDialogCard>
  </SaplingDialog>
</template>
<script setup lang="ts">
import SaplingDialogEditHero from '@/components/common/SaplingDialogEditHero.vue'
import SaplingActionBar from '@/components/actions/SaplingActionBar.vue'
import SaplingAutomationHistory from './SaplingAutomationHistory.vue'
import SaplingAutomationRuleDetails from './SaplingAutomationRuleDetails.vue'
import SaplingSwitch from '@/components/common/SaplingSwitch.vue'
import { SAPLING_DIALOG_HEIGHT } from '@/constants/dialog.constants'
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import { computed, ref, watch } from 'vue'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import { useAutomationLabels } from './useAutomationLabels'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { buildApiUrl } from '@/services/api.client'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingAutomationGraph from './SaplingAutomationGraph.vue'
import { automationInspector as state, openAutomationInspector } from './automationInspector'
import type {
  AutomationGraph,
  AutomationHistory,
  AutomationRule,
} from './automationInspection.types'
const { t } = useI18n(),
  router = useRouter(),
  person = useCurrentPersonStore()
useTranslationLoader('automation', 'global', 'navigation')
const { pushMessage } = useSaplingMessageCenter()
const tab = ref('plan'),
  loading = ref(false),
  error = ref(''),
  includeInactive = ref(false),
  list = ref(false),
  depth = ref(1),
  page = ref(1)
const graph = ref<AutomationGraph | null>(null),
  history = ref<AutomationHistory | null>(null),
  selected = ref<AutomationRule | null>(null)
let request = 0
const rules = computed(() => [
  ...new Map(
    graph.value?.nodes.flatMap((n) => (n.rule ? [[n.rule.id, n.rule] as const] : [])) ?? [],
  ).values(),
])
const { fieldLabel, valueLabel } = useAutomationLabels(rules)
function close() {
  state.visible = false
  request++
}
function editRule(rule: AutomationRule) {
  close()
  void router.push({
    path: `/table/${rule.configurationEntity}`,
    query: { filter: JSON.stringify({ handle: Number(rule.handle) }) },
  })
}
function expand() {
  depth.value++
  void load()
}
function changePage(delta: number) {
  page.value += delta
  void load()
}
async function load() {
  if (!person.isAdministrator) {
    close()
    return
  }
  const id = ++request
  loading.value = true
  error.value = ''
  try {
    const route =
      tab.value === 'history' && state.handle
        ? `automation/history/${encodeURIComponent(state.entity)}/${encodeURIComponent(state.handle)}`
        : `automation/graph/${encodeURIComponent(state.entity)}`
    const { data } = await axios.get(buildApiUrl(route), {
      params:
        tab.value === 'history'
          ? { page: page.value }
          : { depth: depth.value, includeInactive: String(includeInactive.value) },
    })
    if (id !== request) return
    if (tab.value === 'history') history.value = data as AutomationHistory
    else graph.value = data as AutomationGraph
  } catch {
    if (id === request) {
      error.value = t('automation.loadFailed')
      pushMessage('error', 'automation.loadFailed', '', 'automation')
    }
  } finally {
    if (id === request) loading.value = false
  }
}
watch(
  () => [state.entity, state.handle],
  () => {
    page.value = 1
    depth.value = 1
    selected.value = null
    graph.value = null
    history.value = null
    void load()
  },
  { immediate: true },
)
watch(tab, () => void load())
watch(
  () => person.isAdministrator,
  (value) => {
    if (!value) close()
  },
)
</script>
