<template>
  <SaplingSurface
    as="aside"
    class="sapling-panel-shell sapling-section-panel sapling-config-panel sapling-config-panel--blurred sapling-form-config__panel sapling-form-config__panel--preview"
  >
    <div
      class="sapling-row-between-md sapling-config-preview-header sapling-form-config__preview-header"
    >
      <div>
        <p class="sapling-eyebrow sapling-config-eyebrow sapling-form-config__eyebrow">
          {{ t('formConfig.livePreview') }}
        </p>
        <h2 class="sapling-section-title">{{ previewTitle }}</h2>
      </div>
      <div class="sapling-form-config-preview__header-actions">
        <v-chip size="small" variant="tonal" color="primary">
          {{ activePreviewCount }}
        </v-chip>
        <v-btn
          icon="mdi-refresh"
          variant="text"
          :title="t('formConfig.reload')"
          :disabled="reloadDisabled"
          @click="emit('reload')"
        />
      </div>
    </div>

    <SaplingSurface
      class="sapling-panel-shell sapling-stack-lg sapling-config-preview sapling-form-config-preview"
      aria-live="polite"
    >
      <nav
        class="sapling-form-config-preview__mode-toggle"
        role="tablist"
        :aria-label="t('formConfig.preview')"
      >
        <v-btn
          v-for="option in previewModeOptions"
          :key="option.value"
          :data-preview-mode="option.value"
          :prepend-icon="option.icon"
          :class="{
            'sapling-form-config-preview__mode-button--active': previewModeModel === option.value,
          }"
          :aria-selected="previewModeModel === option.value"
          role="tab"
          density="compact"
          variant="text"
          @click="selectPreviewMode(option.value)"
        >
          {{ option.title }}
        </v-btn>
      </nav>

      <div v-if="previewModeModel === 'form'" class="sapling-form-config-preview__stage">
        <section
          v-for="group in previewGroups"
          :key="group.id"
          class="sapling-panel-shell sapling-config-preview__group sapling-form-config-preview__group"
        >
          <header class="sapling-form-config-preview__group-header">
            <div class="sapling-form-config-preview__group-title">
              <v-icon icon="mdi-folder-outline" size="small" />
              <div>
                <h3>{{ group.label }}</h3>
                <span v-if="group.key">{{ group.key }}</span>
              </div>
            </div>
            <v-chip size="x-small" variant="tonal">
              {{ group.templates.length }}
            </v-chip>
          </header>
          <div class="sapling-config-preview__grid sapling-form-config-preview__grid">
            <SaplingSurface
              v-for="field in group.templates"
              :key="field.name"
              class="sapling-panel-shell sapling-config-preview__field sapling-form-config-preview__field"
              :class="`sapling-config-preview__field--w${getPreviewWidth(field)}`"
            >
              <strong>
                {{ getPreviewFieldLabel(field) }}
                <span>({{ getPreviewTypeLabel(field) }})</span>
              </strong>
              <small>{{ field.name }} · {{ getPreviewMeta(field) }}</small>
            </SaplingSurface>
          </div>
        </section>
        <div v-if="previewGroups.length === 0" class="sapling-form-config-preview__empty">
          <v-icon icon="mdi-eye-off-outline" />
          <span>{{ t('formConfig.noPreviewFields') }}</span>
        </div>
      </div>

      <div v-else-if="previewModeModel === 'table'" class="sapling-form-config-preview__stage">
        <div v-if="previewTableTemplates.length > 0" class="sapling-form-config-preview-table">
          <div class="sapling-form-config-preview-table__scroll" :style="previewTableScrollStyle">
            <table>
              <thead>
                <tr>
                  <th v-for="field in previewTableTemplates" :key="field.name">
                    <strong>{{ getPreviewFieldLabel(field) }}</strong>
                    <small>{{ getPreviewTypeLabel(field) }}</small>
                  </th>
                </tr>
              </thead>
            </table>
          </div>
        </div>
        <div v-else class="sapling-form-config-preview__empty">
          <v-icon icon="mdi-table-off" />
          <span>{{ t('formConfig.noPreviewFields') }}</span>
        </div>
      </div>

      <div v-else class="sapling-form-config-preview__stage">
        <div v-if="previewMobileTemplates.length > 0" class="sapling-form-config-preview-mobile">
          <div class="sapling-form-config-preview-phone glass-panel">
            <div class="sapling-form-config-preview-phone__status">
              <span>{{ previewTitle }}</span>
              <v-icon icon="mdi-dots-horizontal" size="small" />
            </div>
            <div class="sapling-form-config-preview-phone__card">
              <section
                v-for="(field, index) in previewMobileTemplates"
                :key="field.name"
                class="sapling-form-config-preview-phone__field"
                :class="{
                  'sapling-form-config-preview-phone__field--primary': index === 0,
                }"
              >
                <strong>{{ getPreviewFieldLabel(field) }}</strong>
                <span>{{ getPreviewTypeLabel(field) }}</span>
                <small>{{ field.name }}</small>
              </section>
            </div>
          </div>
        </div>
        <div v-else class="sapling-form-config-preview__empty">
          <v-icon icon="mdi-cellphone-off" />
          <span>{{ t('formConfig.noPreviewFields') }}</span>
        </div>
      </div>
    </SaplingSurface>
  </SaplingSurface>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EntityTemplate, EntityTemplateFormWidth } from '@/entity/structure'
