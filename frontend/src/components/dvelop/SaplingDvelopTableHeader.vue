<template>
  <div class="sapling-section-header">
    <div>
      <span class="sapling-label">{{ $t(labelKey) }}</span>
      <h2 class="sapling-section-title">{{ $t(titleKey) }}</h2>
    </div>
    <v-btn
      icon="mdi-table"
      size="small"
      variant="text"
      :title="$t(openLabelKey)"
      :aria-label="$t(openLabelKey)"
      @click="$emit('open')"
    />
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  labelKey: string
  titleKey: string
  openLabelKey: string
}>()

defineEmits<{ open: [] }>()
</script>
