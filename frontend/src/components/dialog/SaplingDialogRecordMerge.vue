<template>
  <SaplingDialogConfirm
    :model-value="modelValue"
    size="large"
    :tilt="false"
    card-class="sapling-update-conflict-dialog sapling-record-merge-dialog sapling-dialog-card--fullscreen"
    :loading="isTranslationLoading"
    :title="t('recordMerge.title')"
    :eyebrow="t('recordMerge.eyebrow')"
    persistent
    :close-disabled="saving"
    @update:model-value="close"
    @escape="close"
  >
    <template #body>
      <div class="sapling-update-conflict" @keydown.enter.stop>
        <p class="sapling-update-conflict__summary">{{ t('recordMerge.summary') }}</p>
        <div class="sapling-update-conflict__values">
          <SaplingFieldSingleSelect
            v-model="loser"
            :entity-handle="entityHandle"
            :label="t('recordMerge.loser')"
            :disabled="saving || loading"
            :parent-filter="winner?.handle == null ? {} : { handle: { $ne: winner.handle } }"
          />
          <SaplingFieldSingleSelect
            v-model="winner"
            :entity-handle="entityHandle"
            :label="t('recordMerge.winner')"
            :disabled="saving || loading"
            :parent-filter="loser?.handle == null ? {} : { handle: { $ne: loser.handle } }"
          />
        </div>
        <SaplingActionBar>
          <template #leading>
            <v-btn
              variant="text"
              prepend-icon="mdi-swap-horizontal"
              :disabled="!pair || saving || loading"
              @click="swap"
              >{{ t('recordMerge.swap') }}</v-btn
            >
          </template>
          <template #trailing>
            <v-btn
              variant="tonal"
              prepend-icon="mdi-compare-horizontal"
              :loading="loading"
              :disabled="!pair || saving"
              @click="loadPreview"
              >{{ t('recordMerge.compare') }}</v-btn
            >
          </template>
        </SaplingActionBar>
        <template v-if="preview">
          <v-alert class="sapling-record-merge__notice" type="warning" variant="tonal">{{
            t('recordMerge.deleteNotice')
          }}</v-alert>
          <div class="sapling-update-conflict__fields">
            <SaplingMergeFieldChoice
              v-for="field in preview.fields"
              :key="field.property"
              :model-value="selections[field.property] ?? field.selectedSource"
              :entity-handle="entityHandle"
              :label="propertyLabel(field)"
              :template="field.template"
              left-source="loser"
              right-source="winner"
              :left-label="t('recordMerge.loser')"
              :right-label="t('recordMerge.winner')"
              :left-value="field.loserValue"
              :right-value="field.winnerValue"
              :left-payload="preview.loser"
              :right-payload="preview.winner"
              :disabled="saving || !field.selectable"
              @update:model-value="selectSource(field, $event)"
            >
              <template v-if="!field.selectable" #status>
                <v-chip size="small" prepend-icon="mdi-lock-outline">{{
                  t('recordMerge.keptFromWinner')
                }}</v-chip>
              </template>
            </SaplingMergeFieldChoice>
          </div>
        </template>
      </div>
    </template>
    <template #actions>
      <SaplingActionBar @keydown.enter.stop>
        <template #leading>
          <v-btn variant="text" prepend-icon="mdi-close" :disabled="saving" @click="close">{{
            t('global.cancel')
          }}</v-btn>
        </template>
        <template #trailing>
          <v-btn
            color="primary"
            class="sapling-record-merge__submit"
            :loading="saving"
            :disabled="!preview || loading || saving"
            @click="merge"
            >{{ t('recordMerge.mergeAndDelete') }}</v-btn
          >
        </template>
      </SaplingActionBar>
    </template>
  </SaplingDialogConfirm>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { SaplingGenericItem } from '@/entity/entity'
import type { RecordMergeField, RecordMergeResult } from '@/services/api.merge.service'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import { useSaplingRecordMerge } from '@/composables/dialog/useSaplingRecordMerge'
import SaplingActionBar from '@/components/actions/SaplingActionBar.vue'
import SaplingDialogConfirm from '@/components/dialog/SaplingDialogConfirm.vue'
import SaplingFieldSingleSelect from '@/components/dialog/fields/SaplingFieldSingleSelect.vue'
import SaplingMergeFieldChoice from '@/components/dialog/SaplingMergeFieldChoice.vue'

const props = defineProps<{
  modelValue: boolean
  entityHandle: string
  item: SaplingGenericItem | null
}>()
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'merged', result: RecordMergeResult): void
}>()
const { t, te } = useI18n()
const { isLoading: isTranslationLoading } = useTranslationLoader('global', 'recordMerge')
const { loser, winner, pair, preview, selections, loading, saving, swap, loadPreview, merge } =
  useSaplingRecordMerge(props, (result) => {
    emit('merged', result)
    emit('update:modelValue', false)
  })

function close() {
  if (!saving.value) emit('update:modelValue', false)
}
function propertyLabel(field: RecordMergeField): string {
  if (field.template.formConfig?.label) return field.template.formConfig.label
  const key = `${props.entityHandle}.${field.property}`
  return te(key)
    ? t(key)
    : te(`global.${field.property}`)
      ? t(`global.${field.property}`)
      : field.property
}
function selectSource(field: RecordMergeField, source: string) {
  if (field.selectable && (source === 'loser' || source === 'winner'))
    selections.value[field.property] = source
}
</script>
