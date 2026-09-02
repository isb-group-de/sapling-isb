<template>
  <SaplingDialogConfirm
    :model-value="modelValue"
    variant="danger"
    size="small"
    :loading="loading"
    :close-disabled="loading"
    :eyebrow="$t('global.confirmDelete')"
    :title="$t('global.confirmDelete')"
    :subtitle="question"
    @update:model-value="emit('update:modelValue', $event)"
    @enter="emit('confirm')"
    @escape="emit('cancel')"
  >
    <template #actions>
      <SaplingActionBar>
        <template #leading>
          <v-btn
            variant="text"
            prepend-icon="mdi-close"
            :disabled="loading"
            @click="emit('cancel')"
          >
            {{ $t('global.cancel') }}
          </v-btn>
        </template>
        <template #trailing>
          <v-btn
            color="error"
            append-icon="mdi-delete"
            :loading="loading"
            :disabled="loading"
            @click="emit('confirm')"
          >
            {{ $t('global.delete') }}
          </v-btn>
        </template>
      </SaplingActionBar>
    </template>
  </SaplingDialogConfirm>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingActionBar from '@/components/actions/SaplingActionBar.vue'
import SaplingDialogConfirm from '@/components/dialog/SaplingDialogConfirm.vue'

const props = defineProps<{
  modelValue: boolean
  kind: 'favorite' | 'view'
  itemTitle: string
  loading?: boolean
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'confirm'): void
  (event: 'cancel'): void
}>()

const { t } = useI18n()
const question = computed(() =>
  t(props.kind === 'favorite' ? 'global.deleteFavoriteQuestion' : 'formConfig.deleteViewQuestion', {
    name: props.itemTitle,
  }),
)
</script>
