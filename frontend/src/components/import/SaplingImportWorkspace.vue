<template>
  <v-container
    class="sapling-page-shell sapling-page-shell--panel sapling-page-shell--fill sapling-page-shell--uniform-inset sapling-dashboard-page sapling-dashboard-page--flow-xl sapling-import"
    fluid
  >
    <SaplingPageHero
      variant="system"
      :eyebrow="$t('navigation.import')"
      :title="$t('import.title')"
    >
      <p>{{ $t('import.subtitle') }}</p>

      <template #meta>
        <v-chip size="small" color="primary" variant="tonal" prepend-icon="mdi-table-arrow-up">
          {{ batch?.status ? importStatusLabel(batch.status) : '-' }}
        </v-chip>
        <v-chip size="small" variant="outlined" prepend-icon="mdi-table-row">
          {{ batch?.rowCount ?? 0 }}
        </v-chip>
        <v-chip size="small" variant="outlined" prepend-icon="mdi-alert-outline">
          {{ batch?.errorCount ?? 0 }}
        </v-chip>
      </template>

      <template #side>
        <div class="sapling-action-cluster">
          <v-btn
            :color="executeButtonColor"
            prepend-icon="mdi-play"
            :disabled="!canExecute"
            :loading="isExecuting || isExecutionRunning"
            @click="executeBatch"
          >
            {{ executeButtonLabel }}
          </v-btn>
          <v-btn
            v-if="hasErrorReportRows"
            color="warning"
            variant="tonal"
            prepend-icon="mdi-file-download-outline"
            :loading="isDownloadingErrorReport"
            @click="downloadErrorReport"
          >
            {{ $t('import.downloadErrorReport') }}
          </v-btn>
        </div>
      </template>
    </SaplingPageHero>

    <section class="sapling-page-workspace sapling-import__workspace">
      <SaplingSurface class="sapling-panel-shell sapling-section-panel sapling-import__panel">
        <SaplingImportSetupPanel
          v-model:selected-file="selectedFile"
          v-model:selected-open-batch="selectedOpenBatchRecord"
          v-model:selected-entity="selectedTargetEntityRecord"
          v-model:selected-source="selectedSourceRecord"
          v-model:selected-template="selectedTemplateRecord"
          v-model:template-title="templateTitle"
          v-model:external-key-columns="externalKeyColumns"
          v-model:generic-reference-entity-handle="genericReferenceEntityHandle"
          v-model:generic-reference-key-columns="genericReferenceKeyColumns"
          :entity-options="entityOptions"
          :selected-entity-handle="selectedEntityHandle"
          :selected-source-handle="selectedSourceHandle"
          :selected-entity-placeholder="selectedEntityPlaceholder"
          :selected-source-placeholder="selectedSourcePlaceholder"
          :open-batch-filter="openBatchFilter"
          :entity-filter="entityFilter"
          :source-filter="sourceFilter"
          :selected-template-placeholder="selectedTemplatePlaceholder"
          :template-filter="templateFilter"
          :header-options="headerOptions"
          :has-batch="Boolean(batch)"
          :has-generic-reference="hasGenericReference"
          :can-select-templates="canSelectTemplates"
          :can-use-templates="canUseTemplates"
          :is-analyzing="isAnalyzing"
          :is-import-job-running="isImportJobRunning"
          :is-loading-open-batches="isLoadingOpenBatches"
          @analyze-selected-file="analyzeSelectedFile"
          @normalize-external-key-columns="normalizeExternalKeyColumns"
          @normalize-generic-reference-key-columns="normalizeGenericReferenceKeyColumns"
        />

        <section
          v-if="!batch"
          class="sapling-import__empty sapling-empty-state-panel sapling-empty-state-panel--compact"
        >
          <v-icon size="40" color="primary">mdi-file-delimited-outline</v-icon>
          <h2 class="sapling-empty-state-panel__title">{{ t('import.selectFile') }}</h2>
          <p class="sapling-empty-state-panel__text">{{ t('import.fileRequired') }}</p>
        </section>

        <SaplingImportMappingEditor
          :has-batch="Boolean(batch)"
          :fields="importableFields"
          :field-mappings="fieldMappings"
          :field-defaults="fieldDefaults"
          :relation-mapping-modes="relationMappingModes"
          :relation-mapping-columns="relationMappingColumns"
          :relation-mapping-mode-options="relationMappingModeOptions"
          :unique-conflict-strategies="uniqueConflictStrategies"
          :unique-conflict-strategy-options="uniqueConflictStrategyOptions"
          :header-options="headerOptions"
          :selected-entity-handle="selectedEntityHandle"
          :permissions="currentPermissions"
          :ai-suggestion-field-details="aiSuggestionFieldDetails"
          :is-import-job-running="isImportJobRunning"
          :field-label="fieldLabel"
          :ai-suggestion-reason="aiSuggestionReason"
          :confidence-percent="confidencePercent"
          :reference-items-for-field="referenceItemsForField"
          :has-value-mapping="hasValueMapping"
          :get-source-column-option-value="getSourceColumnOptionValue"
          :get-source-column-option-title="getSourceColumnOptionTitle"
          :source-column-usage-labels="sourceColumnUsageLabels"
          :source-column-usage-summary="sourceColumnUsageSummary"
          @field-mapping-change="onFieldMappingChange"
          @open-value-mapping="openValueMapping"
          @normalize-relation-mapping-columns="normalizeRelationMappingColumns"
          @update-field-mapping="updateFieldMapping"
          @update-field-default="updateFieldDefault"
          @update-relation-mapping-mode="updateRelationMappingMode"
          @update-relation-mapping-columns="updateRelationMappingColumns"
          @update-unique-conflict-strategy="updateUniqueConflictStrategy"
        />

        <SaplingImportActionBar
          v-if="batch"
          :can-suggest-with-ai="canSuggestWithAi"
          :is-suggesting="isSuggesting"
          :has-selected-template="Boolean(selectedTemplate)"
          :can-save-template="canSaveTemplate"
          :is-saving-template="isSavingTemplate"
          :can-configure="canConfigure"
          :is-configuring="isConfiguring"
          @suggest="createAiSuggestion"
          @apply-template="applySelectedTemplate"
          @save-template="saveTemplate"
          @configure="configureBatch"
        />

        <SaplingImportJobStatus
          :is-running="isImportJobRunning"
          :status-label="currentImportStatusLabel"
          :progress-label="importProgressLabel"
          :progress-percent="importProgressPercent"
        />

        <SaplingImportAiSuggestionPanel :ai-suggestion="aiSuggestion" :field-label="fieldLabel" />
      </SaplingSurface>

      <SaplingImportPreviewPanel
        :batch="batch"
        :is-preview-limited="isPreviewLimited"
        :preview-row-limit="IMPORT_PREVIEW_ROW_LIMIT"
        :sapling-preview-items="saplingPreviewItems"
        :entity-preview-title="entityPreviewTitle"
        :selected-entity-handle="selectedEntityHandle"
        :selected-entity="selectedEntity"
        :selected-entity-permission="selectedEntityPermission"
        :selected-entity-templates="selectedEntityTemplates"
        :preview-rows="previewRows"
        :sample-headers="sampleHeaders"
        :import-status-label="importStatusLabel"
        :import-action-label="importActionLabel"
        :import-message-label="importMessageLabel"
      />
    </section>

    <SaplingImportValueMappingDialog
      v-model:visible="valueMappingDialog.visible"
      :value-mapping="currentValueMapping"
      :field="currentValueMappingField"
      :source-values="currentValueMappingSourceValues"
      :selected-entity-handle="selectedEntityHandle"
      :visible-templates="importableFields"
      :permissions="currentPermissions"
      :reference-items="currentValueMappingReferenceItems"
      :field-label="fieldLabel"
      @clear="clearCurrentValueMapping"
      @close="closeValueMapping"
      @update-fallback="updateCurrentValueMappingFallback"
      @update-mapped-value="updateCurrentValueMappingValue"
    />
  </v-container>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingPageHero from '@/components/common/SaplingPageHero.vue'
