<template>
  <SaplingDialog
    :model-value="modelValue"
    size="sm"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <SaplingDialogCard class="sapling-dialog-compact-card" :close="onCancel">
      <div class="sapling-dialog-shell">
        <SaplingDialogHero
          :eyebrow="$t('global.add')"
          :title="$t('navigation.favorite')"
          :subtitle="title || $t('favorite.title')"
        />

        <div class="sapling-dialog-form-body">
          <v-form ref="favoriteFormRef" class="sapling-dialog-form">
            <SaplingTextField
              :model-value="title"
              :label="$t('favorite.title') + '*'"
              :rules="titleRules"
              required
              @update:model-value="emit('update:title', String($event ?? ''))"
            />
          </v-form>
        </div>

        <SaplingActionSave :cancel="onCancel" :save="onSave" />
      </div>
    </SaplingDialogCard>
  </SaplingDialog>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingTextField from '@/components/common/SaplingTextField.vue'
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import SaplingActionSave from '@/components/actions/SaplingActionSave.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingDialogHero from '@/components/common/SaplingDialogHero.vue'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'

type FavoriteFormRef = {
  validate?: () => Promise<boolean | { valid: boolean }>
}

defineProps<{
  modelValue: boolean
  title: string
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'update:title', value: string): void
  (event: 'save'): void
  (event: 'cancel'): void
}>()

const { t } = useI18n()
useTranslationLoader('favorite')
const favoriteFormRef = ref<FavoriteFormRef | null>(null)

const titleRules = computed(() => [
  (value: unknown) =>
    !!String(value ?? '').trim() || `${t('favorite.title')} ${t('global.isRequired')}`,
])

async function onSave() {
  const validationResult = await favoriteFormRef.value?.validate?.()
  const isValid =
    typeof validationResult === 'boolean' ? validationResult : (validationResult?.valid ?? true)

  if (!isValid) {
    return
  }

  emit('save')
}

function onCancel() {
  emit('cancel')
}
</script>
