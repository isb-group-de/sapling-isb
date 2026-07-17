<template>
  <section class="sapling-ai-agent-builder__run-history" aria-labelledby="agent-run-history-title">
    <header class="sapling-ai-agent-builder__run-history-header">
      <div>
        <strong id="agent-run-history-title">{{
          label('recentRunsTitle', 'Letzte Läufe', 'Recent runs')
        }}</strong>
        <p>
          {{
            label(
              'recentRunsSubtitle',
              'Neueste zuerst. Öffne einen Lauf für Tools, Quellen, Antwort und Fehlerdetails.',
              'Newest first. Open a run to inspect tools, sources, response, and errors.',
            )
          }}
        </p>
      </div>
      <v-chip size="small" variant="tonal" color="primary">
        {{ runs.length }} {{ t('aiAgentBuilder.runs') }}
      </v-chip>
    </header>

    <div v-if="runRows.length" class="sapling-ai-agent-builder__run-list">
      <article
        v-for="row in runRows"
        :key="row.key"
        class="sapling-ai-agent-builder__run-card"
        :class="`sapling-ai-agent-builder__run-card--${normalizeStatus(row.run.status)}`"
      >
        <button
          class="sapling-ai-agent-builder__run-summary"
          type="button"
          :aria-expanded="isExpanded(row.key)"
          :aria-controls="row.detailsId"
          @click="toggleExpanded(row.key)"
        >
          <span
            class="sapling-ai-agent-builder__run-status-icon"
            :class="`sapling-ai-agent-builder__run-status-icon--${normalizeStatus(row.run.status)}`"
          >
            <v-icon :icon="getRunStatusIcon(row.run.status)" size="19" />
          </span>

          <span class="sapling-ai-agent-builder__run-identity">
            <span class="sapling-ai-agent-builder__run-title-line">
              <strong>{{ row.run.model || t('global.notAvailable') }}</strong>
              <v-chip size="x-small" variant="tonal" :color="getRunStatusColor(row.run.status)">
                {{ formatRunStatus(row.run.status) }}
              </v-chip>
            </span>
            <span class="sapling-ai-agent-builder__run-subtitle">
              <span v-if="row.run.provider">{{ row.run.provider }}</span>
              <span v-if="row.contextLabel">{{ row.contextLabel }}</span>
              <time :datetime="toDateTimeAttribute(row.run.startedAt)">
                {{ formatDate(row.run.startedAt) }}
              </time>
            </span>
          </span>

          <span class="sapling-ai-agent-builder__run-facts">
            <span>
              <v-icon icon="mdi-timer-outline" size="16" />
              {{ formatRunDuration(row.run.durationMs, locale) }}
            </span>
            <span v-if="row.toolCalls.length">
              <v-icon icon="mdi-tools" size="16" />
              {{ row.toolCalls.length }} {{ label('toolCalls', 'Tools', 'tools') }}
            </span>
            <span v-if="row.sources.length">
              <v-icon icon="mdi-source-branch" size="16" />
              {{ row.sources.length }} {{ label('sources', 'Quellen', 'sources') }}
            </span>
            <span v-if="row.pendingActions.length">
              <v-icon icon="mdi-shield-lock-outline" size="16" />
              {{ row.pendingActions.length }} {{ t('aiAgentBuilder.actions') }}
            </span>
          </span>

          <v-icon
            class="sapling-ai-agent-builder__run-chevron"
            :icon="isExpanded(row.key) ? 'mdi-chevron-up' : 'mdi-chevron-down'"
            size="20"
          />
        </button>

        <div
          v-if="isExpanded(row.key)"
          :id="row.detailsId"
          class="sapling-ai-agent-builder__run-details"
        >
          <div v-if="hasUsageMetrics(row.usage)" class="sapling-ai-agent-builder__trace-section">
            <h3>
              <v-icon icon="mdi-counter" size="18" />
              {{ label('tokenUsage', 'Token-Nutzung', 'Token usage') }}
            </h3>
            <div class="sapling-ai-agent-builder__token-metrics">
              <span v-if="row.usage.totalTokens != null">
                <small>{{ label('totalTokens', 'Gesamt', 'Total') }}</small>
                <strong>{{ formatRunInteger(row.usage.totalTokens, locale) }}</strong>
              </span>
              <span v-if="row.usage.inputTokens != null">
                <small>{{ label('inputTokens', 'Eingabe', 'Input') }}</small>
                <strong>{{ formatRunInteger(row.usage.inputTokens, locale) }}</strong>
              </span>
              <span v-if="row.usage.outputTokens != null">
                <small>{{ label('outputTokens', 'Ausgabe', 'Output') }}</small>
                <strong>{{ formatRunInteger(row.usage.outputTokens, locale) }}</strong>
              </span>
            </div>
          </div>

          <div
            v-if="row.toolCalls.length"
            class="sapling-ai-agent-builder__trace-section sapling-ai-agent-builder__trace-section--wide"
          >
            <h3>
              <v-icon icon="mdi-tools" size="18" />
              {{ label('toolCalls', 'Tool-Aufrufe', 'Tool calls') }}
              <span>{{ row.toolCalls.length }}</span>
            </h3>
            <div class="sapling-ai-agent-builder__tool-trace">
              <article
                v-for="(toolCall, toolIndex) in row.toolCalls"
                :key="`${formatRunToolLabel(toolCall)}-${toolIndex}`"
                class="sapling-ai-agent-builder__tool-call"
              >
                <div class="sapling-ai-agent-builder__tool-call-heading">
                  <span
                    class="sapling-ai-agent-builder__tool-call-icon"
                    :class="`sapling-ai-agent-builder__tool-call-icon--${normalizeToolStatus(toolCall.status)}`"
                  >
                    <v-icon :icon="getToolStatusIcon(toolCall.status)" size="16" />
                  </span>
                  <div>
                    <strong>{{ formatRunToolLabel(toolCall) }}</strong>
                    <span>
                      {{ formatToolStatus(toolCall.status) }}
                      <template v-if="getFiniteNumber(toolCall.resultCount) != null">
                        · {{ formatRunInteger(getFiniteNumber(toolCall.resultCount)!, locale) }}
                        {{ label('results', 'Treffer', 'results') }}
                      </template>
                      <template v-if="getFiniteNumber(toolCall.durationMs) != null">
                        · {{ formatRunDuration(getFiniteNumber(toolCall.durationMs), locale) }}
                      </template>
                    </span>
                  </div>
                </div>

                <dl
                  v-if="getTraceArguments(toolCall).length"
                  class="sapling-ai-agent-builder__trace-arguments"
                >
                  <div v-for="argument in getTraceArguments(toolCall)" :key="argument.key">
                    <dt>{{ argument.key }}</dt>
                    <dd>{{ argument.value }}</dd>
                  </div>
                </dl>

                <div
                  v-if="toStringArray(toolCall.sourceEntityHandles).length"
                  class="sapling-ai-agent-builder__trace-tags"
                >
                  <v-chip
                    v-for="entityHandle in toStringArray(toolCall.sourceEntityHandles)"
                    :key="entityHandle"
                    size="x-small"
                    variant="outlined"
                  >
                    {{ entityHandle }}
                  </v-chip>
                </div>

                <v-alert
                  v-if="toStringArray(toolCall.repairHints).length"
                  density="compact"
                  type="warning"
                  variant="tonal"
                >
                  {{ toStringArray(toolCall.repairHints).join(' ') }}
                </v-alert>
              </article>
            </div>
          </div>

          <div
            v-if="row.sources.length"
            class="sapling-ai-agent-builder__trace-section sapling-ai-agent-builder__trace-section--wide"
          >
            <h3>
              <v-icon icon="mdi-source-branch" size="18" />
              {{ label('sources', 'Quellen und Navigation', 'Sources and navigation') }}
              <span>{{ row.sources.length }}</span>
            </h3>
            <div class="sapling-ai-agent-builder__source-list">
              <article
                v-for="(source, sourceIndex) in row.sources"
                :key="`${formatRunSourceTitle(source)}-${sourceIndex}`"
              >
                <v-icon
                  :icon="
                    toText(source.kind) === 'navigation'
                      ? 'mdi-open-in-new'
                      : 'mdi-database-outline'
                  "
                  size="17"
                />
                <div>
                  <strong>{{ formatRunSourceTitle(source) }}</strong>
                  <span v-if="formatRunSourceMeta(source).length">
                    {{ formatRunSourceMeta(source).join(' · ') }}
                  </span>
                </div>
              </article>
            </div>
          </div>

          <div v-if="row.pendingActions.length" class="sapling-ai-agent-builder__trace-section">
            <h3>
              <v-icon icon="mdi-shield-lock-outline" size="18" />
              {{ label('pendingActions', 'Vorbereitete Aktionen', 'Prepared actions') }}
              <span>{{ row.pendingActions.length }}</span>
            </h3>
            <div class="sapling-ai-agent-builder__trace-tags">
              <v-chip
                v-for="(action, actionIndex) in row.pendingActions"
                :key="`${formatRunToolLabel(action)}-${actionIndex}`"
                color="info"
                size="small"
                variant="tonal"
                prepend-icon="mdi-lock-outline"
              >
                {{ formatRunToolLabel(action) }} · {{ toText(action.status) || 'pending' }}
              </v-chip>
            </div>
          </div>

          <div
            v-if="row.run.responseText"
            class="sapling-ai-agent-builder__trace-section sapling-ai-agent-builder__trace-section--wide"
          >
            <h3>
              <v-icon icon="mdi-message-text-outline" size="18" />
              {{ label('response', 'Antwort', 'Response') }}
            </h3>
            <p class="sapling-ai-agent-builder__trace-copy">{{ row.run.responseText }}</p>
          </div>

          <div
            v-if="row.error"
            class="sapling-ai-agent-builder__trace-section sapling-ai-agent-builder__trace-section--wide"
          >
            <h3>
              <v-icon icon="mdi-alert-circle-outline" size="18" />
              {{ label('errorDetails', 'Fehlerdetails', 'Error details') }}
            </h3>
            <p
              class="sapling-ai-agent-builder__trace-copy sapling-ai-agent-builder__trace-copy--error"
            >
              {{ row.error }}
            </p>
          </div>

          <v-alert v-if="!row.hasDetails" density="compact" type="info" variant="tonal">
            {{
              label(
                'noRunDetails',
                'Für diesen Lauf wurden keine weiteren Details aufgezeichnet.',
                'No additional details were recorded for this run.',
              )
            }}
          </v-alert>
        </div>
      </article>
    </div>

    <v-alert v-else density="compact" type="info" variant="tonal">
      {{
        label(
          'noRuns',
          'Für diesen Agent sind noch keine Läufe vorhanden.',
          'No runs are available for this agent yet.',
        )
      }}
    </v-alert>
  </section>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AiAgentRunItem } from '@/entity/entity'
