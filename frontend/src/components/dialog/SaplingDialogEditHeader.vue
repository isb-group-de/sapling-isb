<template>
  <v-card-title class="sapling-record-dialog-header sapling-dialog-edit-header">
    <SaplingDialogEditHero :loading="loading" :eyebrow="eyebrow" :title="title">
      <template #timestamps>
        <v-chip
          v-if="createdAtLabel"
          class="sapling-dialog-edit-hero__metadata-chip sapling-dialog-edit-hero__metadata-chip--timestamp"
          size="small"
          color="primary"
          variant="tonal"
          prepend-icon="mdi-calendar-plus-outline"
          :aria-label="`${createdAtTitle}: ${createdAtLabel}`"
          :title="`${createdAtTitle}: ${createdAtLabel}`"
        >
          <span class="sapling-dialog-edit-hero__metadata-label">{{ createdAtTitle }}:</span>
          <span>{{ createdAtLabel }}</span>
        </v-chip>
        <v-chip
          v-if="updatedAtLabel"
          class="sapling-dialog-edit-hero__metadata-chip sapling-dialog-edit-hero__metadata-chip--timestamp"
          size="small"
          color="primary"
          variant="tonal"
          prepend-icon="mdi-calendar-edit-outline"
          :aria-label="`${updatedAtTitle}: ${updatedAtLabel}`"
          :title="`${updatedAtTitle}: ${updatedAtLabel}`"
        >
          <span class="sapling-dialog-edit-hero__metadata-label">{{ updatedAtTitle }}:</span>
          <span>{{ updatedAtLabel }}</span>
        </v-chip>
        <v-chip
          v-if="selectedFormConfigChipLabel"
          class="sapling-dialog-edit-hero__metadata-chip sapling-dialog-edit-hero__metadata-chip--view"
          size="small"
          color="primary"
          variant="tonal"
          prepend-icon="mdi-table-cog"
          :aria-label="selectedFormConfigChipLabel"
          :title="selectedFormConfigChipLabel"
        >
          <span class="sapling-dialog-edit-hero__metadata-view-label">
            {{ selectedFormConfigChipLabel }}
          </span>
        </v-chip>
        <v-chip
          v-if="dirtyChangeCount > 0 && mode !== 'readonly'"
          class="sapling-dialog-edit-hero__metadata-chip sapling-dialog-edit-hero__metadata-chip--dirty"
          size="small"
          color="warning"
          variant="tonal"
          prepend-icon="mdi-pencil"
          :aria-label="dirtySummaryLabel"
          :title="dirtySummaryLabel"
        >
          <span class="sapling-dialog-edit-hero__metadata-dirty-label">
            {{ dirtySummaryLabel }}
          </span>
          <span class="sapling-dialog-edit-hero__metadata-dirty-count">{{ dirtyChangeCount }}</span>
        </v-chip>
      </template>

      <template #actions>
        <v-btn
          v-if="canOpenFormConfigEditor && !isSmallViewport"
          size="small"
          color="primary"
          variant="tonal"
          prepend-icon="mdi-table-cog"
          :aria-label="$t('formConfig.openForEntity')"
          :title="$t('formConfig.openForEntity')"
          @click="emit('open-form-config')"
        >
          {{ $t('formConfig.configure') }}
        </v-btn>
      </template>
    </SaplingDialogEditHero>
  </v-card-title>
</template>

<script lang="ts" setup>
import SaplingDialogEditHero from '@/components/common/SaplingDialogEditHero.vue'
import type { DialogState } from '@/entity/structure'

defineProps<{
  loading: boolean
  eyebrow: string
  title: string
  createdAtTitle: string
  createdAtLabel: string
  updatedAtTitle: string
  updatedAtLabel: string
  selectedFormConfigChipLabel: string
  dirtyChangeCount: number
  dirtySummaryLabel: string
  mode: DialogState
  canOpenFormConfigEditor: boolean
  isSmallViewport: boolean
}>()

const emit = defineEmits<{
  (event: 'open-form-config'): void
}>()
</script>
