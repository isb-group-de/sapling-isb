<template>
  <div class="sapling-template-value-field">
    <SaplingDialogEditFieldRenderer
      :template="template"
      :entity-handle="entityHandle"
      mode="create"
      :form-values="formValues"
      :visible-templates="visibleTemplates"
      :permissions="permissions"
      :icon-names="iconNames"
      :is-reference-visible="true"
      :rules="rules"
      :field-disabled="disabled"
      :reference-field-disabled="disabled || referenceDisabled"
      :reference-parent-filter="referenceParentFilter"
      :show-label="showLabel"
      @update-field="updateField"
    />
  </div>
</template>

<script lang="ts" setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AccumulatedPermission, EntityTemplate } from '@/entity/structure'
import type { SaplingGenericItem } from '@/entity/entity'
import type { FilterQuery } from '@/services/api.generic.service'
import ApiGenericService from '@/services/api.generic.service'
import SaplingDialogEditFieldRenderer from '@/components/dialog/SaplingDialogEditFieldRenderer.vue'
import { getLocalDateTimeParts, toUtcIsoString } from '@/composables/dialog/saplingDialogEdit.utils'
import { useGenericStore } from '@/stores/genericStore'

const props = withDefaults(
  defineProps<{
    modelValue: unknown
    template: EntityTemplate
    entityHandle: string
    visibleTemplates: EntityTemplate[]
    permissions: AccumulatedPermission[] | null
    referenceItems?: Record<string, SaplingGenericItem | null | undefined>
    referenceParentFilter?: FilterQuery
    rules?: Array<(value: unknown) => true | string>
    disabled?: boolean
    referenceDisabled?: boolean
    showLabel?: boolean
  }>(),
  {
    rules: () => [],
    disabled: false,
    referenceDisabled: false,
    showLabel: false,
  },
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: unknown): void
  (event: 'update:displayValue', value: string): void
}>()

const { t, locale } = useI18n()
const genericStore = useGenericStore()
const formValues = reactive<SaplingGenericItem>({})
const iconNames = ref<Array<{ name: string; unicode?: string }>>([])
const REFERENCE_BATCH_DELAY_MS = 20
let iconLoadPromise: Promise<void> | null = null
let referenceLoadRequestId = 0
let isSyncingFromModel = false

type ReferenceBatch = {
  handles: Set<string>
  resolvers: Map<string, Array<(value: SaplingGenericItem | null) => void>>
  promise: Promise<void> | null
}

const referenceItemCache = new Map<string, SaplingGenericItem | null>()
const pendingReferenceBatches = new Map<string, ReferenceBatch>()

async function ensureIconsLoaded(): Promise<void> {
  if (
    iconNames.value.length > 0 ||
    iconLoadPromise ||
    (!props.template.options?.includes('isIcon') && props.template.formConfig?.renderer !== 'icon')
  ) {
    await iconLoadPromise
    return
  }

  iconLoadPromise = import('@/constants/mdi.icons').then((mod) => {
    iconNames.value = mod.mdiIcons
  })
  await iconLoadPromise
}

async function syncFormValue(value: unknown): Promise<void> {
  isSyncingFromModel = true
  try {
    if (isDateTimeTemplate(props.template)) {
      syncDateTimeValue(value)
      emitDisplayValue(value)
      return
    }

    if (props.template.isReference && props.template.referenceName) {
      const resolvedValue = await resolveReferenceValue(value)
      formValues[props.template.name] = resolvedValue
      emitDisplayValue(resolvedValue ?? value)
      return
    }

    const normalizedValue = normalizeInputValue(value)
    formValues[props.template.name] = normalizedValue
    emitDisplayValue(normalizedValue)
  } finally {
    isSyncingFromModel = false
  }
}

function syncDateTimeValue(value: unknown): void {
  const parts =
    typeof value === 'string' && value.trim()
      ? getLocalDateTimeParts(value)
      : { date: '', time: '' }

  formValues[`${props.template.name}_date`] = parts.date
  formValues[`${props.template.name}_time`] = parts.time
}

async function resolveReferenceValue(value: unknown): Promise<SaplingGenericItem | null> {
  if (!value) {
    return null
  }

  if (typeof value === 'object') {
    return value as SaplingGenericItem
  }

  const requestId = ++referenceLoadRequestId
  const handle = normalizeReferenceHandle(value)
  const responseItem =
    props.referenceItems && Object.prototype.hasOwnProperty.call(props.referenceItems, handle)
      ? (props.referenceItems[handle] ?? null)
      : await loadReferenceItem(props.template.referenceName!, handle)

  if (requestId !== referenceLoadRequestId) {
    return formValues[props.template.name] as SaplingGenericItem | null
  }

  return responseItem
}

function normalizeReferenceHandle(value: unknown): string {
  return String(value ?? '').trim()
}

function getReferenceCacheKey(entityHandle: string, handle: string): string {
  return `${entityHandle}:${handle}`
}

async function loadReferenceItem(
  entityHandle: string,
  handle: string,
): Promise<SaplingGenericItem | null> {
  if (!handle) {
    return null
  }

  const cacheKey = getReferenceCacheKey(entityHandle, handle)
  if (referenceItemCache.has(cacheKey)) {
    return referenceItemCache.get(cacheKey) ?? null
  }

  return queueReferenceItemLoad(entityHandle, handle)
}