import SaplingSurface from '@/components/common/SaplingSurface.vue'
import {
  getDialogTemplateWidth,
  groupDialogTemplates,
  sortDialogTemplates,
} from '@/utils/saplingDialogLayoutUtil'
import { getMobileTableHeaders, sortTableHeaders } from '@/utils/saplingTableUtil'

type PreviewMode = 'form' | 'table' | 'mobile'

const PREVIEW_UNSUPPORTED_RELATION_KINDS = ['1:m', 'm:n', 'n:m']
const PREVIEW_UNSUPPORTED_FORM_RELATION_KINDS = [...PREVIEW_UNSUPPORTED_RELATION_KINDS, '1:1']

const props = defineProps<{
  selectedEntityHandle: string
  draftTemplates: EntityTemplate[]
  previewMode: PreviewMode
  reloadDisabled: boolean
}>()

const emit = defineEmits<{
  (event: 'update:previewMode', value: PreviewMode): void
  (event: 'reload'): void
}>()

const { t, te } = useI18n()

const previewModeModel = computed({
  get: () => props.previewMode,
  set: (value: PreviewMode) => emit('update:previewMode', value),
})

const previewModeOptions = computed<Array<{ title: string; value: PreviewMode; icon: string }>>(
  () => [
    { title: t('formConfig.previewForm'), value: 'form', icon: 'mdi-form-select' },
    { title: t('formConfig.previewTable'), value: 'table', icon: 'mdi-table' },
    { title: t('formConfig.previewMobileTable'), value: 'mobile', icon: 'mdi-cellphone' },
  ],
)

const previewTemplates = computed(() =>
  sortDialogTemplates(
    props.draftTemplates
      .filter((template) => template.formVisible === true)
      .filter((template) => !template.isAutoIncrement)
      .filter((template) => !PREVIEW_UNSUPPORTED_FORM_RELATION_KINDS.includes(template.kind ?? '')),
  ),
)

const previewGroups = computed(() =>
  groupDialogTemplates(previewTemplates.value, (groupKey) => translateGroup(groupKey)).map(
    (group) => ({
      ...group,
      label: group.label || formConfigText('ungrouped', 'Ohne Gruppe'),
    }),
  ),
)

const previewTableTemplates = computed(() =>
  sortTableHeaders(
    props.draftTemplates
      .filter(isPreviewSupportedTableTemplate)
      .filter((template) => template.tableVisible === true),
  ),
)

const previewTableScrollStyle = computed(() => ({
  '--sapling-form-config-preview-table-columns': String(previewTableTemplates.value.length),
}))

