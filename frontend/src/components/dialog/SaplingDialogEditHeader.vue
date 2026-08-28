<template>
  <v-card-title class="sapling-record-dialog-header sapling-dialog-edit-header">
    <SaplingDialogEditHero :loading="loading" :eyebrow="eyebrow" :title="title">
      <template #timestamps>
        <v-chip
          v-if="createdAtLabel"
          size="small"
          color="primary"
          variant="tonal"
          prepend-icon="mdi-calendar-plus-outline"
        >
          {{ createdAtTitle }}: {{ createdAtLabel }}
        </v-chip>
        <v-chip
          v-if="updatedAtLabel"
          size="small"
          color="primary"
          variant="tonal"
          prepend-icon="mdi-calendar-edit-outline"
        >
          {{ updatedAtTitle }}: {{ updatedAtLabel }}
        </v-chip>
        <v-chip
          v-if="selectedFormConfigChipLabel"
          size="small"
          color="primary"
          variant="tonal"
          prepend-icon="mdi-table-cog"
        >
          {{ selectedFormConfigChipLabel }}
        </v-chip>
        <v-chip
          v-if="dirtyChangeCount > 0 && mode !== 'readonly'"
          size="small"
          color="warning"
          variant="tonal"
          prepend-icon="mdi-pencil"
        >
          {{ dirtySummaryLabel }}
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
