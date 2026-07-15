<template>
  <section class="sapling-crm-workspace-panel glass-panel">
    <header class="sapling-crm-workspace-panel__header">
      <div>
        <p class="sapling-eyebrow">{{ eyebrow }}</p>
        <h2>{{ title }}</h2>
      </div>
      <v-chip variant="tonal" color="info">{{ companyCount }}</v-chip>
    </header>

    <div class="sapling-crm-account-grid">
      <button
        v-for="company in topAccounts"
        :key="company.id"
        class="sapling-crm-account-card"
        type="button"
        @click="emit('openItem', company)"
      >
        <span class="sapling-crm-account-card__title">{{ company.title }}</span>
        <span class="sapling-crm-account-card__meta">{{ company.subtitle }}</span>
        <span v-if="company.owner" class="sapling-crm-account-card__owner">
          <v-icon icon="mdi-account-tie-outline" size="14" />
          {{ company.owner }}
        </span>
        <span class="sapling-crm-account-card__footer">
          <span class="sapling-crm-account-card__badge">{{ company.badge }}</span>
          <strong>{{ company.value }}</strong>
        </span>
      </button>
    </div>

    <SaplingCrmWorkspaceList
      :title="listTitle"
      :items="contactGapItems"
      empty-icon="mdi-account-check-outline"
      :empty-text="emptyText"
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
  companyCount: number
  topAccounts: CrmWorkspaceItem[]
  contactGapItems: CrmWorkspaceItem[]
  listTitle: string
  emptyText: string
}>()

const emit = defineEmits<{
  openItem: [item: CrmWorkspaceItem]
}>()
</script>
