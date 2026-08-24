<template>
  <div v-if="actions.length > 0" class="sapling-stack-sm sapling-ai-chat__tool-actions">
    <div
      v-for="action in actions"
      :key="action.handle ?? `${action.serverName}.${action.toolName}`"
      class="sapling-ai-chat__tool-action"
      :class="{ 'sapling-ai-chat__tool-action--compact': action.status !== 'pending' }"
    >
      <div class="sapling-row-between-md sapling-ai-chat__tool-action-header">
        <div class="sapling-ai-chat__tool-action-copy">
          <strong class="sapling-ai-chat__tool-action-title">{{
            getToolActionTitle(action)
          }}</strong>
          <span v-if="getToolActionSummary(action)" class="sapling-ai-chat__tool-action-summary">
            {{ getToolActionSummary(action) }}
          </span>
        </div>
        <div class="sapling-ai-chat__tool-action-meta">
          <v-chip size="small" variant="tonal">{{ getToolActionStatusLabel(action) }}</v-chip>
        </div>
      </div>
      <v-alert
        v-if="getToolActionError(action)"
        class="sapling-ai-chat__tool-action-error"
        density="compact"
        type="error"
        variant="tonal"
      >
        {{ getToolActionError(action) }}
      </v-alert>
      <div
        v-if="action.status === 'pending' && action.handle"
        class="sapling-row-xs sapling-ai-chat__tool-action-actions"
      >
        <v-btn
          size="small"
          color="primary"
          variant="tonal"
          prepend-icon="mdi-check"
          :disabled="isToolActionSubmitting(action)"
          :loading="isToolActionSubmitting(action)"
          @click="emit('confirm', action)"
        >
          {{ t('aiChat.confirmToolAction') }}
        </v-btn>
        <v-btn
          size="small"
          variant="text"
          prepend-icon="mdi-close"
          :disabled="isToolActionSubmitting(action)"
          @click="emit('reject', action)"
        >
          {{ t('aiChat.rejectToolAction') }}
        </v-btn>
        <v-btn
          v-if="hasToolActionTechnicalDetails(action)"
          size="small"
          variant="text"
          prepend-icon="mdi-information-outline"
          @click="openToolActionTechnicalDetails(action)"
        >
          {{ getToolActionDetailsButtonLabel() }}
        </v-btn>
      </div>
      <div
        v-else-if="
          hasToolActionTechnicalDetails(action) || getToolActionNavigationLinks(action).length > 0
        "
        class="sapling-row-xs sapling-ai-chat__tool-action-actions"
      >
        <v-btn
          v-for="link in getToolActionNavigationLinks(action)"
          :key="`${action.handle ?? `${action.serverName}.${action.toolName}`}-${link.path}`"
          size="small"
          variant="tonal"
          prepend-icon="mdi-open-in-app"
          @click="openNavigationLink(link.path)"
        >
          {{ getNavigationLinkLabel(link) }}
        </v-btn>
        <v-btn
          v-if="hasToolActionTechnicalDetails(action)"
          size="small"
          variant="text"
          prepend-icon="mdi-information-outline"
          @click="openToolActionTechnicalDetails(action)"
        >
          {{ getToolActionDetailsButtonLabel() }}
        </v-btn>
      </div>
    </div>
    <SaplingDialog
      :model-value="!!activeToolActionDetails"
      size="md"
      class="sapling-ai-chat__tool-action-details-dialog"
      @update:model-value="handleToolActionDetailsDialogUpdate"
    >
      <SaplingDialogCard
        class="sapling-ai-chat__tool-action-details-card"
        :tilt="false"
        :close="closeToolActionTechnicalDetails"
      >
        <div class="sapling-dialog-shell sapling-ai-chat__tool-action-details-shell">
          <SaplingDialogHero
            :eyebrow="getToolActionDetailsButtonLabel()"
            :title="getActiveToolActionDetailsTitle()"
          />
          <div class="sapling-ai-chat__tool-action-details-body">
            <p v-if="activeToolActionDetails" class="sapling-ai-chat__tool-action-details-intro">
              {{ getToolActionTechnicalDetailsIntro(activeToolActionDetails) }}
            </p>
            <div
              v-if="
                activeToolActionDetails &&
                getToolActionPreviewRows(activeToolActionDetails).length > 0
              "
              class="sapling-ai-chat__tool-action-preview"
            >
              <div
                v-for="row in getToolActionPreviewRows(activeToolActionDetails)"
                :key="row.key"
                class="sapling-ai-chat__tool-action-preview-row"
              >
                <span class="sapling-ai-chat__tool-action-preview-label">{{ row.label }}</span>
                <span class="sapling-ai-chat__tool-action-preview-value">{{ row.value }}</span>
              </div>
            </div>
            <v-expansion-panels
              v-if="activeToolActionDetails"
              class="sapling-ai-chat__tool-action-technical-panel"
              variant="accordion"
            >
              <v-expansion-panel>
                <v-expansion-panel-title>{{ getTechnicalRawDataLabel() }}</v-expansion-panel-title>
                <v-expansion-panel-text>
                  <pre
                    class="sapling-ai-chat__tool-action-arguments sapling-ai-chat__tool-action-arguments--dialog"
                    >{{ formatToolActionTechnicalDetails(activeToolActionDetails) }}</pre>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </div>
          <SaplingActionBar>
            <template #leading>
              <v-btn
                variant="text"
                prepend-icon="mdi-close"
                @click="closeToolActionTechnicalDetails"
              >
                {{ getCloseButtonLabel() }}
              </v-btn>
            </template>
          </SaplingActionBar>
        </div>
      </SaplingDialogCard>
    </SaplingDialog>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingActionBar from '@/components/actions/SaplingActionBar.vue'
