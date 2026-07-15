<template>
  <section class="sapling-crm-workspace-panel glass-panel">
    <header class="sapling-crm-workspace-panel__header">
      <div>
        <p class="sapling-eyebrow">{{ eyebrow }}</p>
        <h2>{{ title }}</h2>
      </div>
      <v-chip variant="tonal" color="primary">{{ opportunityCount }}</v-chip>
    </header>

    <div class="sapling-crm-workspace__stage-grid">
      <button
        v-for="stage in stages"
        :key="stage.key"
        class="sapling-crm-stage"
        type="button"
        :style="{ '--sapling-crm-stage-color': stage.color }"
        @click="emit('openStage', stage)"
      >
        <div class="sapling-crm-stage__bar" />
        <span>{{ stage.label }}</span>
        <strong>{{ stage.count }}</strong>
        <small>{{ formatMoney(stage.value) }}</small>
      </button>
    </div>

    <SaplingCrmWorkspaceList
      :title="listTitle"
      :items="items"
      empty-icon="mdi-calendar-check-outline"
      :empty-text="emptyText"
      @open="emit('openItem', $event)"
    />
  </section>
</template>

<script setup lang="ts">
import SaplingCrmWorkspaceList from './SaplingCrmWorkspaceList.vue'
import type { CrmStageBreakdown, CrmWorkspaceItem } from './crmWorkspace.types'

defineProps<{
  eyebrow: string
  title: string
  opportunityCount: number
  stages: CrmStageBreakdown[]
  items: CrmWorkspaceItem[]
  listTitle: string
  emptyText: string
  formatMoney: (value: unknown) => string
}>()

const emit = defineEmits<{
  openStage: [stage: CrmStageBreakdown]
  openItem: [item: CrmWorkspaceItem]
}>()
</script>