import SaplingSurface from '@/components/common/SaplingSurface.vue'
import SaplingImportActionBar from '@/components/import/SaplingImportActionBar.vue'
import SaplingImportAiSuggestionPanel from '@/components/import/SaplingImportAiSuggestionPanel.vue'
import SaplingImportJobStatus from '@/components/import/SaplingImportJobStatus.vue'
import SaplingImportMappingEditor from '@/components/import/SaplingImportMappingEditor.vue'
import SaplingImportPreviewPanel from '@/components/import/SaplingImportPreviewPanel.vue'
import SaplingImportSetupPanel from '@/components/import/SaplingImportSetupPanel.vue'
import SaplingImportValueMappingDialog from '@/components/import/SaplingImportValueMappingDialog.vue'
import { useGenericStore } from '@/stores/genericStore'
import { useCurrentPermissionStore } from '@/stores/currentPermissionStore'
import type {
  ImportBatchSummary,
  ImportRelationMappingMode,
  ImportUniqueConflictStrategyMode,
} from '@/services/api.import.service'
import type { SaplingGenericItem } from '@/entity/entity'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import { useSaplingImportBatchPolling } from '@/composables/import/useSaplingImportBatchPolling'
import { useSaplingImportJobs } from '@/composables/import/useSaplingImportJobs'
import { useSaplingImportValueMappings } from '@/composables/import/useSaplingImportValueMappings'
import {
  hasFieldDefaultValue,
  useSaplingImportMappingConfiguration,
} from '@/composables/import/useSaplingImportMappingConfiguration'
import { useSaplingImportTemplates } from '@/composables/import/useSaplingImportTemplates'
import { useSaplingImportAiSuggestions } from '@/composables/import/useSaplingImportAiSuggestions'
import { useSaplingImportBatchSession } from '@/composables/import/useSaplingImportBatchSession'
import { useSaplingImportCommands } from '@/composables/import/useSaplingImportCommands'
import { useSaplingImportConfigurationSession } from '@/composables/import/useSaplingImportConfigurationSession'
import { useSaplingImportEntityCatalog } from '@/composables/import/useSaplingImportEntityCatalog'
import {
  IMPORT_PREVIEW_ROW_LIMIT,
  useSaplingImportPresentation,
} from '@/composables/import/useSaplingImportPresentation'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'

