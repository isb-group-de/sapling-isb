<template>
  <v-alert
    v-if="isRunning"
    type="info"
    variant="tonal"
    density="comfortable"
    class="sapling-import__job-status"
  >
    <div class="sapling-import__job-status-content">
      <div class="sapling-import__job-status-header">
        <strong>{{ statusLabel }}</strong>
        <span>{{ progressLabel }}</span>
      </div>
      <v-progress-linear
        class="sapling-import__job-progress"
        :model-value="progressPercent"
        height="8"
        rounded
        color="primary"
      />
    </div>
  </v-alert>
</template>

<script lang="ts" setup>
defineProps<{
  isRunning: boolean
  statusLabel: string
  progressLabel: string
  progressPercent: number
}>()
</script>