const previewMobileTemplates = computed(() =>
  getMobileTableHeaders(
    props.draftTemplates.filter(isPreviewSupportedTableTemplate).map((template) => ({
      ...template,
      key: template.name,
      title: getPreviewFieldLabel(template),
    })),
  ),
)

const activePreviewCount = computed(() => {
  if (previewModeModel.value === 'table') {
    return previewTableTemplates.value.length
  }

  if (previewModeModel.value === 'mobile') {
    return previewMobileTemplates.value.length
  }

  return previewTemplates.value.length
})

const previewTitle = computed(() =>
  props.selectedEntityHandle
    ? translateEntity(props.selectedEntityHandle)
    : t('formConfig.preview'),
)

function translateEntity(entityHandle: string): string {
  const key = `navigation.${entityHandle}`
  return te(key) ? t(key) : ''
}

function translateGroup(groupKey: string): string {
  if (te(groupKey)) return t(groupKey)

  const unscopedKey = groupKey.startsWith(`${props.selectedEntityHandle}.`)
    ? groupKey.slice(props.selectedEntityHandle.length + 1)
    : groupKey
  return formatMetadataName(unscopedKey.replace(/^group/, ''))
}

function isPreviewSupportedTableTemplate(template: EntityTemplate): boolean {
  return (
    !template.options?.includes('isSecurity') &&
    !PREVIEW_UNSUPPORTED_RELATION_KINDS.includes(template.kind ?? '')
  )
}

function getPreviewWidth(template: EntityTemplate): EntityTemplateFormWidth {
  return getDialogTemplateWidth(template)
}

function getPreviewFieldLabel(template: EntityTemplate): string {
  const configuredLabel = template.formConfig?.label?.trim()
  if (configuredLabel) {
    return configuredLabel
  }

  const key = `${props.selectedEntityHandle}.${template.name}`
  return te(key) ? t(key) : ''
}

function getPreviewRenderer(template: EntityTemplate): string {
  return template.formConfig?.renderer && template.formConfig.renderer !== 'auto'
    ? template.formConfig.renderer
    : inferRenderer(template)
}

function getPreviewTypeLabel(template: EntityTemplate): string {
  const renderer = getPreviewRenderer(template)
  if (renderer === 'select' && template.referenceName) {
    return `${formatMetadataName(renderer)} · ${translateEntity(template.referenceName)}`
  }

  return formatMetadataName(renderer)
}

function inferRenderer(template: EntityTemplate): string {
  if (template.isReference || template.referenceName) return 'select'
  if (template.options?.includes('isPhone')) return 'phone'
  if (template.options?.includes('isMail')) return 'mail'
  if (template.options?.includes('isLink')) return 'link'
  if (template.options?.includes('isMoney')) return 'money'
  if (template.options?.includes('isPercent')) return 'percent'
  if (template.options?.includes('isMarkdown')) return 'markdown'
  if (template.type === 'boolean') return 'boolean'
  if (['number', 'integer', 'float', 'double', 'decimal'].includes(template.type.toLowerCase())) {
    return 'number'
  }
  if (template.type === 'datetime') return 'dateTime'
  if (template.type === 'DateType') return 'date'
  if (template.type === 'JsonType') return 'json'
  return (template.length ?? 0) > 128 ? 'longText' : 'shortText'
}

function getPreviewMeta(template: EntityTemplate): string {
  const parts = []
  if (template.isRequired) parts.push(t('formConfig.required'))
  if (template.formConfig?.readonly) parts.push(t('formConfig.readonly'))
  return parts.join(' - ') || t('formConfig.optional')
}

function selectPreviewMode(mode: PreviewMode): void {
  previewModeModel.value = mode
}

function formConfigText(key: string, fallback: string): string {
  const translationKey = `formConfig.${key}`
  return te(translationKey) ? t(translationKey) : fallback
}

function formatMetadataName(value: string): string {
  const formatted = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()

  return formatted ? formatted.charAt(0).toUpperCase() + formatted.slice(1) : value
}
</script>