import {
  formatRunDuration,
  formatRunError,
  formatRunInteger,
  formatRunSourceMeta,
  formatRunSourceTitle,
  formatRunToolLabel,
  getFiniteNumber,
  getRunPendingActions,
  getRunSources,
  getRunToolCalls,
  getRunUsageMetrics,
  getTraceArguments,
  hasUsageMetrics,
  toText,
} from './aiAgentRunTrace.utils'

const props = defineProps<{
  runs: AiAgentRunItem[]
}>()

const { locale, t, te } = useI18n()
const expandedRunKeys = ref(new Set<string>())

const runRows = computed(() =>
  props.runs.map((run, index) => {
    const key = String(run.handle ?? run.startedAt ?? `run-${index}`)
    const toolCalls = getRunToolCalls(run)
    const sources = getRunSources(run)
    const pendingActions = getRunPendingActions(run)
    const usage = getRunUsageMetrics(run)
    const error = formatRunError(run)
    const contextLabel = [run.contextEntityHandle, run.contextRecordHandle]
      .filter(Boolean)
      .join(' #')

    return {
      run,
      key,
      detailsId: `agent-run-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
      toolCalls,
      sources,
      pendingActions,
      usage,
      error,
      contextLabel,
      hasDetails:
        toolCalls.length > 0 ||
        sources.length > 0 ||
        pendingActions.length > 0 ||
        hasUsageMetrics(usage) ||
        !!run.responseText ||
        !!error,
    }
  }),
)

watch(
  runRows,
  (rows) => {
    const availableKeys = new Set(rows.map((row) => row.key))
    const nextKeys = new Set([...expandedRunKeys.value].filter((key) => availableKeys.has(key)))

    expandedRunKeys.value = nextKeys
  },
  { immediate: true },
)

function toggleExpanded(key: string): void {
  const nextKeys = new Set(expandedRunKeys.value)
  if (nextKeys.has(key)) nextKeys.delete(key)
  else nextKeys.add(key)
  expandedRunKeys.value = nextKeys
}

function isExpanded(key: string): boolean {
  return expandedRunKeys.value.has(key)
}

function label(property: string, germanFallback: string, englishFallback: string): string {
  const key = `aiAgentBuilder.${property}`
  if (te(key)) return t(key)
  return locale.value.toLowerCase().startsWith('de') ? germanFallback : englishFallback
}

function formatDate(value?: Date | string | null): string {
  if (!value) return t('global.notAvailable')

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return t('global.notAvailable')

  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date)
}

function toDateTimeAttribute(value?: Date | string | null): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function normalizeStatus(status: string): string {
  const normalized = status.trim().toLowerCase()
  if (['completed', 'failed', 'running'].includes(normalized)) return normalized
  return 'unknown'
}

function getRunStatusColor(status: string): string | undefined {
  switch (normalizeStatus(status)) {
    case 'completed':
      return 'success'
    case 'failed':
      return 'error'
    case 'running':
      return 'info'
    default:
      return undefined
  }
}

function getRunStatusIcon(status: string): string {
  switch (normalizeStatus(status)) {
    case 'completed':
      return 'mdi-check-circle-outline'
    case 'failed':
      return 'mdi-alert-circle-outline'
    case 'running':
      return 'mdi-progress-clock'
    default:
      return 'mdi-help-circle-outline'
  }
}

function formatRunStatus(status: string): string {
  switch (normalizeStatus(status)) {
    case 'completed':
      return label('statusCompleted', 'Abgeschlossen', 'Completed')
    case 'failed':
      return label('statusFailed', 'Fehlgeschlagen', 'Failed')
    case 'running':
      return label('statusRunning', 'Läuft', 'Running')
    default:
      return status || t('global.notAvailable')
  }
}

function normalizeToolStatus(status: unknown): string {
  const normalized = toText(status).toLowerCase()
  return ['success', 'repair', 'blocked', 'error'].includes(normalized) ? normalized : 'unknown'
}

function getToolStatusIcon(status: unknown): string {
  switch (normalizeToolStatus(status)) {
    case 'success':
      return 'mdi-check'
    case 'repair':
      return 'mdi-wrench-outline'
    case 'blocked':
      return 'mdi-lock-outline'
    case 'error':
      return 'mdi-alert-outline'
    default:
      return 'mdi-tools'
  }
}

function formatToolStatus(status: unknown): string {
  switch (normalizeToolStatus(status)) {
    case 'success':
      return label('statusSuccess', 'Erfolgreich', 'Successful')
    case 'repair':
      return label('statusRepair', 'Korrektur nötig', 'Repair needed')
    case 'blocked':
      return label('statusBlocked', 'Bestätigung nötig', 'Confirmation required')
    case 'error':
      return label('statusError', 'Fehler', 'Error')
    default:
      return toText(status) || t('global.notAvailable')
  }
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && !!item.trim())
    : []
}
</script>
