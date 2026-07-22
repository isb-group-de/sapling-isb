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
      ref="previewSurfaceRef"
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
        <div class="sapling-form-config-preview__drag-hint">
          <v-icon icon="mdi-drag-variant" size="small" />
          <span>
            {{
              formConfigText(
                'dragPreviewHint',
                'Felder und Gruppen direkt in der Vorschau verschieben',
              )
            }}
          </span>
        </div>

        <template v-for="group in displayedPreviewGroups" :key="group.id">
          <div
            v-if="shouldShowGroupDropBefore(group.key)"
            class="sapling-form-config-preview__group-drop-preview"
            role="status"
            @dragover.prevent="onDropPreviewDragOver"
            @drop.prevent="dropOnGroup(group.key)"
          >
            <v-icon icon="mdi-tray-arrow-down" size="small" />
            <span>{{ formConfigText('dropGroupHere', 'Gruppe hier ablegen') }}</span>
          </div>

          <section
            class="sapling-panel-shell sapling-config-preview__group sapling-form-config-preview__group"
            :class="{
              'sapling-form-config-preview__group--drag-source': draggedGroupKey === group.key,
              'sapling-form-config-preview__group--layout-hidden':
                dragLayoutActive && draggedGroupKey === group.key,
              'sapling-form-config-preview__group--empty-drag-target':
                draggedFieldName && group.templates.length === 0,
              'sapling-form-config-preview__group--field-target':
                draggedFieldName && fieldDropTarget?.groupKey === normalizeGroupKey(group.key),
            }"
            :data-preview-group="normalizeGroupKey(group.key)"
            @dragover.prevent="onGroupDragOver($event, group.key)"
            @drop.prevent="dropOnGroup(group.key)"
          >
            <header class="sapling-form-config-preview__group-header">
              <div class="sapling-form-config-preview__group-title">
                <v-btn
                  v-if="group.key"
                  class="sapling-form-config-preview__drag-handle"
                  icon="mdi-drag-vertical"
                  variant="text"
                  size="x-small"
                  draggable="true"
                  :title="formConfigText('dragGroup', 'Gruppe verschieben')"
                  :aria-label="formConfigText('dragGroup', 'Gruppe verschieben')"
                  @dragstart.stop="startGroupDrag($event, group.key)"
                  @dragend="endDrag"
                />
                <v-icon v-else icon="mdi-folder-outline" size="small" />
                <div>
                  <h3>{{ group.label }}</h3>
                  <span v-if="group.key">{{ group.key }}</span>
                </div>
              </div>
              <v-chip size="x-small" variant="tonal">
                {{ group.templates.length }}
              </v-chip>
            </header>
            <div
              class="sapling-config-preview__grid sapling-form-config-preview__grid"
              :class="{
                'sapling-form-config-preview__grid--empty-drag-target':
                  draggedFieldName && group.templates.length === 0,
              }"
              @dragover.prevent.stop="onFieldGridDragOver($event, group.key)"
              @drop.prevent.stop="dropField"
            >
              <template v-for="(field, fieldIndex) in group.templates" :key="field.name">
                <div
                  v-if="shouldShowFieldDropBefore(group.key, field.name)"
                  class="sapling-form-config-preview__field-drop-preview"
                  :class="`sapling-config-preview__field--w${draggedFieldWidth}`"
                  role="status"
                  @dragover.prevent.stop="onDropPreviewDragOver"
                  @drop.prevent.stop="dropField"
                >
                  <v-icon icon="mdi-tray-arrow-down" size="small" />
                  <span>{{ formConfigText('dropFieldHere', 'Feld hier ablegen') }}</span>
                </div>

                <SaplingSurface
                  class="sapling-panel-shell sapling-config-preview__field sapling-form-config-preview__field"
                  :class="[
                    `sapling-config-preview__field--w${getPreviewWidth(field)}`,
                    {
                      'sapling-form-config-preview__field--drag-source':
                        draggedFieldName === field.name,
                      'sapling-form-config-preview__field--layout-hidden':
                        dragLayoutActive && draggedFieldName === field.name,
                    },
                  ]"
                  :data-preview-field="field.name"
                  draggable="true"
                  :title="formConfigText('dragField', 'Feld verschieben')"
                  @dragstart.stop="startFieldDrag($event, field)"
                  @dragend="endDrag"
                  @dragover.prevent.stop="onFieldDragOver($event, group, fieldIndex)"
                  @drop.prevent.stop="dropField"
                >
                  <strong>
                    <v-icon icon="mdi-drag" size="x-small" />
                    {{ getPreviewFieldLabel(field) }}
                    <span>({{ getPreviewTypeLabel(field) }})</span>
                  </strong>
                  <small>{{ field.name }} · {{ getPreviewMeta(field) }}</small>
                </SaplingSurface>
              </template>

              <div
                v-if="
                  draggedFieldName &&
                  group.templates.length === 0 &&
                  !shouldShowFieldDropAtEnd(group.key)
                "
                class="sapling-form-config-preview__empty-field-target"
              >
                <v-icon icon="mdi-tray-arrow-down" size="small" />
                <span>{{ formConfigText('dropFieldHere', 'Feld hier ablegen') }}</span>
              </div>

              <div
                v-if="shouldShowFieldDropAtEnd(group.key)"
                class="sapling-form-config-preview__field-drop-preview"
                :class="`sapling-config-preview__field--w${draggedFieldWidth}`"
                role="status"
                @dragover.prevent.stop="onDropPreviewDragOver"
                @drop.prevent.stop="dropField"
              >
                <v-icon icon="mdi-tray-arrow-down" size="small" />
                <span>{{ formConfigText('dropFieldHere', 'Feld hier ablegen') }}</span>
              </div>
            </div>
          </section>
        </template>

        <div
          v-if="shouldShowGroupDropAtEnd"
          class="sapling-form-config-preview__group-drop-preview"
          role="status"
          @dragover.prevent="onDropPreviewDragOver"
          @drop.prevent="dropOnGroup(null)"
        >
          <v-icon icon="mdi-tray-arrow-down" size="small" />
          <span>{{ formConfigText('dropGroupHere', 'Gruppe hier ablegen') }}</span>
        </div>
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
import type { GroupDraft } from '@/components/system/form-config/formConfigAdmin.types'
import SaplingSurface from '@/components/common/SaplingSurface.vue'
import {
  getDialogTemplateWidth,
  groupDialogTemplates,
  sortDialogTemplates,
} from '@/utils/saplingDialogLayoutUtil'
import { getMobileTableHeaders, sortTableHeaders } from '@/utils/saplingTableUtil'
import { useSaplingFormConfigPreviewDrag } from '@/composables/system/useSaplingFormConfigPreviewDrag'

