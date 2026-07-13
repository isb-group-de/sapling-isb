<template>
  <div>
    <v-chip v-if="showChip" class="sapling-table-chip" :style="chipStyle" size="small">
      <v-icon v-if="hasChipIcon" size="small" class="mr-2">
        {{ chipIcon }}
      </v-icon>
      {{ chipLabel }}
    </v-chip>
    <v-skeleton-loader v-else-if="isLoading" type="chip" />
  </div>
</template>

<script lang="ts" setup>
import {
  useSaplingTableChip,
  type UseSaplingTableChipProps,
} from '@/composables/table/useSaplingTableChip'

const props = defineProps<UseSaplingTableChipProps>()

const { chipIcon, chipLabel, chipStyle, hasChipIcon, showChip, isLoading } =
  useSaplingTableChip(props)
</script>

<style scoped>
.sapling-table-chip {
  --sapling-soft-badge-background: color-mix(in srgb, rgb(var(--v-theme-primary)) 18%, transparent);
  --sapling-soft-badge-border: color-mix(in srgb, rgb(var(--v-theme-primary)) 36%, transparent);
  --sapling-soft-badge-foreground: rgba(var(--v-theme-on-surface), 0.88);

  background: var(--sapling-soft-badge-background) !important;
  border: 1px solid var(--sapling-soft-badge-border) !important;
  color: var(--sapling-soft-badge-foreground) !important;
  font-weight: 600;
}

.sapling-table-chip :deep(.v-chip__content),
.sapling-table-chip :deep(.v-icon) {
  color: inherit;
}
</style>
