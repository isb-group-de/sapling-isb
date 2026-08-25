<template>
  <!--
    Generic confirmation dialog shell. Wraps the standard glass panel layout, hero,
    optional body and a slot for action buttons. Used by SaplingDialogDelete,
    SaplingDialogUnsavedChanges and other lightweight confirmation prompts.
  -->
  <SaplingDialog
    :model-value="modelValue"
    :size="dialogSize"
    :persistent="persistent"
    @update:model-value="handleDialogUpdate"
    @keydown.esc.stop.prevent="handleEscape"
  >
    <SaplingDialogCard
      :tilt="tilt"
      :class="cardClass"
      :close="handleCloseButton"
      :close-disabled="closeDisabled"
    >
      <div class="sapling-dialog-shell" @keydown="onShellKeydown" tabindex="-1">
        <template v-if="loading">
          <SaplingDialogHero :variant="variant" loading />
          <SaplingActionBarSkeleton />
        </template>
        <template v-else>
          <SaplingDialogHero
            :variant="variant"
            :eyebrow="eyebrow"
            :title="title"
            :subtitle="subtitle"
          >
            <template v-if="$slots['hero-meta']" #meta>
              <slot name="hero-meta" />
            </template>
          </SaplingDialogHero>
          <v-card-text v-if="$slots.body" class="sapling-dialog__body">
            <slot name="body" />
          </v-card-text>
          <slot name="actions" />
        </template>
      </div>
    </SaplingDialogCard>
  </SaplingDialog>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingDialogHero from '@/components/common/SaplingDialogHero.vue'
import SaplingActionBarSkeleton from '@/components/actions/SaplingActionBarSkeleton.vue'
import type { SaplingDialogSize } from '@/constants/dialog.constants'

type SaplingDialogConfirmSize = SaplingDialogSize | 'small' | 'medium' | 'large'

// #region Props & Emits
const props = withDefaults(
  defineProps<{
    modelValue: boolean
    eyebrow?: string
    title?: string
    subtitle?: string
    variant?: 'default' | 'danger'
    loading?: boolean
    persistent?: boolean
    tilt?: boolean
    size?: SaplingDialogConfirmSize
    cardClass?: string | string[] | Record<string, boolean>
    closeDisabled?: boolean
  }>(),
  {
    eyebrow: '',
    title: '',
    subtitle: '',
    variant: 'default',
    loading: false,
    persistent: true,
    tilt: false,
    size: 'medium',
    cardClass: '',
    closeDisabled: false,
  },
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'enter'): void
  (event: 'escape'): void
}>()
// #endregion

// #region Computed
const dialogSize = computed<SaplingDialogSize>(() => {
  if (props.size === 'small') return 'sm'
  if (props.size === 'large') return 'xl'
  if (props.size === 'medium') return 'md'
  return props.size
})
// #endregion

// #region Methods
function handleDialogUpdate(value: boolean): void {
  emit('update:modelValue', value)
}

function handleEscape(): void {
  if (props.closeDisabled) {
    return
  }

  emit('escape')
}

function handleCloseButton(): void {
  handleEscape()
}

/**
 * Forwards keyboard intents so consumers can wire Enter/Escape to their
 * primary and cancel actions without duplicating the listener boilerplate.
 */
function onShellKeydown(event: KeyboardEvent): void {
  if (event.repeat) {
    return
  }

  const target = event.target as HTMLElement | null
  const isEditable =
    target?.tagName === 'TEXTAREA' ||
    (target?.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'checkbox') ||
    target?.isContentEditable === true

  if (event.key === 'Enter' && !event.shiftKey && !event.altKey && !isEditable) {
    event.preventDefault()
    emit('enter')
    return
  }
}
// #endregion
</script>
