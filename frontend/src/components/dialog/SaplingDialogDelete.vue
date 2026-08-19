<template>
  <!-- Confirmation dialog for deleting an entity record -->
  <SaplingDialogConfirm
    :model-value="modelValue"
    variant="danger"
    :loading="isTranslationLoading || isImpactLoading"
    :eyebrow="isCancelAction ? $t('global.cancelSyncedEvent') : $t('global.confirmDelete')"
    :title="isCancelAction ? $t('global.cancelSyncedEvent') : $t('global.confirmDelete')"
    :subtitle="
      isCancelAction ? $t('global.cancelSyncedEventQuestion') : $t('global.confirmDeleteQuestion')
    "
    :tilt="tilt"
    card-class="sapling-dialog-delete-card"
    persistent
    @update:model-value="handleDialogUpdate"
    @enter="handleConfirm"
    @escape="handleCancel"
  >
    <template v-if="isCancelAction || hasReferenceOptions" #body>
      <v-alert
        v-if="isCancelAction"
        type="info"
        variant="tonal"
        icon="mdi-calendar-remove"
        :text="$t('global.cancelSyncedEventDescription')"
      />

      <div v-else class="sapling-delete-reference-panel">
        <p class="sapling-delete-reference-copy">
          {{ $t('global.deleteReferencesDescription') }}
        </p>

        <div class="sapling-delete-reference-toolbar">
          <span class="text-subtitle-2">{{ $t('global.selectDeleteReferences') }}</span>
          <div class="sapling-delete-reference-toolbar__actions">
            <v-btn
              size="small"
              variant="text"
              prepend-icon="mdi-checkbox-multiple-marked-outline"
              :disabled="allReferencesSelected"
              @click="selectAllReferences"
            >
              {{ $t('global.selectAll') }}
            </v-btn>
            <v-btn
              size="small"
              variant="text"
              prepend-icon="mdi-checkbox-multiple-blank-outline"
              :disabled="selectedReferenceNames.length === 0"
              @click="clearReferenceSelection"
            >
              {{ $t('global.selectNone') }}
            </v-btn>
          </div>
        </div>

        <div
          class="sapling-delete-reference-list sapling-scrollable"
          role="group"
          :aria-label="$t('global.selectDeleteReferences')"
        >
          <v-checkbox
            v-for="reference in referenceOptions"
            :key="reference.name"
            v-model="selectedReferenceNames"
            :value="reference.name"
            :label="$t(`${entityHandle}.${reference.name}`)"
            color="error"
            density="compact"
            hide-details
          />
        </div>
      </div>
    </template>

    <template #actions>
      <SaplingActionBar>
        <template #leading>
          <v-btn variant="text" prepend-icon="mdi-close" @click="handleCancel">
            {{ $t('global.cancel') }}
          </v-btn>
        </template>

        <template #trailing>
          <v-btn
            color="error"
            :append-icon="isCancelAction ? 'mdi-calendar-remove' : 'mdi-delete'"
            @click="handleConfirm"
          >
            {{ isCancelAction ? $t('global.cancelEvent') : $t('global.delete') }}
          </v-btn>
        </template>
      </SaplingActionBar>
    </template>
  </SaplingDialogConfirm>
</template>

<script lang="ts" setup>
// #region Imports
import { computed, toRef } from 'vue'
import { useSaplingDialogDelete } from '@/composables/dialog/useSaplingDialogDelete'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import type { SaplingGenericItem } from '@/entity/entity'
import SaplingActionBar from '@/components/actions/SaplingActionBar.vue'
import SaplingDialogConfirm from '@/components/dialog/SaplingDialogConfirm.vue'
// #endregion

// #region Props & Emits
const props = defineProps<{
  modelValue: boolean
  item: unknown | null
  entityHandle?: string
  tilt?: boolean
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'confirm', value: { cascadeRelations: string[] }): void
  (event: 'cancel'): void
}>()
// #endregion

// #region Composable
const { isLoading: isTranslationLoading } = useTranslationLoader('global')
const deleteItem = computed(() => props.item as SaplingGenericItem | SaplingGenericItem[] | null)
const {
  allReferencesSelected,
  clearReferenceSelection,
  handleCancel,
  handleConfirm,
  handleDialogUpdate,
  hasReferenceOptions,
  isCancelAction,
  isImpactLoading,
  referenceOptions,
  selectAllReferences,
  selectedReferenceNames,
} = useSaplingDialogDelete(
  {
    modelValue: toRef(props, 'modelValue'),
    item: deleteItem,
    entityHandle: toRef(props, 'entityHandle'),
  },
  emit,
)
// #endregion
</script>

<style scoped>
.sapling-delete-reference-panel {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--sapling-gap-md);
  min-height: 0;
}

.sapling-delete-reference-copy {
  flex: 0 0 auto;
  margin: 0;
  color: rgba(var(--v-theme-on-surface), var(--sapling-opacity-primary));
  line-height: 1.55;
}

.sapling-delete-reference-toolbar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: var(--sapling-gap-md);
}

.sapling-delete-reference-toolbar__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--sapling-gap-xs);
}

.sapling-delete-reference-list {
  display: grid;
  flex: 1 1 auto;
  align-content: start;
  gap: 0.25rem;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: var(--sapling-space-2xs);
  scrollbar-gutter: stable;
}

@media (max-width: 600px) {
  .sapling-delete-reference-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .sapling-delete-reference-toolbar__actions {
    justify-content: flex-start;
  }
}
</style>