function queueReferenceItemLoad(
  entityHandle: string,
  handle: string,
): Promise<SaplingGenericItem | null> {
  const batch = getReferenceBatch(entityHandle)
  batch.handles.add(handle)

  const promise = new Promise<SaplingGenericItem | null>((resolve) => {
    const resolvers = batch.resolvers.get(handle) ?? []
    resolvers.push(resolve)
    batch.resolvers.set(handle, resolvers)
  })

  if (!batch.promise) {
    batch.promise = new Promise<void>((resolve) => {
      setTimeout(() => {
        void flushReferenceBatch(entityHandle, batch).then(resolve)
      }, REFERENCE_BATCH_DELAY_MS)
    })
  }

  return promise
}

function getReferenceBatch(entityHandle: string): ReferenceBatch {
  const existingBatch = pendingReferenceBatches.get(entityHandle)
  if (existingBatch) {
    return existingBatch
  }

  const batch: ReferenceBatch = {
    handles: new Set<string>(),
    resolvers: new Map<string, Array<(value: SaplingGenericItem | null) => void>>(),
    promise: null,
  }
  pendingReferenceBatches.set(entityHandle, batch)
  return batch
}

async function flushReferenceBatch(entityHandle: string, batch: ReferenceBatch): Promise<void> {
  pendingReferenceBatches.delete(entityHandle)
  const handles = [...batch.handles]

  try {
    const response = await ApiGenericService.find<SaplingGenericItem>(entityHandle, {
      filter: { handle: { $in: handles } },
      limit: handles.length,
      relations: ['m:1'],
    })
    const itemsByHandle = new Map(
      (response.data ?? [])
        .map((item) => [normalizeReferenceHandle(item.handle), item] as const)
        .filter(([itemHandle]) => itemHandle.length > 0),
    )

    for (const handle of handles) {
      const item = itemsByHandle.get(handle) ?? null
      referenceItemCache.set(getReferenceCacheKey(entityHandle, handle), item)
      resolveReferenceHandle(batch, handle, item)
    }
  } catch {
    for (const handle of handles) {
      resolveReferenceHandle(batch, handle, null)
    }
  }
}

function resolveReferenceHandle(
  batch: ReferenceBatch,
  handle: string,
  item: SaplingGenericItem | null,
): void {
  for (const resolve of batch.resolvers.get(handle) ?? []) {
    resolve(item)
  }
}

function normalizeInputValue(value: unknown): unknown {
  if (!isBooleanTemplate(props.template) || typeof value !== 'string') {
    return value
  }

  const normalized = value.trim().toLowerCase()
  if (['true', '1', 'yes', 'ja', 'on'].includes(normalized)) {
    return true
  }
  if (['false', '0', 'no', 'nein', 'off'].includes(normalized)) {
    return false
  }

  return value
}

function updateField(key: string, value: unknown): void {
  formValues[key] = value

  if (isSyncingFromModel) {
    return
  }

  if (isDateTimeTemplate(props.template)) {
    emitDateTimeValue()
    return
  }

  emit('update:modelValue', normalizeOutputValue(value))
  emitDisplayValue(value)
}

function emitDateTimeValue(): void {
  const dateValue = formValues[`${props.template.name}_date`]
  const timeValue = formValues[`${props.template.name}_time`]

  if (!dateValue) {
    emit('update:modelValue', null)
    emitDisplayValue(null)
    return
  }

  const value = toUtcIsoString(String(dateValue), String(timeValue || '00:00'))
  emit('update:modelValue', value)
  emitDisplayValue(value)
}

function normalizeOutputValue(value: unknown): unknown {
  if (props.template.isReference && value && typeof value === 'object') {
    return (value as SaplingGenericItem).handle ?? null
  }

  return value
}

function emitDisplayValue(value: unknown): void {
  emit('update:displayValue', formatDisplayValue(value))
}

function formatDisplayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  if (typeof value === 'boolean') {
    return t(value ? 'global.yes' : 'global.no')
  }

  if (props.template.isReference && typeof value === 'object' && !Array.isArray(value)) {
    return formatReferenceDisplayValue(value as SaplingGenericItem)
  }

  const customOptions = props.template.customField?.options ?? []
  if (Array.isArray(value)) {
    return value
      .map(
        (entry) => customOptions.find((option) => option.value === entry)?.label ?? String(entry),
      )
      .join(', ')
  }

  const customOption = customOptions.find((option) => option.value === value)
  if (customOption) {
    return customOption.label
  }

  if (isDateTimeTemplate(props.template) && typeof value === 'string') {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat(locale.value, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
    }
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

function formatReferenceDisplayValue(item: SaplingGenericItem): string {
  const templates = props.template.referenceName
    ? genericStore.getState(props.template.referenceName).entityTemplates
    : []
  const values = templates
    .filter((template) => template.options?.includes('isValue'))
    .map((template) => item[template.name])
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map(String)

  return values.length > 0 ? values.join(' · ') : String(item.handle ?? '')
}

function isDateTimeTemplate(template: EntityTemplate): boolean {
  return template.type === 'datetime' || template.formConfig?.renderer === 'dateTime'
}

function isBooleanTemplate(template: EntityTemplate): boolean {
  return template.type === 'boolean' || template.formConfig?.renderer === 'boolean'
}

watch(
  () => [props.modelValue, props.template.name, props.template.referenceName] as const,
  ([value]) => {
    void syncFormValue(value)
  },
  { immediate: true },
)

watch(
  () => props.template,
  () => {
    void ensureIconsLoaded()
  },
  { immediate: true },
)

onMounted(() => {
  void ensureIconsLoaded()
})
</script>
