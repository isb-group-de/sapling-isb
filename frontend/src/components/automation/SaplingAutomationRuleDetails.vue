<template>
  <v-card variant="flat" class="sapling-automation-details">
    <div class="sapling-automation-details__header">
      <h3>{{ selected.title }}</h3>
      <v-btn
        color="primary"
        variant="tonal"
        size="small"
        prepend-icon="mdi-open-in-new"
        @click="emit('open', selected)"
        >{{ t('automation.editRule') }}</v-btn
      >
    </div>
    <v-card-text class="sapling-automation-details__body">
      <p>
        {{ t(`automation.kind.${selected.kind}`) }} · {{ t(`automation.${selected.operation}`) }} ·
        {{ t('automation.priority') }}:
        {{ selected.priority }}
      </p>
      <p>
        {{ t(selected.active ? 'automation.active' : 'automation.inactive') }} ·
        {{ t(selected.repeated ? 'automation.repeated' : 'automation.once') }}
      </p>
      <p v-if="selected.recipientField">
        {{ t('automation.recipient') }}:
        {{ fieldLabel(selected.targetEntity, selected.recipientField) }}
      </p>
      <p v-if="selected.templateHandle">
        {{ t('automation.template') }}: {{ selected.templateHandle }}
      </p>
      <p v-if="selected.kind === 'inbox'">
        {{ t(selected.notifyActor ? 'automation.notifyActor' : 'automation.excludeActor') }}
      </p>
      <p v-if="!selected.conditions.length">{{ t('automation.always') }}</p>
      <p v-for="(conditions, group, index) in conditionGroups" :key="group">
        {{ index > 0 ? t('automation.or') : '' }}
        {{ conditions.join(` ${t('automation.and')} `) }}
      </p>
      <p v-for="(step, index) in selected.referencePath" :key="index">
        {{ t('automation.reference') }}:
        {{ fieldLabel(selected.sourceEntity, String(step.field ?? '')) }} →
        {{ t(`navigation.${String(step.entity)}`) }}
      </p>
      <p v-for="(assignment, index) in selected.assignments" :key="index">
        {{ fieldLabel(selected.targetEntity, String(assignment.field)) }} →
        {{ valueLabel(selected.targetEntity, String(assignment.field), assignment.value) }}
      </p>
    </v-card-text>
  </v-card>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AutomationRule } from './automationInspection.types'
const props = defineProps<{
  selected: AutomationRule
  fieldLabel: (entity: string, field: string) => string
  valueLabel: (entity: string, field: string, value: unknown) => string
}>()
const emit = defineEmits<{ open: [rule: AutomationRule] }>()
const { t } = useI18n()
const fieldLabel = (entity: string, field: string) => props.fieldLabel(entity, field)
const valueLabel = (entity: string, field: string, value: unknown) =>
  props.valueLabel(entity, field, value)
const conditionGroups = computed(() => {
  const groups: Record<number, string[]> = {}
  for (const c of props.selected?.conditions ?? []) {
    const group = Number(c.groupOrder ?? 0),
      entity = c.scope === 'target' ? props.selected!.targetEntity : props.selected!.sourceEntity
    const oldValue =
      c.oldValue == null ? '' : `${valueLabel(entity, String(c.field), c.oldValue)} → `
    ;(groups[group] ??= []).push(
      `${fieldLabel(entity, String(c.field))}: ${oldValue}${c.operator ? t(`automation.${c.operator}`) + ' ' : ''}${c.newValue == null ? t('automation.changed') : valueLabel(entity, String(c.field), c.newValue)}`,
    )
  }
  return groups
})
</script>
