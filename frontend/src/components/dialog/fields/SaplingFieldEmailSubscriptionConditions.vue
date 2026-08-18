<template>
  <div class="sapling-email-conditions">
    <div
      v-for="(condition, index) in localConditions"
      :key="condition.key"
      class="sapling-email-conditions__row"
    >
      <v-select
        :menu="isConditionMenuOpen(condition.key, 'field')"
        :label="t('emailSubscriptionCondition.observedField')"
        :items="conditionFields"
        :model-value="condition.observedField"
        item-title="label"
        item-value="value"
        hide-details="auto"
        density="compact"
        clearable
        :disabled="disabled || !selectedEntityHandle"
        @update:menu="(open) => setConditionMenuOpen(condition.key, 'field', open)"
        @keydown.tab="setConditionMenuOpen(condition.key, 'field', false)"
        @update:model-value="(value) => updateObservedField(index, normalizeString(value))"
      />

      <v-select
        v-if="isValueSelectionField(condition.observedField)"
        :menu="isConditionMenuOpen(condition.key, 'oldValue')"
        :label="t('emailSubscriptionCondition.oldValue')"
        :model-value="condition.oldValue ?? null"
        :items="getValueOptions(condition.observedField)"
        item-title="label"
        item-value="value"
        hide-details="auto"
        density="compact"
        clearable
        :type="getValueInputType(condition.observedField)"
        :disabled="disabled || !condition.observedField"
        @update:menu="(open) => setConditionMenuOpen(condition.key, 'oldValue', open)"
        @keydown.tab="setConditionMenuOpen(condition.key, 'oldValue', false)"
        @update:model-value="
          (value: unknown) => updateCondition(index, { oldValue: normalizeConditionValue(value) })
        "
      />
      <v-text-field
        v-else
        :label="t('emailSubscriptionCondition.oldValue')"
        :model-value="condition.oldValue ?? null"
        hide-details="auto"
        density="compact"
        clearable
        :type="getValueInputType(condition.observedField)"
        :disabled="disabled || !condition.observedField"
        @update:model-value="
          (value: unknown) => updateCondition(index, { oldValue: normalizeConditionValue(value) })
        "
      />

      <v-select
        v-if="isValueSelectionField(condition.observedField)"
        :menu="isConditionMenuOpen(condition.key, 'newValue')"
        :label="t('emailSubscriptionCondition.newValue')"
        :model-value="condition.newValue ?? null"
        :items="getValueOptions(condition.observedField)"
        item-title="label"
        item-value="value"
        hide-details="auto"
        density="compact"
        clearable
        :type="getValueInputType(condition.observedField)"
        :disabled="disabled || !condition.observedField"
        @update:menu="(open) => setConditionMenuOpen(condition.key, 'newValue', open)"
        @keydown.tab="setConditionMenuOpen(condition.key, 'newValue', false)"
        @update:model-value="
          (value: unknown) => updateCondition(index, { newValue: normalizeConditionValue(value) })
        "
      />
      <v-text-field
        v-else
        :label="t('emailSubscriptionCondition.newValue')"
        :model-value="condition.newValue ?? null"
        hide-details="auto"
        density="compact"
        clearable
        :type="getValueInputType(condition.observedField)"
        :disabled="disabled || !condition.observedField"
        @update:model-value="
          (value: unknown) => updateCondition(index, { newValue: normalizeConditionValue(value) })
        "
      />

      <v-btn
        icon="mdi-delete-outline"
        variant="text"
        density="comfortable"
        :title="t('emailSubscriptionCondition.removeCondition')"
        :aria-label="t('emailSubscriptionCondition.removeCondition')"
        :disabled="disabled"
        @click="removeCondition(index)"
      />
    </div>

    <v-btn
      class="sapling-email-conditions__add"
      prepend-icon="mdi-plus"
      variant="tonal"
      :disabled="disabled || !selectedEntityHandle"
      @click="addCondition"
    >
      {{ t('emailSubscriptionCondition.addCondition') }}
    </v-btn>
  </div>
</template>

<script lang="ts" setup>
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EntityTemplate } from '@/entity/structure'
import type { SaplingGenericItem } from '@/entity/entity'
import ApiGenericService from '@/services/api.generic.service'
import { useGenericStore } from '@/stores/genericStore'
import { getEntityValueLabel } from '@/utils/saplingTableUtil'

type ConditionFieldOption = {
  label: string
  value: string
}

type ValueOption = {
  label: string
  value: string
}

type EmailCondition = {
  key: string
  handle?: string | number
  observedField: string
  oldValue?: string | null
  newValue?: string | null
  sortOrder?: number
}

