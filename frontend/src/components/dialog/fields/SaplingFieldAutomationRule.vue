<template>
  <div class="sapling-automation-rule">
    <template v-if="kind === 'referencePath'">
      <div v-for="(step, index) in path" :key="index" class="sapling-automation-rule__row">
        <SaplingAutocomplete
          :label="t('fieldAutomation.referencePath')"
          :items="edgeOptions(index)"
          item-title="label"
          item-value="value"
          :model-value="step.field ? encode(step) : null"
          :disabled="disabled"
          @update:model-value="(value) => updateStep(index, value)"
        />
        <v-btn
          icon="mdi-delete-outline"
          variant="text"
          :aria-label="t('global.remove')"
          :title="t('global.remove')"
          :disabled="disabled"
          @click="remove(index)"
        />
      </div>
      <v-btn
        prepend-icon="mdi-plus"
        variant="tonal"
        :disabled="disabled || !sourceHandle"
        @click="addPath"
        >{{ t('global.add') }}</v-btn
      >
    </template>
    <template v-else-if="kind === 'conditions'">
      <div
        v-for="(condition, index) in conditions"
        :key="index"
        class="sapling-automation-rule__condition"
      >
        <SaplingAutocomplete
          :label="t('fieldAutomation.conditionScope')"
          :items="scopeOptions"
          item-title="label"
          item-value="value"
          :model-value="condition.scope"
          :disabled="disabled"
          @update:model-value="(value) => patchCondition(index, { scope: String(value) as Scope })"
        />
        <SaplingAutocomplete
          :label="t('fieldAutomation.conditionField')"
          :items="fieldOptions(condition.scope)"
          item-title="label"
          item-value="value"
          :model-value="condition.field"
          :disabled="disabled"
          @update:model-value="
            (value) =>
              patchCondition(index, {
                field: String(value),
                oldValue: undefined,
                newValue: undefined,
              })
          "
        />
        <SaplingAutocomplete
          :label="t('fieldAutomation.conditionMode')"
          :items="conditionModes"
          item-title="label"
          item-value="value"
          :model-value="mode(condition)"
          :disabled="disabled"
          @update:model-value="(value) => setMode(index, String(value))"
        />
        <SaplingFieldSingleSelect
          v-if="conditionField(condition)?.isReference && mode(condition) === 'transition'"
          :label="t('fieldAutomation.oldValue')"
          :entity-handle="conditionField(condition)?.referenceName ?? ''"
          :model-value="referenceModel(condition.oldValue)"
          :disabled="disabled"
          @update:model-value="
            (value) => patchCondition(index, { oldValue: referenceValue(value) })
          "
        />
        <SaplingTextField
          v-else-if="
            mode(condition) === 'transition' &&
            conditionField(condition)?.type !== 'boolean' &&
            !isNumericField(conditionField(condition))
          "
          :label="t('fieldAutomation.oldValue')"
          :model-value="condition.oldValue ?? null"
          :disabled="disabled"
          @update:model-value="(value) => patchCondition(index, { oldValue: value })"
        />
        <SaplingAutocomplete
          v-else-if="
            mode(condition) === 'transition' && conditionField(condition)?.type === 'boolean'
          "
          :label="t('fieldAutomation.oldValue')"
          :items="booleanOptions"
          item-title="label"
          item-value="value"
          :model-value="condition.oldValue"
          :disabled="disabled"
          @update:model-value="(value) => patchCondition(index, { oldValue: value })"
        />
        <SaplingNumberField
          v-else-if="mode(condition) === 'transition'"
          :label="t('fieldAutomation.oldValue')"
          :model-value="numberValue(condition.oldValue)"
          :disabled="disabled"
          @update:model-value="(value) => patchCondition(index, { oldValue: value })"
        />
        <SaplingFieldSingleSelect
          v-if="conditionField(condition)?.isReference && mode(condition) !== 'changed'"
          :label="
            mode(condition) === 'transition'
              ? t('fieldAutomation.newValue')
              : t('fieldAutomation.conditionValue')
          "
          :entity-handle="conditionField(condition)?.referenceName ?? ''"
          :model-value="referenceModel(condition.newValue ?? condition.oldValue)"
          :disabled="disabled"
          @update:model-value="(value) => setConditionValue(index, referenceValue(value))"
        />
        <SaplingTextField
          v-else-if="
            mode(condition) !== 'changed' &&
            conditionField(condition)?.type !== 'boolean' &&
            !isNumericField(conditionField(condition))
          "
          :label="
            mode(condition) === 'transition'
              ? t('fieldAutomation.newValue')
              : t('fieldAutomation.conditionValue')
          "
          :model-value="condition.newValue ?? condition.oldValue ?? null"
          :disabled="disabled"
          @update:model-value="(value) => setConditionValue(index, value)"
        />
        <SaplingAutocomplete
          v-else-if="mode(condition) !== 'changed' && conditionField(condition)?.type === 'boolean'"
          :label="
            mode(condition) === 'transition'
              ? t('fieldAutomation.newValue')
              : t('fieldAutomation.conditionValue')
          "
          :items="booleanOptions"
          item-title="label"
          item-value="value"
          :model-value="condition.newValue ?? condition.oldValue"
          :disabled="disabled"
          @update:model-value="(value) => setConditionValue(index, value)"
        />
        <SaplingNumberField
          v-else-if="mode(condition) !== 'changed'"
          :label="
            mode(condition) === 'transition'
              ? t('fieldAutomation.newValue')
              : t('fieldAutomation.conditionValue')
          "
          :model-value="numberValue(condition.newValue ?? condition.oldValue)"
          :disabled="disabled"
          @update:model-value="(value) => setConditionValue(index, value)"
        />
        <SaplingNumberField
          :label="t('fieldAutomation.conditionGroup')"
          :model-value="condition.groupOrder ?? 0"
          :disabled="disabled"
          @update:model-value="(value) => patchCondition(index, { groupOrder: Number(value ?? 0) })"
        />
        <v-btn
          icon="mdi-delete-outline"
          variant="text"
          :aria-label="t('global.remove')"
          :title="t('global.remove')"
          :disabled="disabled"
          @click="remove(index)"
        />
      </div>
      <v-btn
        prepend-icon="mdi-plus"
        variant="tonal"
        :disabled="disabled || !sourceHandle || !targetHandle"
        @click="addCondition"
        >{{ t('fieldAutomation.addCondition') }}</v-btn
      >
    </template>
    <template v-else>
      <div
        v-for="(assignment, index) in assignments"
        :key="index"
        class="sapling-automation-rule__row"
      >
        <SaplingAutocomplete
          :label="t('fieldAutomation.assignmentField')"
          :items="assignmentFields"
          item-title="label"
          item-value="value"
          :model-value="assignment.field"
          :disabled="disabled"
          @update:model-value="
            (value) => patchAssignment(index, { field: String(value), value: null })
          "
        />
        <SaplingFieldSingleSelect
          v-if="targetField(assignment.field)?.isReference"
          :label="t('fieldAutomation.assignmentValue')"
          :entity-handle="targetField(assignment.field)?.referenceName ?? ''"
          :model-value="referenceModel(assignment.value)"
          :disabled="disabled"
          @update:model-value="(value) => patchAssignment(index, { value: referenceValue(value) })"
        />
        <SaplingAutocomplete
          v-else-if="targetField(assignment.field)?.type === 'boolean'"
          :label="t('fieldAutomation.assignmentValue')"
          :items="booleanOptions"
          item-title="label"
          item-value="value"
          :model-value="assignment.value"
          :disabled="disabled"
          @update:model-value="(value) => patchAssignment(index, { value })"
        />
        <SaplingTextField
          v-else-if="!isNumericField(targetField(assignment.field))"
          :label="t('fieldAutomation.assignmentValue')"
          :model-value="assignment.value ?? null"
          :disabled="disabled"
          @update:model-value="(value) => patchAssignment(index, { value })"
        />
        <SaplingNumberField
          v-else
          :label="t('fieldAutomation.assignmentValue')"
          :model-value="numberValue(assignment.value)"
          :disabled="disabled"
          @update:model-value="(value) => patchAssignment(index, { value })"
        />
        <v-btn
          icon="mdi-delete-outline"
          variant="text"
          :aria-label="t('global.remove')"
          :title="t('global.remove')"
          :disabled="disabled"
          @click="remove(index)"
        />
      </div>
      <v-btn
        prepend-icon="mdi-plus"
        variant="tonal"
        :disabled="disabled || !targetHandle"
        @click="addAssignment"
        >{{ t('global.add') }}</v-btn
      >
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EntityTemplate } from '@/entity/structure'
import type { SaplingGenericItem } from '@/entity/entity'
import ApiGenericService from '@/services/api.generic.service'
import ApiTemplateService from '@/services/api.template.service'
import TranslationService from '@/services/translation.service'
import SaplingAutocomplete from '@/components/common/SaplingAutocomplete.vue'
import SaplingTextField from '@/components/common/SaplingTextField.vue'
import SaplingNumberField from '@/components/dialog/fields/SaplingFieldNumber.vue'
import SaplingFieldSingleSelect from '@/components/dialog/fields/SaplingFieldSingleSelect.vue'
type Scope = 'source' | 'target'
type Operator = 'changed' | 'equals' | 'changesTo' | 'changesFrom' | 'transition'
type Step = { field: string; direction?: 'forward' | 'inverse'; entity?: string }
type Condition = {
  scope: Scope
  field: string
  operator?: Operator
  oldValue?: unknown
  newValue?: unknown
  groupOrder?: number
}
type Assignment = { field: string; value: unknown }
const props = defineProps<{
  modelValue?: unknown
  disabled?: boolean
  kind: 'referencePath' | 'conditions' | 'assignments'
  sourceEntity?: unknown
  targetEntity?: unknown
}>()
const emit = defineEmits<{ (event: 'update:modelValue', value: unknown[]): void }>()
const { t, te } = useI18n()
const translationService = new TranslationService()
const templates = ref<Record<string, EntityTemplate[]>>({})
const entityHandles = ref<string[]>([])
const path = ref<Step[]>([])
const conditions = ref<Condition[]>([])
const assignments = ref<Assignment[]>([])
const refHandle = (value: unknown) =>
  typeof value === 'string'
    ? value
    : value && typeof value === 'object'
      ? String((value as { handle?: unknown }).handle ?? '')
      : ''
