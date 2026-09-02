<template>
  <div v-if="items.length" class="customer360__list">
    <button
      v-for="item in items"
      :key="`${item.entityHandle}:${item.recordHandle}`"
      class="sapling-panel-shell-muted customer360__list-item"
      type="button"
      @click="emit('open', item.entityHandle, item.recordHandle)"
    >
      <i :class="['mdi', activityIcon(item.kind)]" />
      <span>
        <strong>{{ item.title }}</strong>
        <small>
          {{ formatDate(item.occurredAt) }}
          <template v-if="item.participants.length"> · {{ item.participants.join(', ') }}</template>
        </small>
        <p v-if="item.summary">{{ item.summary }}</p>
      </span>
    </button>
  </div>
  <div
    v-else
    class="sapling-empty-state-panel sapling-empty-state-panel--compact customer360__empty"
  >
    {{ t('customer360.noEntries') }}
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type {
  Customer360ActivityItem,
  Customer360ActivityKind,
} from '@/services/api.customer360.service'

defineProps<{ items: Customer360ActivityItem[] }>()
const emit = defineEmits<{
  (event: 'open', entityHandle: string, recordHandle: string | number): void
}>()
const { t, d } = useI18n()

function formatDate(value: string): string {
  return d(new Date(value), 'short')
}

function activityIcon(kind: Customer360ActivityKind): string {
  return {
    emailInbound: 'mdi-email-receive-outline',
    emailOutbound: 'mdi-email-send-outline',
    call: 'mdi-phone-outline',
    appointment: 'mdi-calendar-outline',
    event: 'mdi-calendar-blank-outline',
  }[kind]
}
</script>
