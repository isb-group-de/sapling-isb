<template>
  <section class="sapling-crm-workspace-panel sapling-crm-workspace-panel--compact glass-panel">
    <header class="sapling-crm-workspace-panel__header">
      <div>
        <p class="sapling-eyebrow">{{ eyebrow }}</p>
        <h2>{{ title }}</h2>
      </div>
    </header>

    <div class="sapling-crm-signal-list">
      <button
        v-for="signal in signals"
        :key="signal.key"
        class="sapling-crm-signal"
        type="button"
        @click="emit('open', signal)"
      >
        <v-icon :icon="signal.icon" size="18" />
        <span>{{ signal.label }}</span>
        <strong>{{ signal.value }}</strong>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CrmSignal } from './crmWorkspace.types'

defineProps<{
  eyebrow: string
  title: string
  signals: CrmSignal[]
}>()

const emit = defineEmits<{
  open: [signal: CrmSignal]
}>()
</script>