const { t, te } = useI18n()
const genericStore = useGenericStore()
const currentPermissionStore = useCurrentPermissionStore()
const { pushMessage } = useSaplingMessageCenter()
const { trackImportBatch } = useSaplingImportJobs()
const { loadTranslations } = useTranslationLoader(
  'global',
  'navigation',
  'system',
  'import',
  'importBatch',
  'importBatchRow',
  'importSource',
  'importTemplate',
  'externalRecordLink',
)

const selectedFile = ref<File | File[] | null>(null)
const selectedEntityHandle = ref<string | null>(null)
const selectedSourceHandle = ref<string | null>(null)
const selectedOpenBatchRecord = ref<SaplingGenericItem | null>(null)
const selectedTargetEntityRecord = ref<SaplingGenericItem | null>(null)
const selectedSourceRecord = ref<SaplingGenericItem | null>(null)
const externalKeyColumns = ref<string[]>([])
const genericReferenceEntityHandle = ref<string | null>(null)
const genericReferenceKeyColumns = ref<string[]>([])
const batch = ref<ImportBatchSummary | null>(null)
const fieldMappings = reactive<Record<string, string | null>>({})
const fieldDefaults = reactive<Record<string, unknown>>({})
const relationMappingModes = reactive<Record<string, ImportRelationMappingMode | null>>({})
const relationMappingColumns = reactive<Record<string, string[]>>({})
const uniqueConflictStrategies = reactive<Record<string, ImportUniqueConflictStrategyMode>>({})
const {
  selectedEntityTemplates,
  selectedEntity,
  selectedEntityPermission,
  currentPermissions,
  importableFields,
  entityOptions,
  selectedEntityPlaceholder,
  selectedSourcePlaceholder,
  openBatchFilter,
  entityFilter,
  sourceFilter,
  loadEntities,
} = useSaplingImportEntityCatalog({
  selectedEntityHandle,
  selectedSourceHandle,
  genericStore,
  currentPermissionStore,
  entityLabel: (entityHandle) => entityLabel(entityHandle),
})
const {
  sampleHeaders,
  previewRows,
  errorReportRows,
  saplingPreviewItems,
  entityPreviewTitle,
  hasGenericReference,
  hasErrorReportRows,
  isPreviewLimited,
  isImportJobRunning,
  isExecutionRunning,
  importProgressPercent,
  currentImportStatusLabel,
  importProgressLabel,
  executeButtonLabel,
  executeButtonColor,
  canExecute,
  fieldLabel,
  entityLabel,
  importStatusLabel,
  importActionLabel,
  importMessageLabel,
} = useSaplingImportPresentation({
  batch,
  selectedEntityHandle,
  selectedEntityTemplates,
  getIsExecuting: () => isExecuting.value,
  translate: (key, params) => (params ? t(key, params) : t(key)),
  hasTranslation: (key) => te(key),
})
const headerOptions = computed(() => batch.value?.headers ?? [])

