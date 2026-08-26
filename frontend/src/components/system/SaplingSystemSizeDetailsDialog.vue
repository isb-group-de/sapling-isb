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

<style scoped>
.sapling-system-size-dialog {
  display: flex;
  min-height: 100%;
  flex-direction: column;
}

.sapling-system-size-dialog__list {
  display: grid;
  gap: var(--sapling-gap-sm);
  padding: var(--sapling-gap-md);
}

.sapling-system-size-dialog__row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--sapling-gap-md);
  padding: var(--sapling-gap-md);
}

.sapling-system-size-dialog__rank {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--sapling-radius-pill);
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
  font-size: var(--sapling-text-meta-size);
  font-weight: 700;
}

.sapling-system-size-dialog__copy {
  display: grid;
  min-width: 0;
  gap: var(--sapling-gap-sm);
}

.sapling-system-size-dialog__copy strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sapling-system-size-dialog__metrics {
  display: grid;
  min-width: 6rem;
  gap: var(--sapling-gap-xs);
  text-align: right;
}

.sapling-system-size-dialog__metrics span {
  opacity: var(--sapling-opacity-secondary);
}

@media (max-width: 640px) {
  .sapling-system-size-dialog__row {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .sapling-system-size-dialog__metrics {
    grid-column: 2;
    grid-template-columns: repeat(2, auto);
    justify-content: space-between;
    text-align: left;
  }
}
</style>
