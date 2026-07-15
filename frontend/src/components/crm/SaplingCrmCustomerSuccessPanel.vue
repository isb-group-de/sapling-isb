<template>
  <section class="sapling-crm-workspace-panel glass-panel">
    <header class="sapling-crm-workspace-panel__header">
      <div>
        <p class="sapling-eyebrow">{{ eyebrow }}</p>
        <h2>{{ title }}</h2>
      </div>
      <v-chip variant="tonal" color="warning">{{ riskCount }}</v-chip>
    </header>

    <SaplingCrmWorkspaceList
      :title="riskTitle"
      :items="riskItems"
      empty-icon="mdi-shield-check-outline"
      :empty-text="riskEmptyText"
      @open="emit('openItem', $event)"
    />
    <SaplingCrmWorkspaceList
      :title="contactGapTitle"
      :items="contactGapItems"
      empty-icon="mdi-account-check-outline"
      :empty-text="contactGapEmptyText"
      @open="emit('openItem', $event)"
    />
  </section>
</template>

<script setup lang="ts">
import SaplingCrmWorkspaceList from './SaplingCrmWorkspaceList.vue'
import type { CrmWorkspaceItem } from './crmWorkspace.types'

defineProps<{
  eyebrow: string
  title: string
  riskCount: number
  riskItems: CrmWorkspaceItem[]
  riskTitle: string
  riskEmptyText: string
  contactGapItems: CrmWorkspaceItem[]
  contactGapTitle: string
  contactGapEmptyText: string
}>()

const emit = defineEmits<{
  openItem: [item: CrmWorkspaceItem]
}>()
</script>