const {
  valueMappings,
  valueMappingDialog,
  currentValueMapping,
  currentValueMappingField,
  currentValueMappingSourceValues,
  currentValueMappingReferenceItems,
  onFieldMappingChange,
  openValueMapping,
  referenceItemsForField,
  closeValueMapping,
  clearCurrentValueMapping,
  updateCurrentValueMappingFallback,
  updateCurrentValueMappingValue,
  hasValueMapping,
  getSourceColumnOptionValue,
  getSourceColumnOptionTitle,
  sourceColumnUsageLabels,
  sourceColumnUsageSummary,
  resetValueMappings,
} = useSaplingImportValueMappings({
  batch,
  importableFields,
  fieldMappings,
  clearAiSuggestionFieldDetail: (targetField) => clearAiSuggestionFieldDetail(targetField),
  fieldLabel,
  usedLabel: () => t('system.used'),
})

const {
  initializeMappingConfiguration,
  clearMappingConfiguration,
  applyValueMappings,
  applyMappingConfiguration,
  buildFieldMappings,
  buildFieldDefaults,
  buildRelationMappings,
  buildValueMappings,
  buildUniqueConflictStrategies,
  filterExistingColumns,
  normalizeExternalColumns,
  normalizeRelationMappingColumns,
  updateFieldMapping,
  updateFieldDefault,
  updateRelationMappingMode,
  updateRelationMappingColumns,
  updateUniqueConflictStrategy,
} = useSaplingImportMappingConfiguration({
  importableFields,
  headerOptions,
  selectedSourceHandle,
  fieldMappings,
  fieldDefaults,
  relationMappingModes,
  relationMappingColumns,
  uniqueConflictStrategies,
  valueMappings,
})

const {
  isSuggesting,
  aiSuggestion,
  aiSuggestionFieldDetails,
  canSuggestWithAi,
  createAiSuggestion,
  clearAiSuggestionFieldDetail,
  resetAiSuggestion,
  aiSuggestionReason,
  confidencePercent,
} = useSaplingImportAiSuggestions({
  batch,
  selectedEntityHandle,
  selectedSourceHandle,
  headerOptions,
  fieldMappings,
  externalKeyColumns,
  filterExistingColumns,
  setValueMapping: (targetField, values, fallback) => {
    valueMappings[targetField] = { targetField, values, fallback }
  },
  notifyCreated: (currentBatch) =>
    pushMessage('success', t('import.aiSuggestionCreated'), currentBatch.filename, 'import'),
  defaultReason: () => t('import.aiSuggestion'),
})
const {
  initializeMappings,
  clearMappingState,
  applyTemplate,
  normalizeExternalKeyColumns,
  normalizeGenericReferenceKeyColumns,
  buildTemplatePayload,
} = useSaplingImportConfigurationSession({
  selectedEntityHandle,
  selectedSourceHandle,
  externalKeyColumns,
  genericReferenceEntityHandle,
  genericReferenceKeyColumns,
  hasGenericReference,
  initializeMappingConfiguration,
  clearMappingConfiguration,
  applyMappingConfiguration,
  filterExistingColumns,
  normalizeExternalColumns,
  buildFieldMappings,
  buildFieldDefaults,
  buildRelationMappings,
  buildValueMappings,
  buildUniqueConflictStrategies,
  resetAiSuggestion,
  resetValueMappings,
  getSelectedTemplateHandle: () => getSelectedTemplateHandleNumber(),
  getTemplateTitle: () => templateTitle.value,
})
const {
  isAnalyzing,
  isConfiguring,
  isExecuting,
  isDownloadingErrorReport,
  analyzeSelectedFile,
  configureBatch,
  executeBatch,
  downloadErrorReport,
} = useSaplingImportCommands({
  batch,
  selectedOpenBatchRecord,
  selectedEntityHandle,
  errorReportRows,
  clearSelectedTemplate: () => clearSelectedTemplate(),
  initializeMappings,
  buildTemplatePayload,
  applyValueMappings,
  trackImportBatch,
  startBatchPolling: (handle) => startBatchPolling(handle),
  importStatusLabel,
  importActionLabel,
  importMessageLabel,
  notifyAnalysisCompleted: (filename) =>
    pushMessage('success', t('import.analysisCompleted'), filename, 'import'),
  notifyValidationStarted: (configuredBatch) =>
    pushMessage('info', t('import.validationStarted'), configuredBatch.filename, 'import'),
  notifyExecutionStarted: (executedBatch) =>
    pushMessage('info', t('import.executionStarted'), executedBatch.filename, 'import'),
})
const relationMappingModeOptions = computed<
  Array<{ title: string; value: ImportRelationMappingMode }>
