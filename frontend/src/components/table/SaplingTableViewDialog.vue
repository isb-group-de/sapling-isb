<template>
  <v-dialog
    :model-value="modelValue"
    :max-width="SAPLING_DIALOG_MAX_WIDTH.sm"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <SaplingDialogCard class="sapling-dialog-compact-card" :close="onCancel">
      <div class="sapling-dialog-shell">
        <SaplingDialogHero
          :eyebrow="$t('formConfig.currentView')"
          :title="$t('formConfig.saveCurrentView')"
          :subtitle="$t('formConfig.saveCurrentViewDescription')"
        />

        <div class="sapling-dialog-form-body">
          <v-form ref="formRef" class="sapling-dialog-form" @submit.prevent="onSave">
            <v-text-field
              :model-value="name"
              :label="$t('formConfig.viewName') + '*'"
              :rules="nameRules"
              autofocus
              required
              @update:model-value="emit('update:name', String($event ?? ''))"
            />
          </v-form>
        </div>

        <SaplingActionSave
          :cancel="onCancel"
          :save="onSave"
          :save-loading="loading"
          :busy="loading"
        />
      </div>
    </SaplingDialogCard>
  </v-dialog>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingActionSave from '@/components/actions/SaplingActionSave.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingDialogHero from '@/components/common/SaplingDialogHero.vue'
import { SAPLING_DIALOG_MAX_WIDTH } from '@/constants/dialog.constants'

type FormRef = {
  validate?: () => Promise<boolean | { valid: boolean }>
}

defineProps<{
  modelValue: boolean
  name: string
  loading?: boolean
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'update:name', value: string): void
  (event: 'save'): void
  (event: 'cancel'): void
}>()

const { t } = useI18n()
const formRef = ref<FormRef | null>(null)
const nameRules = computed(() => [
  (value: unknown) =>
    Boolean(String(value ?? '').trim()) || `${t('formConfig.viewName')} ${t('global.isRequired')}`,
])

async function onSave(): Promise<void> {
  const validationResult = await formRef.value?.validate?.()
  const isValid =
    typeof validationResult === 'boolean' ? validationResult : (validationResult?.valid ?? true)
  if (isValid) emit('save')
}

function onCancel(): void {
  emit('cancel')
}
</script>
