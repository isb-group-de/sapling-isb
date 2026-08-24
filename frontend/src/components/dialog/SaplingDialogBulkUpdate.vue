<template>
  <SaplingDialog
    :model-value="modelValue"
    size="md"
    :height="SAPLING_DIALOG_HEIGHT.xl"
    persistent
    @update:model-value="handleDialogUpdate"
  >
    <SaplingDialogCard
      class="sapling-dialog-card--fill"
      :tilt="false"
      :close="close"
      :close-disabled="saving"
    >
      <SaplingDialogShell
        fill-shell
        body-class="sapling-dialog-fill-body sapling-bulk-update__body"
      >
        <template #hero>
          <SaplingDialogHero
            :eyebrow="$t('global.selectionActions')"
            :title="$t('global.bulkUpdateTitle')"
            :stats="heroStats"
            :stats-columns="2"
            stats-layout="compact"
          />
        </template>

        <template #body>
          <div class="sapling-bulk-update">
            <div class="sapling-bulk-update__picker">
              <SaplingAutocomplete
                v-model="selectedFieldName"
                :items="fieldOptions"
                item-title="title"
                item-value="value"
                :label="$t('global.addField')"
                prepend-inner-icon="mdi-form-select"
                density="compact"
                clearable
                autocomplete="off"
                hide-details
                @update:model-value="addSelectedField"
              />
            </div>

            <div class="sapling-bulk-update__scroll sapling-scrollable">
              <v-alert
                v-if="changes.length === 0"
                type="info"
                variant="tonal"
                density="compact"
                :text="$t('global.bulkUpdateEmptyHint')"
              />

              <div v-if="changes.length > 0" class="sapling-bulk-update__fields">
                <section
                  v-for="change in changes"
                  :key="change.fieldName"
                  class="glass-panel sapling-section-panel sapling-bulk-update__field"
                >
                  <div class="sapling-bulk-update__field-header">
                    <div>
                      <strong>{{ fieldLabel(templateFor(change.fieldName)) }}</strong>
                    </div>

                    <div class="sapling-bulk-update__field-actions">
                      <v-btn-toggle
                        v-model="change.operation"
                        class="sapling-segmented-toggle sapling-segmented-toggle--small"
                        color="primary"
                        density="compact"
                        divided
                        mandatory
                      >
                        <v-btn value="set" size="small" class="glass-panel">
                          {{ $t('global.setValue') }}
                        </v-btn>
                        <v-btn
                          value="clear"
                          size="small"
                          class="glass-panel"
                          :disabled="!canClear(templateFor(change.fieldName))"
                        >
                          {{ $t('global.clearValue') }}
                        </v-btn>
                      </v-btn-toggle>
                      <v-btn
                        icon="mdi-close"
                        variant="text"
                        size="small"
                        :aria-label="$t('global.removeField')"
                        :title="$t('global.removeField')"
                        @click="removeField(change.fieldName)"
                      />
                    </div>
                  </div>

                  <v-alert
                    v-if="change.operation === 'set' && dependencyBlocked(change.fieldName)"
                    type="warning"
                    variant="tonal"
                    density="compact"
                    :text="dependencyHint(change.fieldName)"
                  />

                  <SaplingTemplateValueField
                    v-if="change.operation === 'set'"
                    :model-value="change.value"
                    :template="templateFor(change.fieldName)"
                    :entity-handle="entityHandle"
                    :visible-templates="eligibleTemplates"
                    :permissions="permissions"
                    :reference-parent-filter="referenceParentFilter(change.fieldName)"
                    :reference-disabled="dependencyBlocked(change.fieldName)"
                    :rules="requiredRules"
                    show-label
                    @update:model-value="change.value = $event"
                    @update:display-value="change.displayValue = $event"
                  />
                </section>
              </div>

              <div v-if="changes.length > 0" class="sapling-bulk-update__summary">
                <div class="sapling-bulk-update__summary-title">
                  {{ $t('global.bulkUpdateSummary') }}
                </div>
                <div class="sapling-chip-row">
                  <v-chip
                    v-for="change in changes"
                    :key="`summary-${change.fieldName}`"
                    color="primary"
                    variant="tonal"
                    size="small"
                  >
                    {{ summaryLabel(change) }}
                  </v-chip>
                </div>
              </div>
            </div>
          </div>
        </template>

        <template #actions>
          <SaplingActionBulkUpdate
            :cancel="close"
            :apply="apply"
            :apply-disabled="!canApply"
            :busy="saving"
          />
        </template>
      </SaplingDialogShell>
    </SaplingDialogCard>
  </SaplingDialog>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AccumulatedPermission, EntityTemplate } from '@/entity/structure'