const sourceHandle = computed(() => refHandle(props.sourceEntity))
const targetHandle = computed(() => refHandle(props.targetEntity))
const referenceModel = (value: unknown) =>
  value == null || value === ''
    ? null
    : typeof value === 'object'
      ? (value as SaplingGenericItem)
      : ({ handle: value } as SaplingGenericItem)
const referenceValue = (value: unknown) =>
  value && typeof value === 'object' ? ((value as { handle?: unknown }).handle ?? null) : value
watch(
  () => props.modelValue,
  (value) => {
    const items = Array.isArray(value) ? JSON.parse(JSON.stringify(value)) : []
    if (props.kind === 'referencePath') path.value = items
    else if (props.kind === 'conditions') conditions.value = items
    else assignments.value = items
  },
  { immediate: true, deep: true },
)
watch(
  [sourceHandle, targetHandle],
  async (values) => {
    await Promise.all(values.filter(Boolean).map(load))
  },
  { immediate: true },
)
onMounted(async () => {
  await translationService.prepare('fieldAutomation')
  const entities = await ApiGenericService.findAll<{ handle: string }>('entity', {
    pageSize: 100,
    fields: ['handle'],
  })
  entityHandles.value = entities.map((item) => item.handle)
  await Promise.all(entityHandles.value.map(load))
})
async function load(entity: string) {
  if (entity && !templates.value[entity])
    templates.value[entity] = await ApiTemplateService.getEntityTemplate(entity)
}
function label(entity: string, field: EntityTemplate) {
  const key = `${entity}.${field.name}`
  return te(key) ? t(key) : field.name
}
function entityLabel(entity: string) {
  const key = `navigation.${entity}`
  return te(key) ? t(key) : entity
}
function currentEntity(index: number) {
  let entity = sourceHandle.value
  for (const step of path.value.slice(0, index)) {
    const field = templates.value[entity]?.find((item) => item.name === step.field)
    entity =
      step.direction === 'inverse'
        ? (step.entity ?? '')
        : field?.genericReference
          ? (step.entity ?? '')
          : (field?.referenceName ?? '')
  }
  return entity
}
function edgeOptions(index: number) {
  const current = currentEntity(index)
  const forward = (templates.value[current] ?? [])
    .filter((field) => field.isReference || field.genericReference)
    .flatMap((field) =>
      field.genericReference
        ? entityHandles.value.map((entity) => ({
            label: `${label(current, field)} → ${entityLabel(entity)}`,
            value: encode({ field: field.name, entity }),
          }))
        : [
            {
              label: `${label(current, field)} → ${entityLabel(field.referenceName ?? '')}`,
              value: encode({ field: field.name }),
            },
          ],
    )
  const inverse = entityHandles.value.flatMap((entity) =>
    (templates.value[entity] ?? [])
      .filter(
        (field) => (field.isReference && field.referenceName === current) || field.genericReference,
      )
      .map((field) => ({
        label: `${entityLabel(entity)} · ${label(entity, field)} ←`,
        value: encode({ field: field.name, direction: 'inverse', entity }),
      })),
  )
  return [...forward, ...inverse]
}
function encode(value: unknown) {
  return JSON.stringify(value)
}
function updateStep(index: number, value: unknown) {
  try {
    path.value[index] = JSON.parse(String(value))
    path.value = path.value.slice(0, index + 1)
    emit('update:modelValue', path.value)
  } catch {
    return
  }
}
function list() {
  return props.kind === 'referencePath'
    ? path.value
    : props.kind === 'conditions'
      ? conditions.value
      : assignments.value
}
function remove(index: number) {
  list().splice(index, 1)
  emit('update:modelValue', [...list()])
}
function addPath() {
  path.value.push({ field: '' })
  emit('update:modelValue', path.value)
}
const scopeOptions = computed(() => [
  { label: t('fieldAutomation.sourceEntity'), value: 'source' },
  { label: t('fieldAutomation.targetEntity'), value: 'target' },
])
const conditionModes = computed(() => [
  { label: t('fieldAutomation.changed'), value: 'changed' },
  { label: t('fieldAutomation.hasValue'), value: 'equals' },
  { label: t('fieldAutomation.changesTo'), value: 'changesTo' },
  { label: t('fieldAutomation.changesFrom'), value: 'changesFrom' },
  { label: t('fieldAutomation.transition'), value: 'transition' },
])
const booleanOptions = [
  { label: 'Ja', value: true },
  { label: 'Nein', value: false },
]
function fieldOptions(scope: Scope) {
  const entity = scope === 'source' ? sourceHandle.value : targetHandle.value
  return (templates.value[entity] ?? [])
    .filter((field) => field.isPersistent && !field.options?.includes('isSecurity'))
    .map((field) => ({ label: label(entity, field), value: field.name }))
}
function conditionField(condition: Condition) {
  const entity = condition.scope === 'source' ? sourceHandle.value : targetHandle.value
  return templates.value[entity]?.find((field) => field.name === condition.field)
}
function mode(condition: Condition): Operator {
  return (
    condition.operator ??
    (!('oldValue' in condition) && !('newValue' in condition)
      ? 'changed'
      : 'newValue' in condition
        ? 'changesTo'
        : 'changesFrom')
  )
}
function patchCondition(index: number, patch: Partial<Condition>) {
  conditions.value[index] = { ...conditions.value[index], ...patch }
  emit('update:modelValue', conditions.value)
}
function setMode(index: number, value: string) {
  const item = {
    scope: conditions.value[index].scope,
    field: conditions.value[index].field,
    groupOrder: conditions.value[index].groupOrder,
    operator: value as Operator,
  }
  conditions.value[index] =
    value === 'changed'
      ? item
      : value === 'changesFrom'
        ? { ...item, oldValue: null }
        : value === 'transition'
          ? { ...item, oldValue: null, newValue: null }
          : { ...item, newValue: null }
  emit('update:modelValue', conditions.value)
}
function setConditionValue(index: number, value: unknown) {
  if (mode(conditions.value[index]) === 'changesFrom') patchCondition(index, { oldValue: value })
  else patchCondition(index, { newValue: value })
}
function addCondition() {
  conditions.value.push({ scope: 'source', field: '', operator: 'changed', groupOrder: 0 })
  emit('update:modelValue', conditions.value)
}
const assignmentFields = computed(() =>
  (templates.value[targetHandle.value] ?? [])
    .filter(
      (field) =>
        field.isPersistent &&
        field.fieldAccess?.allowUpdate &&
        !['1:m', 'm:n', 'n:m'].includes(field.kind ?? '') &&
        !field.options?.some((option) => ['isReadOnly', 'isSystem', 'isSecurity'].includes(option)),
    )
    .map((field) => ({ label: label(targetHandle.value, field), value: field.name })),
)
function targetField(fieldName: string) {
  return templates.value[targetHandle.value]?.find((field) => field.name === fieldName)
}
function isNumericField(field?: EntityTemplate) {
  return field?.type === 'number' || field?.options?.includes('isNumeric')
}
function numberValue(value: unknown) {
  return typeof value === 'number' ? value : value == null || value === '' ? null : Number(value)
}
function patchAssignment(index: number, patch: Partial<Assignment>) {
  assignments.value[index] = { ...assignments.value[index], ...patch }
  emit('update:modelValue', assignments.value)
}
function addAssignment() {
  assignments.value.push({ field: '', value: null })
  emit('update:modelValue', assignments.value)
}
</script>
