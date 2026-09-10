<template>
  <v-dialog
    v-model="visibleModel"
    class="sapling-dialog-frame"
    :class="[`sapling-dialog-frame--${size}`, { 'sapling-dialog-frame--docked': docked }]"
    :max-width="SAPLING_DIALOG_MAX_WIDTH[size]"
    v-bind="$attrs"
    :attach="workspaceTab ? `#workspace-panel-${workspaceTab.id}` : undefined"
    :contained="Boolean(workspaceTab)"
    :eager="Boolean(workspaceTab) && model"
    :retain-focus="workspaceTab ? false : $attrs['retain-focus'] !== false"
    :scroll-strategy="workspaceTab ? 'none' : 'block'"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useWorkspaceTab } from '@/composables/system/workspaceTabContext'
import { SAPLING_DIALOG_MAX_WIDTH, type SaplingDialogSize } from '@/constants/dialog.constants'

defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    size?: SaplingDialogSize
    docked?: boolean
  }>(),
  {
    size: 'md',
    docked: false,
  },
)

const model = defineModel<boolean>({ required: true })
const workspaceTab = useWorkspaceTab()
const visibleModel = computed({
  get: () => model.value && (workspaceTab?.active ?? true),
  set: (value: boolean) => {
    if (workspaceTab?.active !== false) model.value = value
  },
})
</script>
