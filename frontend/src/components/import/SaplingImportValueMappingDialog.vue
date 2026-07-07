<template>
  <v-dialog v-model="visibleModel" class="sapling-dialog-large" max-width="960">
    <SaplingDialogCard
      v-if="valueMapping && field"
      class="sapling-import__value-mapping-dialog"
      :tilt="false"
      :close="() => emit('close')"
    >
      <SaplingDialogShell
        body-class="sapling-dialog-fill-body sapling-import__value-mapping-body"
        :show-divider="false"
      >
        <template #hero>
          <SaplingDialogHero :eyebrow="t('import.valueMapping')" :title="fieldLabel(field.name)" />
        </template>

        <template #body>
          <div class="sapling-dialog-fill-content sapling-stack-md">
            <v-select
              :model-value="valueMapping.fallback"
              :items="valueMappingFallbackOptions"
              item-title="title"
              item-value="value"
              density="comfortable"
              prepend-inner-icon="mdi-call-split"
              :label="t('import.valueMappingFallback')"
              autocomplete="off"
              hide-details
              @update:model-value="updateFallback"
            />

            <div
              v-if="sourceValues.length > 0"
              class="sapling-import__value-mapping-table-region sapling-scrollable"
            >
              <v-table
                density="compact"
                class="sapling-import__table sapling-import__value-mapping-table"
              >
                <thead>
                  <tr>
                    <th>{{ t('import.sourceValue') }}</th>
                    <th>{{ t('import.targetValue') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="sourceValue in sourceValues" :key="sourceValue">
                    <td>{{ sourceValue }}</td>
                    <td>
                      <SaplingImportTemplateValueField
                        :model-value="valueMapping.values[sourceValue]"
                        :template="field"
                        :entity-handle="selectedEntityHandle ?? ''"
                        :visible-templates="visibleTemplates"
                        :permissions="permissions"
                        :reference-items="referenceItems"
                        @update:model-value="updateMappedValue(sourceValue, $event)"
                      />
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </div>

            <p v-else class="sapling-muted-text">
              {{ t('import.valueMappingNoValues') }}
            </p>
          </div>
        </template>

        <template #actions>
          <SaplingActionBar>
            <template #leading>
              <v-btn variant="text" prepend-icon="mdi-delete-outline" @click="emit('clear')">
                {{ t('import.clearValueMapping') }}
              </v-btn>
            </template>

            <template #trailing>
              <v-btn color="primary" variant="flat" prepend-icon="mdi-close" @click="emit('close')">
                {{ t('global.close') }}
              </v-btn>
            </template>
          </SaplingActionBar>
        </template>
      </SaplingDialogShell>
    </SaplingDialogCard>
  </v-dialog>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingImportTemplateValueField from '@/components/import/SaplingImportTemplateValueField.vue'
import SaplingActionBar from '@/components/actions/SaplingActionBar.vue'
import SaplingDialogHero from '@/components/common/SaplingDialogHero.vue'
import SaplingDialogShell from '@/components/common/SaplingDialogShell.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import type { ImportValueMappingFallback } from '@/services/api.import.service'
import type { SaplingGenericItem } from '@/entity/entity'
import type { AccumulatedPermission, EntityTemplate } from '@/entity/structure'

type ValueMappingState = {
  targetField: string
  values: Record<string, unknown>
  fallback: ImportValueMappingFallback
}

const props = defineProps<{
  visible: boolean
  valueMapping: ValueMappingState | null
  field: EntityTemplate | undefined
  sourceValues: string[]
  selectedEntityHandle: string | null
  visibleTemplates: EntityTemplate[]
  permissions: AccumulatedPermission[]
  referenceItems: Record<string, SaplingGenericItem | null | undefined>
  fieldLabel: (fieldName: string) => string
}>()

const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void
  (event: 'clear'): void
  (event: 'close'): void
  (event: 'updateFallback', value: ImportValueMappingFallback): void
  (event: 'updateMappedValue', sourceValue: string, value: unknown): void
}>()

const { t } = useI18n()

const visibleModel = computed({
  get: () => props.visible,
  set: (value: boolean) => {
    emit('update:visible', value)
    if (!value) {
      emit('close')
    }
  },
})

const valueMappingFallbackOptions = computed(() => [
  { title: t('import.valueMappingFallback.keep'), value: 'keep' },
  { title: t('import.valueMappingFallback.empty'), value: 'empty' },
  { title: t('import.valueMappingFallback.error'), value: 'error' },
])

function updateFallback(value: unknown): void {
  emit(
    'updateFallback',
    value === 'empty' || value === 'error' || value === 'keep' ? value : 'keep',
  )
}

function updateMappedValue(sourceValue: string, value: unknown): void {
  emit('updateMappedValue', sourceValue, value)
}
</script>

<style scoped>
.sapling-import__value-mapping-dialog {
  max-height: calc(100dvh - 48px);
}

.sapling-import__value-mapping-body {
  overflow: hidden;
}

.sapling-import__value-mapping-table-region {
  border: 1px solid rgba(var(--v-border-color), 0.18);
  border-radius: 8px;
  max-height: min(52vh, 560px);
}

.sapling-import__value-mapping-table {
  background: transparent;
}

.sapling-import__value-mapping-table :deep(.v-table__wrapper) {
  overflow: visible;
}

.sapling-import__value-mapping-table :deep(thead th) {
  position: sticky;
  top: 0;
  z-index: 1;
}

.sapling-import__value-mapping-table :deep(td:first-child) {
  max-width: 0;
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  .sapling-import__value-mapping-dialog {
    max-height: calc(100dvh - 24px);
  }

  .sapling-import__value-mapping-table-region {
    max-height: 46vh;
  }
}
</style>