import SaplingDialogHero from '@/components/common/SaplingDialogHero.vue'
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import type { AiChatToolActionItem } from '@/entity/entity'
import {
  asRecord,
  extractEntityHandle,
  extractHandleValue,
  getToolActionNavigationLinks,
} from './aiChatNavigation'
import { useSaplingAiChatNavigation } from './useSaplingAiChatNavigation'

interface ToolActionPreviewRow {
  key: string
  label: string
  value: string
}

const props = defineProps<{
  actions: AiChatToolActionItem[]
  activeToolActionHandles: Record<number, boolean>
}>()

const emit = defineEmits<{
  (event: 'confirm', action: AiChatToolActionItem): void
  (event: 'reject', action: AiChatToolActionItem): void
  (event: 'close'): void
}>()

const { t, te } = useI18n()
const { getNavigationEntityLabel, getNavigationLinkLabel, openNavigationLink } =
  useSaplingAiChatNavigation({ onNavigated: () => emit('close') })
const activeToolActionDetails = ref<AiChatToolActionItem | null>(null)

function isToolActionSubmitting(action: AiChatToolActionItem) {
  return !!action.handle && !!props.activeToolActionHandles[action.handle]
}

function getToolActionStatusLabel(action: AiChatToolActionItem) {
  const key = `aiChat.toolActionStatus.${action.status}`
  return te(key) ? t(key) : ''
}

function getToolActionTitle(action: AiChatToolActionItem) {
  const kind = getToolActionKind(action)
  const entityLabel = getToolActionEntityLabel(action)
  const entityResultTitle = getToolActionEntityResultTitle(kind, action.status, entityLabel)

  if (entityResultTitle) {
    return entityResultTitle
  }

  const key = `aiChat.toolActionTitle.${kind}.${action.status}`
  return te(key) ? t(key) : te('aiChat.toolActionTitle') ? t('aiChat.toolActionTitle') : ''
}

function getToolActionEntityResultTitle(kind: string, status: string, entityLabel: string | null) {
  if (!entityLabel || status !== 'executed' || !['create', 'update', 'delete'].includes(kind)) {
    return null
  }

  return t(`aiChat.toolActionResult.${kind}`, { entity: entityLabel })
}

function getToolActionKind(action: AiChatToolActionItem) {
  const kinds: Record<string, string> = {
    generic_create: 'create',
    generic_update: 'update',
    generic_delete: 'delete',
    import_configure_batch: 'importConfigure',
    import_execute_batch: 'importExecute',
  }
  return kinds[action.toolName] ?? 'action'
}

function getToolActionSummary(action: AiChatToolActionItem) {
  const entityLabel = getToolActionEntityLabel(action)

  if (entityLabel && (action.status === 'pending' || action.status === 'failed')) {
    return entityLabel
  }

  return action.toolName === 'import_configure_batch' || action.toolName === 'import_execute_batch'
    ? t('aiChat.toolActionImportSummary')
    : ''
}

function getToolActionEntityLabel(action: AiChatToolActionItem) {
  const entityHandle =
    extractEntityHandle(action.arguments) ?? extractEntityHandle(action.resultPayload)
  return entityHandle ? getNavigationEntityLabel(entityHandle, 1) : null
}

function hasToolActionTechnicalDetails(action: AiChatToolActionItem) {
  return [action.arguments, action.resultPayload, action.errorPayload].some(hasPayloadContent)
}

function hasPayloadContent(value: unknown) {
  if (value == null) return false
  if (Array.isArray(value)) return value.length > 0
  return typeof value === 'object' ? Object.keys(value).length > 0 : true
}

function getToolActionDetailsButtonLabel() {
  return te('aiChat.toolActionDetails') ? t('aiChat.toolActionDetails') : ''
}

function getTechnicalRawDataLabel() {
  return te('aiChat.toolActionTechnicalRawData') ? t('aiChat.toolActionTechnicalRawData') : ''
}

