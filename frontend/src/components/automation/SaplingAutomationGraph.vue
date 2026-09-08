<template>
  <div
    class="sapling-automation-graph"
    role="region"
    :aria-label="t('automation.plan')"
    tabindex="0"
  >
    <svg
      :viewBox="`0 0 ${layout.width} ${layout.height}`"
      class="sapling-automation-graph__canvas"
      :width="layout.width"
      :height="layout.height"
      :aria-label="t('automation.plan')"
    >
      <defs>
        <marker
          :id="arrowId"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 1 1 L 9 5 L 1 9 z" />
        </marker>
      </defs>
      <g :transform="`translate(${layout.offset} 0)`">
        <text
          v-for="column in layout.columns"
          :key="column.type"
          :x="column.x + 14"
          y="30"
          class="sapling-automation-graph__column"
        >
          {{ t(`automation.${column.type}`) }}
        </text>
        <rect
          v-for="(lane, index) in layout.lanes"
          :key="lane.id"
          :x="layout.columns[1]!.x - 14"
          :y="lane.y - 12"
          :width="layout.width - layout.offset - layout.columns[1]!.x - 24"
          :height="AUTOMATION_NODE_HEIGHT + 24"
          rx="14"
          class="sapling-automation-graph__lane"
          :class="{ 'sapling-automation-graph__lane--alternate': index % 2 === 1 }"
        />
        <path
          v-for="edge in layout.edges"
          :key="edge.key"
          :d="edge.path"
          class="sapling-automation-graph__edge"
          :class="{
            'sapling-automation-graph__edge--possible': edge.kind === 'possible',
            'sapling-automation-graph__edge--highlighted': focused && highlighted(edge),
            'sapling-automation-graph__edge--dimmed': focused && !highlighted(edge),
          }"
          :marker-end="`url(#${arrowId})`"
        />
        <g
          v-for="node in layout.nodes"
          :key="node.id"
          tabindex="0"
          role="button"
          :aria-label="label(node)"
          @mouseenter="hovered = node"
          @mouseleave="hovered = null"
          @focus="keyboardFocused = node"
          @blur="keyboardFocused = null"
          @click="emit('select', node)"
          @keydown.enter="emit('select', node)"
          @keydown.space.prevent="emit('select', node)"
        >
          <title>{{ label(node) }}</title>
          <rect
            :x="node.x"
            :y="node.y"
            :width="AUTOMATION_NODE_WIDTH"
            :height="AUTOMATION_NODE_HEIGHT"
            rx="12"
            class="sapling-automation-graph__node"
            :class="{
              'sapling-automation-graph__node--event': node.type === 'event',
              'sapling-automation-graph__node--action': node.type === 'action',
              'sapling-automation-graph__node--inactive': node.rule?.active === false,
              'sapling-automation-graph__node--cycle': node.cycle,
            }"
          />
          <text :x="node.x + 16" :y="node.y + 23" class="sapling-automation-graph__caption">
            {{ t(`automation.${node.type}`) }}
          </text>
          <text :x="node.x + 16" :y="node.y + 47" class="sapling-automation-graph__text">
            <tspan
              v-for="(line, index) in wrapAutomationLabel(label(node))"
              :key="index"
              :x="node.x + 16"
              :dy="index === 0 ? 0 : 19"
            >
              {{ line }}
            </tspan>
          </text>
        </g>
      </g>
    </svg>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import {
  layoutAutomationGraph,
  wrapAutomationLabel,
  AUTOMATION_NODE_WIDTH,
  AUTOMATION_NODE_HEIGHT,
} from './automationGraphLayout'
import { useI18n } from 'vue-i18n'
import type { AutomationGraph, GraphNode } from './automationInspection.types'
const props = defineProps<{
  graph: AutomationGraph
  fieldLabel?: (entity: string, field: string) => string
  valueLabel?: (entity: string, field: string, value: unknown) => string
}>()
const emit = defineEmits<{ select: [node: GraphNode] }>()
const { t } = useI18n()
function label(node: GraphNode) {
  const rule = node.rule
  const field = (entity: string, name: unknown) =>
    props.fieldLabel?.(entity, String(name)) ?? String(name)
  const value = (entity: string, name: unknown, raw: unknown) =>
    props.valueLabel?.(entity, String(name), raw) ?? String(raw ?? '—')
  let title =
    rule?.title || `${t(`navigation.${node.entity}`)} · ${t(`automation.${node.operation}`)}`
  if (rule && node.type === 'reference')
    title = rule.referencePath
      .map((step) => `${field(rule.sourceEntity, step.field)} → ${t(`navigation.${step.entity}`)}`)
      .join(' → ')
  if (rule && node.type === 'condition') {
    const groups = new Map<number, string[]>()
    for (const condition of rule.conditions) {
      const entity = condition.scope === 'target' ? rule.targetEntity : rule.sourceEntity
      const group = Number(condition.groupOrder ?? 0)
      const text = `${field(entity, condition.field)} ${condition.operator ? t(`automation.${condition.operator}`) : '='} ${value(entity, condition.field, condition.newValue)}`
      groups.set(group, [...(groups.get(group) ?? []), text])
    }
    title = [...groups.values()]
      .map((parts) => `(${parts.join(` ${t('automation.and')} `)})`)
      .join(` ${t('automation.or')} `)
  }
  if (rule && node.type === 'action')
    title =
      rule.kind === 'field'
        ? rule.assignments
            .map(
              (assignment) =>
                `${field(rule.targetEntity, assignment.field)} → ${value(rule.targetEntity, assignment.field, assignment.value)}`,
            )
            .join(', ')
        : `${t(`automation.kind.${rule.kind}`)}${rule.recipientField ? ` → ${field(rule.targetEntity, rule.recipientField)}` : ''}`
  return node.cycle ? `${title} · ${t('automation.cycle')}` : title
}
const layout = computed(() => layoutAutomationGraph(props.graph))
const hovered = ref<GraphNode | null>(null)
const keyboardFocused = ref<GraphNode | null>(null)
const focused = computed(() => hovered.value ?? keyboardFocused.value)
const arrowId = useId()
function highlighted(edge: (typeof layout.value.edges)[number]) {
  return focused.value?.rule
    ? edge.ruleId === focused.value.rule.id
    : edge.source === focused.value?.id || edge.target === focused.value?.id
}
</script>
