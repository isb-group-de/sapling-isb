<template>
  <button
    type="button"
    class="sapling-metric-card sapling-inbox-summary-card"
    :class="{ 'sapling-inbox-summary-card--active': active, 'glass-panel': !active }"
    :aria-pressed="active"
    @click="$emit('select', card.key)"
  >
    <div
      class="sapling-icon-tile"
      :class="[
        `sapling-icon-tile--${card.tone}-soft`,
        `sapling-inbox-summary-card__icon--${card.tone}`,
      ]"
    >
      <v-icon :icon="card.icon" />
    </div>
    <div class="sapling-metric-card__copy">
      <p>{{ $t(card.labelKey) }}</p>
      <strong>{{ card.count }}</strong>
    </div>
    <v-icon
      v-if="active"
      class="sapling-inbox-summary-card__selected"
      icon="mdi-check-circle"
      aria-hidden="true"
    />
  </button>
</template>

<script setup lang="ts">
import type { InboxSummaryCard } from '@/composables/account/useSaplingInbox'

defineProps<{
  card: InboxSummaryCard
  active?: boolean
}>()

defineEmits<{ select: [key: InboxSummaryCard['key']] }>()
</script>