>(() => [
  { title: t('import.relationMappingMode.handle'), value: 'handle' },
  { title: t('import.relationMappingMode.value'), value: 'value' },
  { title: t('import.relationMappingMode.externalKey'), value: 'externalKey' },
])
const uniqueConflictStrategyOptions = computed<
  Array<{ title: string; value: ImportUniqueConflictStrategyMode }>
>(() => [
  { title: t('import.uniqueConflictStrategy.error'), value: 'error' },
  {
    title: t('import.uniqueConflictStrategy.appendExternalKey'),
    value: 'appendExternalKey',
  },
])
const canConfigure = computed(
  () =>
    Boolean(batch.value?.handle && selectedEntityHandle.value) &&
    !isConfiguring.value &&
    !isImportJobRunning.value,
)
const hasTemplateContent = computed(
  () =>
    Object.values(fieldMappings).some(Boolean) ||
    Object.values(fieldDefaults).some(hasFieldDefaultValue) ||
    Object.values(relationMappingModes).some(Boolean) ||
    Object.values(uniqueConflictStrategies).some((strategy) => strategy !== 'error'),
)

const {
  selectedTemplateHandle,
  selectedTemplateRecord,
  selectedTemplateSummary,
  selectedTemplate,
  selectedTemplatePlaceholder,
  templateTitle,
  templateFilter,
  canSelectTemplates,
  canUseTemplates,
  canSaveTemplate,
  isSavingTemplate,
  isApplyingTemplate,
  clearSelectedTemplate,
  selectTemplateRecord,
  loadSelectedTemplateSummary,
  applySelectedTemplate,
  saveTemplate,
  getSelectedTemplateHandleNumber,
} = useSaplingImportTemplates({
  batch,
  selectedEntityHandle,
  selectedSourceHandle,
  selectedTargetEntityRecord,
  selectedSourceRecord,
  hasTemplateContent,
  buildTemplatePayload,
  onScopeChanged: async (entityChanged) => {
    if (entityChanged && selectedEntityHandle.value) {
      await Promise.all([
        genericStore.loadGeneric(selectedEntityHandle.value, 'global', 'import'),
        loadTranslations(),
      ])
      initializeMappings()
    }
  },
  applyTemplateConfiguration: applyTemplate,
  applySavedMapping: (template) => applyValueMappings(template.mapping),
  notifyTemplateLoaded: (template) =>
    pushMessage('success', t('import.templateLoaded'), template.title, 'import'),
  notifyTemplateSaved: (template) =>
    pushMessage('success', t('import.templateSaved'), template.title, 'import'),
})

const { isLoadingOpenBatches, clearMissingBatch } = useSaplingImportBatchSession({
  batch,
  selectedFile,
  selectedOpenBatchRecord,
  selectedTargetEntityRecord,
  selectedSourceRecord,
  selectedEntityHandle,
  selectedSourceHandle,
  externalKeyColumns,
  genericReferenceEntityHandle,
  genericReferenceKeyColumns,
  selectedTemplateHandle,
  selectedTemplateRecord,
  selectedTemplateSummary,
  selectedTemplate,
  templateTitle,
  isApplyingTemplate,
  clearSelectedTemplate,
  selectTemplateRecord,
  loadSelectedTemplateSummary,
  loadEntityMetadata: (entityHandle) => genericStore.loadGeneric(entityHandle, 'global', 'import'),
  loadTranslations,
  initializeMappings,
  clearMappingState,
  applyMappingConfiguration,
  filterExistingColumns,
  startBatchPolling: (handle) => startBatchPolling(handle),
  trackImportBatch,
  notifyBatchLoaded: (loadedBatch) =>
    pushMessage('success', t('import.openBatchLoaded'), loadedBatch.filename, 'import'),
})

const { startBatchPolling, stopBatchPolling } = useSaplingImportBatchPolling({
  onBatch: (refreshedBatch) => {
    batch.value = refreshedBatch
  },
  onNotFound: (handle) => {
    clearMissingBatch(handle)
  },
})

onMounted(async () => {
  await Promise.all([
    loadTranslations(),
    loadEntities(),
    currentPermissionStore.fetchCurrentPermission(),
  ])
})

onUnmounted(() => {
  stopBatchPolling()
})
</script>
