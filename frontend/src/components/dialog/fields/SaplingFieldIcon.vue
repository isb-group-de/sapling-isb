<template>
  <div class="sapling-field-icon">
    <SaplingTextField
      data-testid="icon-picker-trigger"
      class="sapling-field-icon__input"
      :class="{ 'sapling-field-icon__input--disabled': isDisabled }"
      :model-value="modelValueProxy"
      :label="computedLabel"
      :disabled="isDisabled"
      :rules="rules"
      :aria-expanded="dialog"
      aria-haspopup="dialog"
      append-inner-icon="mdi-view-grid-outline"
      hide-details="auto"
      autocomplete="off"
      readonly
      @click="openDialog"
      @click:append-inner="openDialog"
      @keydown.enter.prevent="openDialog"
      @keydown.space.prevent="openDialog"
    >
      <template v-if="modelValueProxy" #prepend-inner>
        <v-icon size="20">{{ modelValueProxy }}</v-icon>
      </template>
    </SaplingTextField>

    <SaplingDialog v-if="dialog" v-model="dialog" size="md" @keydown.esc.stop="closeDialog">
      <SaplingDialogCard
        class="sapling-account-dialog sapling-field-icon__dialog"
        :close="closeDialog"
      >
        <SaplingDialogShell
          fill-shell
          body-class="sapling-account-dialog__body sapling-field-icon__body"
          :show-divider="false"
        >
          <template #hero>
            <SaplingDialogHero :eyebrow="t('global.select')" :title="computedLabel" />
          </template>

          <template #body>
            <div class="sapling-account-dialog__content sapling-field-icon__content">
              <SaplingTextField
                data-testid="icon-picker-search"
                class="sapling-field-icon__search"
                :model-value="searchQuery"
                :label="t('global.search')"
                prepend-inner-icon="mdi-magnify"
                density="compact"
                hide-details
                clearable
                autofocus
                @update:model-value="updateSearchQuery"
              />

              <div
                v-if="pagedItems.length"
                class="sapling-field-icon__grid"
                role="group"
                :aria-label="computedLabel"
              >
                <v-btn
                  v-for="icon in pagedItems"
                  :key="icon.name"
                  class="sapling-field-icon__option"
                  :class="{
                    'sapling-field-icon__option--selected': icon.name === modelValueProxy,
                  }"
                  :data-icon-name="icon.name"
                  :title="icon.name"
                  :aria-label="icon.name"
                  :aria-pressed="icon.name === modelValueProxy"
                  :color="icon.name === modelValueProxy ? 'primary' : undefined"
                  :variant="icon.name === modelValueProxy ? 'flat' : 'tonal'"
                  @click="selectIcon(icon.name)"
                >
                  <v-icon size="26">{{ icon.name }}</v-icon>
                </v-btn>
              </div>

              <div v-else class="sapling-inline-empty sapling-field-icon__empty" role="status">
                <v-icon size="24">mdi-magnify-close</v-icon>
                <span>{{ t('global.noData') }}</span>
              </div>

              <v-pagination
                v-if="pageCount > 1"
                v-model="page"
                class="sapling-field-icon__pagination"
                :length="pageCount"
                :total-visible="7"
                density="comfortable"
                rounded
              />
            </div>
          </template>

          <template #actions>
            <SaplingActionClose :close="closeDialog" />
          </template>
        </SaplingDialogShell>
      </SaplingDialogCard>
    </SaplingDialog>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SaplingActionClose from '@/components/actions/SaplingActionClose.vue'
import SaplingDialogHero from '@/components/common/SaplingDialogHero.vue'
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import SaplingDialogShell from '@/components/common/SaplingDialogShell.vue'
import SaplingTextField from '@/components/common/SaplingTextField.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import { useSaplingIconField } from '@/composables/fields/useSaplingIconField'

const props = defineProps<{
  items: { name: string }[]
  modelValue: string
  label: string
  disabled?: boolean
  rules?: Array<(value: string) => boolean | string>
  required?: boolean
}>()
const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const {
  closeDialog,
  computedLabel,
  dialog,
  isDisabled,
  modelValueProxy,
  openDialog,
  page,
  pageCount,
  pagedItems,
  searchQuery,
  selectIcon,
  updateSearchQuery,
} = useSaplingIconField(props, emit)
</script>