const props = defineProps<{
  modelValue?: unknown
  disabled?: boolean
  sourceEntityReference?: unknown
}>()

const emit = defineEmits<{
  (
    event: 'update:modelValue',
    value: Array<{
      handle?: string | number
      observedField: string
      oldValue?: string | null
      newValue?: string | null
      sortOrder: number
    }>,
  ): void
}>()

const { t, te } = useI18n()
const genericStore = useGenericStore()
const loadedEntityHandle = ref('')
const localConditions = ref<EmailCondition[]>([])
const valueOptionsByField = ref<Record<string, ValueOption[]>>({})
const conditionMenus = reactive<Record<string, boolean>>({})
const loadingValueOptions = new Set<string>()
let conditionKeyCounter = 0

const selectedEntityHandle = computed(() => {
  const value = props.sourceEntityReference

  if (typeof value === 'string') {
    return value.trim()
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ''
  }

  const record = value as SaplingGenericItem
  return typeof record.handle === 'string' ? record.handle.trim() : ''
})

const sourceTemplates = computed(() => {
  const entityHandle = loadedEntityHandle.value
  return entityHandle ? genericStore.getState(entityHandle).entityTemplates : []
})

const conditionFields = computed<ConditionFieldOption[]>(() =>
  sourceTemplates.value
    .filter(isConditionFieldTemplate)
    .map((template) => ({
      label: getConditionFieldLabel(loadedEntityHandle.value, template),
      value: template.name,
    }))
    .sort((left, right) => left.label.localeCompare(right.label)),
)

watch(
  () => props.modelValue,
  (value) => {
    localConditions.value = normalizeConditions(value)
  },
  { immediate: true, deep: true },
)

watch(
  selectedEntityHandle,
  async (value) => {
    loadedEntityHandle.value = value
    valueOptionsByField.value = {}

    if (!value) {
      return
    }

    await genericStore.loadGeneric(value, 'global')

    const allowedFields = new Set(conditionFields.value.map((entry) => entry.value))
    const filtered = localConditions.value.filter((condition) =>
      allowedFields.has(condition.observedField),
    )
    if (filtered.length !== localConditions.value.length) {
      localConditions.value = filtered
      emitConditions()
    }

    await ensureValueOptionsForConditions()
  },
  { immediate: true },
)

watch(
  () => localConditions.value.map((condition) => condition.observedField).join('|'),
  () => {
    void ensureValueOptionsForConditions()
  },
)

function addCondition(): void {
  localConditions.value = [
    ...localConditions.value,
    {
      key: createConditionKey(),
      observedField: '',
      sortOrder: localConditions.value.length,
    },
  ]
}

function updateObservedField(index: number, observedField: string): void {
  updateCondition(index, {
    observedField,
    oldValue: null,
    newValue: null,
  })
}

function updateCondition(index: number, patch: Partial<EmailCondition>): void {
  const next = [...localConditions.value]
  next[index] = { ...next[index], ...patch }
  localConditions.value = next
  emitConditions()
}

function removeCondition(index: number): void {
  const removedKey = localConditions.value[index]?.key
  localConditions.value = localConditions.value.filter(
    (_, conditionIndex) => conditionIndex !== index,
  )
  if (removedKey) {
    Object.keys(conditionMenus)
      .filter((key) => key.startsWith(`${removedKey}:`))
      .forEach((key) => delete conditionMenus[key])
  }
  emitConditions()
}

function conditionMenuKey(conditionKey: string, field: string): string {
  return `${conditionKey}:${field}`
}

function isConditionMenuOpen(conditionKey: string, field: string): boolean {
  return conditionMenus[conditionMenuKey(conditionKey, field)] === true
}

function setConditionMenuOpen(conditionKey: string, field: string, open: boolean): void {
  conditionMenus[conditionMenuKey(conditionKey, field)] = open
}

function emitConditions(): void {
  emit(
    'update:modelValue',
    localConditions.value
      .filter((condition) => condition.observedField.trim().length > 0)
      .map((condition, index) => ({
        ...(condition.handle != null ? { handle: condition.handle } : {}),
        observedField: condition.observedField.trim(),
        oldValue: normalizeOptionalValue(condition.oldValue),
        newValue: normalizeOptionalValue(condition.newValue),
        sortOrder: index,
      })),
  )
}

