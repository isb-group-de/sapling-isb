<template>
  <SaplingDialog :model-value="true" size="sm" persistent @keydown.esc.stop.prevent="cancel">
    <SaplingDialogCard :close="cancel" :close-disabled="working">
      <SaplingDialogShell>
        <template #hero>
          <SaplingDialogHero :title="$t('account.profileCropTitle')" :subtitle="subtitle" />
        </template>
        <template #body>
          <div class="sapling-profile-crop">
            <p :id="hintId">{{ $t('account.profileCropHint') }}</p>
            <v-progress-linear
              v-if="loading"
              indeterminate
              :aria-label="$t('account.profileCropTitle')"
            />
            <v-alert v-if="error || uploadError" type="error" variant="tonal" role="alert">
              {{ $t(error || uploadError) }}
            </v-alert>
            <div
              v-show="!loading && crop"
              class="sapling-profile-crop__frame"
              :class="{ 'sapling-profile-crop__frame--dragging': dragging }"
            >
              <canvas
                ref="canvas"
                width="512"
                height="512"
                tabindex="0"
                role="img"
                :aria-label="$t('account.profileCropTitle')"
                :aria-describedby="hintId"
                @pointerdown="!working && pointerDown($event)"
                @pointermove="!working && pointerMove($event)"
                @pointerup="pointerEnd"
                @pointercancel="pointerEnd"
                @lostpointercapture="pointerEnd"
                @keydown="!working && keyDown($event)"
              />
            </div>
            <v-slider
              v-model="zoom"
              :min="1"
              :max="4"
              :step="0.05"
              hide-details
              :disabled="loading || working || !crop"
              :label="$t('account.profileCropZoom')"
              :aria-label="$t('account.profileCropZoom')"
            />
            <p class="text-body-2 text-medium-emphasis">
              {{ $t('account.profileCropOutputHint') }}
            </p>
            <v-btn v-if="total > 1" variant="text" :disabled="working" @click="emit('skip')">
              {{ $t('account.profileCropSkip') }}
            </v-btn>
          </div>
        </template>
        <template #actions>
          <SaplingActionSave
            :cancel="cancel"
            :save="save"
            :reset="reset"
            :reset-label="$t('account.profileCropReset')"
            :reset-disabled="loading || !crop"
            :save-disabled="loading || !crop || disabled"
            :busy="working"
            :save-loading="working"
          />
        </template>
      </SaplingDialogShell>
    </SaplingDialogCard>
  </SaplingDialog>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingDialogShell from '@/components/common/SaplingDialogShell.vue'
import SaplingDialogHero from '@/components/common/SaplingDialogHero.vue'
import SaplingActionSave from '@/components/actions/SaplingActionSave.vue'
import { useProfilePictureCrop } from '@/composables/account/useProfilePictureCrop'

const props = defineProps<{
  file: File
  position: number
  total: number
  busy: boolean
  disabled: boolean
  uploadError: string
}>()
const emit = defineEmits<{ cancel: []; skip: []; save: [file: File] }>()
const hintId = useId()
const {
  canvas,
  loading,
  exporting,
  error,
  zoom,
  dragging,
  crop,
  reset,
  pointerDown,
  pointerMove,
  pointerEnd,
  keyDown,
  exportFile,
} = useProfilePictureCrop(props.file)
const working = computed(() => props.busy || exporting.value)
const subtitle = computed(() =>
  props.total > 1 ? `${props.position} / ${props.total} · ${props.file.name}` : props.file.name,
)
function cancel() {
  if (!working.value) emit('cancel')
}
async function save() {
  if (working.value || props.disabled) return
  const file = await exportFile()
  if (file) emit('save', file)
}
</script>