import SaplingAutocomplete from '@/components/common/SaplingAutocomplete.vue'
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import SaplingActionBulkUpdate from '@/components/actions/SaplingActionBulkUpdate.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingDialogShell from '@/components/common/SaplingDialogShell.vue'
import SaplingDialogHero from '@/components/common/SaplingDialogHero.vue'
import SaplingTemplateValueField from '@/components/dialog/SaplingTemplateValueField.vue'
import { SAPLING_DIALOG_HEIGHT } from '@/constants/dialog.constants'
import {
  buildBulkUpdatePayload,
  buildBulkUpdateReferenceParentFilter,
  canClearBulkUpdateTemplate,
  hasBulkUpdateValue,
  isBulkUpdateDependencyBlocked,
  isBulkUpdateTemplateEligible,
  type SaplingBulkUpdateDraftChange,
} from '@/utils/saplingBulkUpdateUtil'

const props = defineProps<{
  modelValue: boolean
  entityHandle: string
  templates: EntityTemplate[]
  permissions: AccumulatedPermission[]
  selectedCount: number
  saving: boolean
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'apply', changes: Record<string, unknown>): void
}>()

const { t } = useI18n()
const selectedFieldName = ref<string | null>(null)
const changes = ref<SaplingBulkUpdateDraftChange[]>([])

const eligibleTemplates = computed(() =>
  props.templates.filter((template) => isBulkUpdateTemplateEligible(template, props.permissions)),
)
const selectedFieldNames = computed(() => new Set(changes.value.map((change) => change.fieldName)))
const fieldOptions = computed(() =>
  eligibleTemplates.value
    .filter((template) => !selectedFieldNames.value.has(template.name))
    .map((template) => ({
      title: fieldLabel(template),
      value: template.name,
    }))
    .sort((left, right) => left.title.localeCompare(right.title)),
)
const heroStats = computed(() => [
  { label: t('global.selected'), value: props.selectedCount },
  { label: t('global.fields'), value: changes.value.length },
])
const requiredRules = computed(() => [
  (value: unknown) => hasBulkUpdateValue(value) || t('global.isRequired'),
])
const canApply = computed(
  () =>
    changes.value.length > 0 &&
    changes.value.every((change) => {
      const template = templateFor(change.fieldName)
      if (change.operation === 'clear') {
        return canClear(template)
      }
      return hasBulkUpdateValue(change.value) && !dependencyBlocked(change.fieldName)
    }),
)

function fieldLabel(template: EntityTemplate): string {
  return template.formConfig?.label?.trim() || t(`${props.entityHandle}.${template.name}`)
}

function templateFor(fieldName: string): EntityTemplate {
  const template = props.templates.find((entry) => entry.name === fieldName)
  if (!template) {
    throw new Error(`Missing bulk update template: ${fieldName}`)
  }
  return template
}

function addSelectedField(fieldName: string | null): void {
  if (!fieldName || selectedFieldNames.value.has(fieldName)) {
    selectedFieldName.value = null
    return
  }

  const template = templateFor(fieldName)
  const initialValue = getInitialValue(template)
  changes.value.push({
    fieldName,
    operation: 'set',
    value: initialValue,
    displayValue: formatInitialDisplayValue(initialValue),
  })
  selectedFieldName.value = null
}

function getInitialValue(template: EntityTemplate): unknown {
  if (template.type === 'boolean' || template.formConfig?.renderer === 'boolean') {
    return false
  }
  if (
    template.customField?.type === 'multiSelect' ||
    template.formConfig?.renderer === 'multiSelect'
  ) {
    return []
  }
  return null
}

function formatInitialDisplayValue(value: unknown): string {
  if (typeof value === 'boolean') {
    return t(value ? 'global.yes' : 'global.no')
  }
  return Array.isArray(value) ? '' : String(value ?? '')
}

function removeField(fieldName: string): void {
  changes.value = changes.value.filter((change) => change.fieldName !== fieldName)
}

function canClear(template: EntityTemplate): boolean {
  return canClearBulkUpdateTemplate(template)
}

function dependencyBlocked(fieldName: string): boolean {
  return isBulkUpdateDependencyBlocked(templateFor(fieldName), changes.value)
}

function dependencyHint(fieldName: string): string {
  const parentField = templateFor(fieldName).referenceDependency?.parentField ?? ''
  const parentTemplate = props.templates.find((template) => template.name === parentField)
  return t('global.bulkUpdateDependencyHint', {
    field: parentTemplate ? fieldLabel(parentTemplate) : parentField,
  })
}

function referenceParentFilter(fieldName: string) {
  return buildBulkUpdateReferenceParentFilter(templateFor(fieldName), changes.value)
}

function summaryLabel(change: SaplingBulkUpdateDraftChange): string {
  const label = fieldLabel(templateFor(change.fieldName))
  const value =
    change.operation === 'clear'
      ? t('global.clearValue')
      : change.displayValue || String(change.value ?? '')
  return `${label}: ${value}`
}

function apply(): void {
  if (!canApply.value || props.saving) {
    return
  }
  emit('apply', buildBulkUpdatePayload(changes.value))
}

function close(): void {
  if (!props.saving) {
    emit('update:modelValue', false)
  }
}

function handleDialogUpdate(value: boolean): void {
  if (!value) {
    close()
  }
}

watch(
  () => props.modelValue,
  (visible, previous) => {
    if (visible && !previous) {
      selectedFieldName.value = null
      changes.value = []
    }
  },
)
</script>