function normalizeConditions(value: unknown): EmailCondition[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(
      (entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object',
    )
    .map((entry, index) => ({
      key: createConditionKey(),
      handle: normalizeHandle(entry.handle),
      observedField: normalizeString(entry.observedField || entry.field),
      oldValue: normalizeNullableString(entry.oldValue),
      newValue: normalizeNullableString(entry.newValue),
      sortOrder: typeof entry.sortOrder === 'number' ? entry.sortOrder : index,
    }))
    .filter((condition) => condition.observedField.length > 0)
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
}

function createConditionKey(): string {
  conditionKeyCounter += 1
  return `condition-${conditionKeyCounter}`
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeNullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  return String(value)
}

function normalizeOptionalValue(value: unknown): string | null {
  const normalized = normalizeNullableString(value)
  return normalized && normalized.trim().length > 0 ? normalized : null
}

function normalizeConditionValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  return String(value)
}

function normalizeHandle(value: unknown): string | number | undefined {
  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }

  return undefined
}

function translateFieldLabel(entityHandle: string, fieldName: string): string {
  const translationKey = `${entityHandle}.${fieldName}`
  return te(translationKey) ? t(translationKey) : fieldName
}

function getConditionFieldLabel(entityHandle: string, template: EntityTemplate): string {
  const configuredLabel = template.formConfig?.label?.trim()
  return configuredLabel || translateFieldLabel(entityHandle, template.name)
}

function getSelectedFieldTemplate(fieldName: string): EntityTemplate | null {
  return sourceTemplates.value.find((template) => template.name === fieldName) ?? null
}

function isValueSelectionField(fieldName: string): boolean {
  const template = getSelectedFieldTemplate(fieldName)

  if (!template) {
    return false
  }

  return (
    template.kind === 'm:1' ||
    template.kind === '1:1' ||
    template.type === 'boolean' ||
    template.customField?.type === 'select' ||
    template.customField?.type === 'multiSelect'
  )
}

function getValueInputType(fieldName: string): string {
  const template = getSelectedFieldTemplate(fieldName)

  if (!template) {
    return 'text'
  }

  if (template.type === 'DateType') {
    return 'date'
  }

  if (template.type === 'time') {
    return 'time'
  }

  if (template.type === 'datetime') {
    return 'datetime-local'
  }

  if (
    template.options?.includes('isNumeric') ||
    ['number', 'integer', 'float', 'double', 'decimal'].includes(template.type)
  ) {
    return 'number'
  }

  return 'text'
}

function getValueOptions(fieldName: string): ValueOption[] {
  const template = getSelectedFieldTemplate(fieldName)

  if (template?.type === 'boolean') {
    return [
      { label: t('global.yes'), value: 'true' },
      { label: t('global.no'), value: 'false' },
    ]
  }

  if (template?.customField?.type === 'select' || template?.customField?.type === 'multiSelect') {
    return (template.customField.options ?? []).map((option) => ({
      label: option.label,
      value: option.value,
    }))
  }

  return valueOptionsByField.value[fieldName] ?? []
}

async function ensureValueOptionsForConditions(): Promise<void> {
  await Promise.all(
    [
      ...new Set(localConditions.value.map((condition) => condition.observedField).filter(Boolean)),
    ].map((fieldName) => ensureValueOptions(fieldName)),
  )
}

async function ensureValueOptions(fieldName: string): Promise<void> {
  if (valueOptionsByField.value[fieldName] || loadingValueOptions.has(fieldName)) {
    return
  }

  const template = getSelectedFieldTemplate(fieldName)
  const referenceName = template?.referenceName?.trim()
  if (!template || !referenceName || !['m:1', '1:1'].includes(template.kind ?? '')) {
    return
  }

  loadingValueOptions.add(fieldName)
  try {
    await genericStore.loadGeneric(referenceName, 'global')
    const referenceTemplates = genericStore.getState(referenceName).entityTemplates
    const result = await ApiGenericService.findAll<SaplingGenericItem>(referenceName, {
      orderBy: { handle: 'ASC' },
      relations: ['m:1'],
    })
    valueOptionsByField.value = {
      ...valueOptionsByField.value,
      [fieldName]: result.map((item) => ({
        label: getEntityValueLabel(item, referenceTemplates) || String(item.handle ?? ''),
        value: String(item.handle ?? ''),
      })),
    }
  } finally {
    loadingValueOptions.delete(fieldName)
  }
}

function isConditionFieldTemplate(template: EntityTemplate): boolean {
  if (
    (template.isPersistent === false && !template.customField) ||
    template.isPrimaryKey === true
  ) {
    return false
  }

  if (template.options?.includes('isSecurity') || template.options?.includes('isSystem')) {
    return false
  }

  if (template.inlineCollection) {
    return false
  }

  if (template.kind && !['m:1', '1:1'].includes(template.kind)) {
    return false
  }

  return true
}
</script>
