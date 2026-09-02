<template>
  <SaplingDialog
    :model-value="modelValue"
    size="xl"
    :height="SAPLING_DIALOG_HEIGHT.xl"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <SaplingDialogCard class="sapling-dialog-card--fill" :tilt="false" :close="close">
      <SaplingDialogShell
        fill-shell
        body-class="sapling-dialog-fill-body sapling-system-size-dialog__body"
      >
        <template #hero>
          <SaplingDialogHero
            :eyebrow="eyebrow"
            :title="title"
            :stats="heroStats"
            :stats-columns="2"
            stats-layout="compact"
          />
        </template>

        <template #body>
          <div class="sapling-system-size-dialog">
            <v-skeleton-loader v-if="loading" type="list-item-three-line@8" />

            <div
              v-else-if="!error && items.length"
              class="sapling-system-size-dialog__list sapling-scrollable"
            >
              <article
                v-for="(item, index) in items"
                :key="item.key"
                class="sapling-system-size-dialog__row sapling-data-card"
              >
                <span class="sapling-system-size-dialog__rank">{{ index + 1 }}</span>
                <div class="sapling-system-size-dialog__copy">
                  <strong>{{ item.label }}</strong>
                  <v-progress-linear :model-value="item.share" color="primary" height="8" rounded />
                </div>
                <div class="sapling-system-size-dialog__metrics">
                  <strong>{{ item.sizeLabel }}</strong>
                  <span>{{ item.shareLabel }}</span>
                </div>
              </article>
            </div>

            <div v-else-if="!error" class="sapling-empty-state-panel">
              {{ emptyLabel }}
            </div>
          </div>
        </template>

        <template #actions>
          <SaplingActionClose :close="close" />
        </template>
      </SaplingDialogShell>
    </SaplingDialogCard>
  </SaplingDialog>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import SaplingActionClose from '@/components/actions/SaplingActionClose.vue'
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import SaplingDialogHero from '@/components/common/SaplingDialogHero.vue'
import SaplingDialogShell from '@/components/common/SaplingDialogShell.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import { SAPLING_DIALOG_HEIGHT } from '@/constants/dialog.constants'

const props = defineProps<{
  modelValue: boolean
  eyebrow: string
  title: string
  totalSizeLabel: string
  totalCountLabel: string
  totalSizeCaption: string
  totalCountCaption: string
  emptyLabel: string
  loading?: boolean
  error?: string
  items: Array<{
    key: string
    label: string
    sizeLabel: string
    share: number
    shareLabel: string
  }>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const heroStats = computed(() => [
  { label: props.totalSizeCaption, value: props.totalSizeLabel },
  { label: props.totalCountCaption, value: props.totalCountLabel },
])

function close() {
  emit('update:modelValue', false)
}
</script>