function openToolActionTechnicalDetails(action: AiChatToolActionItem) {
  activeToolActionDetails.value = action
}

function closeToolActionTechnicalDetails() {
  activeToolActionDetails.value = null
}

function handleToolActionDetailsDialogUpdate(isOpen: boolean) {
  if (!isOpen) closeToolActionTechnicalDetails()
}

function getActiveToolActionDetailsTitle() {
  return activeToolActionDetails.value
    ? getToolActionTitle(activeToolActionDetails.value)
    : getToolActionDetailsButtonLabel()
}

function getToolActionTechnicalDetailsIntro(action: AiChatToolActionItem) {
  const entityLabel = getToolActionEntityLabel(action)
  const status = ['executed', 'failed'].includes(action.status) ? action.status : 'pending'
  const suffix = entityLabel ? 'WithEntity' : ''
  return t(`aiChat.toolActionIntro.${status}${suffix}`, entityLabel ? { entity: entityLabel } : {})
}

function getToolActionPreviewRows(action: AiChatToolActionItem): ToolActionPreviewRow[] {
  const args = asRecord(action.arguments)
  const entityHandle =
    extractEntityHandle(action.arguments) ?? extractEntityHandle(action.resultPayload)
  const rows: ToolActionPreviewRow[] = []

  if (entityHandle) {
    rows.push({
      key: 'entityHandle',
      label: t('aiChat.toolActionRecordType'),
      value: getNavigationEntityLabel(entityHandle, 1),
    })
  }

  const recordHandle = extractHandleValue(args?.handle)
  if (recordHandle != null) {
    rows.push({ key: 'handle', label: t('aiChat.toolActionRecord'), value: String(recordHandle) })
  }

  const data = asRecord(args?.data)
  if (data) {
    for (const [key, value] of Object.entries(data)) {
      rows.push({
        key: `data.${key}`,
        label: getToolActionFieldLabel(entityHandle, key),
        value: formatToolActionPreviewValue(value),
      })
    }
  }

  if (rows.length <= (entityHandle ? 1 : 0) && args) {
    const skippedArgumentKeys = new Set(['entityHandle', 'data', 'relations'])
    for (const [key, value] of Object.entries(args)) {
      if (!skippedArgumentKeys.has(key)) {
        rows.push({
          key: `argument.${key}`,
          label: getToolActionFieldLabel(entityHandle, key),
          value: formatToolActionPreviewValue(value),
        })
      }
    }
  }

  return rows.slice(0, 24)
}

function getToolActionFieldLabel(entityHandle: string | null, fieldName: string) {
  const fieldKey = entityHandle ? `${entityHandle}.${fieldName}` : ''
  return fieldKey && te(fieldKey) ? String(t(fieldKey)).trim() : ''
}

function formatToolActionPreviewValue(value: unknown): string {
  if (value == null) return t('global.empty')
  if (typeof value === 'boolean') return value ? t('global.yes') : t('global.no')
  if (typeof value === 'string') return value.trim() || t('global.empty')
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : t('global.empty')
  if (Array.isArray(value)) {
    if (value.length === 0) return t('global.empty')
    const preview = value.slice(0, 5).map(formatToolActionPreviewValue).join(', ')
    return value.length > 5 ? `${preview}, ...` : preview
  }

  const record = asRecord(value)
  for (const key of [
    'label',
    'displayName',
    'name',
    'title',
    'subject',
    'number',
    'code',
    'handle',
  ]) {
    const displayValue = record?.[key]
    if (['string', 'number', 'boolean'].includes(typeof displayValue)) {
      return formatToolActionPreviewValue(displayValue)
    }
  }

  const text = JSON.stringify(value)
  return text && text.length > 120 ? `${text.slice(0, 117)}...` : (text ?? t('global.empty'))
}

function formatToolActionTechnicalDetails(action: AiChatToolActionItem) {
  const text = JSON.stringify(
    {
      tool: `${action.serverName}.${action.toolName}`,
      status: action.status,
      arguments: action.arguments ?? {},
      result: action.resultPayload ?? null,
      error: action.errorPayload ?? null,
    },
    null,
    2,
  )
  return text.length > 6000 ? `${text.slice(0, 5997)}...` : text
}

function getCloseButtonLabel() {
  return te('global.close') ? t('global.close') : ''
}

function getToolActionError(action: AiChatToolActionItem) {
  if (action.status === 'pending' && !action.handle) {
    return te('aiChat.toolActionMissingHandle') ? t('aiChat.toolActionMissingHandle') : ''
  }

  const payload = asRecord(action.errorPayload)
  const value =
    typeof payload?.error === 'string' && payload.error.trim() ? payload.error : payload?.message

  if (typeof value !== 'string' || !value.trim()) return null
  const key = value.trim()
  return te(key) ? t(key) : ''
}
</script>
