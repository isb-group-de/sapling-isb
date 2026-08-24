<template>
  <v-dialog
    v-model="model"
    class="sapling-dialog-frame"
    :class="`sapling-dialog-frame--${size}`"
    :max-width="SAPLING_DIALOG_MAX_WIDTH[size]"
    v-bind="$attrs"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </v-dialog>
</template>

<script setup lang="ts">
import { SAPLING_DIALOG_MAX_WIDTH, type SaplingDialogSize } from '@/constants/dialog.constants'

defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    size?: SaplingDialogSize
  }>(),
  {
    size: 'md',
  },
)

const model = defineModel<boolean>({ required: true })
</script>
