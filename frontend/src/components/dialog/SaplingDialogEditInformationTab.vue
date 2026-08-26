<template>
  <div
    class="sapling-record-dialog-tab-scroll sapling-dialog-edit-tab-scroll sapling-dialog-edit-tab-scroll--information"
  >
    <section
      class="sapling-stack-lg sapling-section-panel sapling-record-supplemental-panel sapling-dialog-edit-information"
      :class="{ 'sapling-record-section--dirty': isDirty }"
    >
      <div class="sapling-row-between-md sapling-record-supplemental-panel__header">
        <div class="sapling-record-relation-summary">
          <div class="sapling-record-relation-summary__icon">
            <v-icon icon="mdi-text-box-edit-outline" size="22" />
          </div>
          <div class="sapling-record-relation-summary__copy">
            <span class="sapling-record-relation-summary__eyebrow">{{ entityLabel }}</span>
            <h3 class="sapling-record-relation-summary__title">
              {{ $t('navigation.information') }}
            </h3>
          </div>
        </div>

        <v-btn
          v-if="canEdit"
          color="primary"
          append-icon="mdi-content-save"
          :loading="isSaving"
          :disabled="!canSave"
          @click="save"
        >
          {{ $t('global.save') }}
        </v-btn>
      </div>

      <v-skeleton-loader
        v-if="isLoading || isTranslationLoading"
        elevation="12"
        type="article, actions"
      />

      <template v-else>
        <SaplingMarkdownField
          v-model="content"
          class="sapling-dialog-edit-information__field"
          :label="$t('information.content')"
          :rows="6"
          :disabled="!canEdit"
        />

        <div class="sapling-row-between-md sapling-dialog-edit-information__footer">
          <span class="sapling-dialog-edit-information__hint">
            {{ $t('information.hint') }}
          </span>
          <v-chip v-if="isDirty" color="warning" size="small" variant="tonal">
            {{ $t('global.unsavedChanges') }}
          </v-chip>
        </div>
      </template>
    </section>
  </div>
</template>

<script lang="ts" setup>
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SaplingGenericItem } from '@/entity/entity'
import SaplingMarkdownField from '@/components/dialog/fields/SaplingFieldMarkdown.vue'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import { useSaplingTableRowInformation } from '@/composables/table/useSaplingTableRowInformation'

const props = defineProps<{
  item: SaplingGenericItem | null
  entityHandle: string
}>()

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'saved'): void
  (event: 'update:dirty', value: boolean): void
}>()

const { t, te } = useI18n()
const { isLoading: isTranslationLoading } = useTranslationLoader('information', 'global')

const informationProps = {
  get show() {
    return true
  },
  get item() {
    return props.item
  },
  get entityHandle() {
    return props.entityHandle
  },
  get closeAfterSave() {
    return false
  },
}

const { content, isLoading, isSaving, isDirty, canEdit, canSave, discardChanges, save } =
  useSaplingTableRowInformation(informationProps, emit)

watch(isDirty, (dirty) => emit('update:dirty', dirty), { immediate: true })

defineExpose({ discardChanges, save })

const entityLabel = computed(() => {
  const key = `navigation.${props.entityHandle}`
  return te(key) ? t(key) : props.entityHandle
})
</script>