type PreviewMode = 'form' | 'table' | 'mobile'

const PREVIEW_UNSUPPORTED_RELATION_KINDS = ['1:m', 'm:n', 'n:m']
const PREVIEW_UNSUPPORTED_FORM_RELATION_KINDS = [...PREVIEW_UNSUPPORTED_RELATION_KINDS, '1:1']

const props = defineProps<{
  selectedEntityHandle: string
  draftTemplates: EntityTemplate[]
  groups: GroupDraft[]
  previewMode: PreviewMode
  reloadDisabled: boolean
}>()

const emit = defineEmits<{
  (event: 'update:previewMode', value: PreviewMode): void
  (event: 'reload'): void
  (
    event: 'moveField',
    fieldName: string,
    targetGroupKey: string,
    beforeFieldName: string | null,
  ): void
  (event: 'reorderGroup', sourceKey: string, targetKey: string, placement: 'before' | 'after'): void
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

const {
  draggedFieldName,
  draggedFieldWidth,
  draggedGroupKey,
  dragLayoutActive,
  dropField,
  dropOnGroup,
  endDrag,
  fieldDropTarget,
  normalizeGroupKey,
  onFieldDragOver,
  onFieldGridDragOver,
  onGroupDragOver,
  onDropPreviewDragOver,
  previewSurfaceRef,
  shouldShowFieldDropAtEnd,
  shouldShowFieldDropBefore,
  shouldShowGroupDropAtEnd,
  shouldShowGroupDropBefore,
  startFieldDrag,
  startGroupDrag,
} = useSaplingFormConfigPreviewDrag({
  draftTemplates: () => props.draftTemplates,
  previewGroups,
  getPreviewWidth,
  moveField: (fieldName, targetGroupKey, beforeFieldName) =>
    emit('moveField', fieldName, targetGroupKey, beforeFieldName),
  reorderGroup: (sourceKey, targetKey, placement) =>
    emit('reorderGroup', sourceKey, targetKey, placement),
})

const displayedPreviewGroups = computed(() => {
  if (!draggedFieldName.value) return previewGroups.value

  const groupsByKey = new Map(
    previewGroups.value.map((group) => [normalizeGroupKey(group.key), group]),
  )
  props.groups
    .filter((group) => group.visible && group.key && !groupsByKey.has(group.key))
    .forEach((group) => {
      groupsByKey.set(group.key, {
        id: group.key,
        key: group.key,
        label: group.label.trim() || translateGroup(group.key),
        templates: [],
      })
    })

  const groupOrder = new Map(props.groups.map((group) => [group.key, group.order]))
  return [...groupsByKey.values()].sort((left, right) => {
    const leftOrder = groupOrder.get(normalizeGroupKey(left.key)) ?? getPreviewGroupOrder(left)
    const rightOrder = groupOrder.get(normalizeGroupKey(right.key)) ?? getPreviewGroupOrder(right)
    return leftOrder - rightOrder
  })
})

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

function getPreviewGroupOrder(group: (typeof previewGroups.value)[number]): number {
  return group.templates[0]?.formGroupOrder ?? Number.MAX_SAFE_INTEGER
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
