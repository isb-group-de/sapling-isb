<template>
  <div v-if="hasTarget" class="sapling-table-generic-reference">
    <v-btn
      size="small"
      :rounded="false"
      :max-height="32"
      class="glass-panel sapling-button-truncate sapling-table-generic-reference__button"
      :loading="isLoading"
      @click.stop="openTarget"
    >
      <v-icon class="sapling-table-generic-reference__icon">mdi-eye</v-icon>
      <span v-if="displayLabel" class="sapling-text-truncate sapling-button-truncate__label">
        {{ displayLabel }}
      </span>
    </v-btn>
    <SaplingDialogEdit
      v-if="dialogOpen && resolvedItem && targetEntity"
      :model-value="dialogOpen"
      mode="readonly"
      :item="resolvedItem"
      :entity="targetEntity"
      :templates="targetTemplates"
      @update:model-value="dialogOpen = false"
    />
  </div>
  <span v-else class="sapling-table-generic-reference__placeholder">-</span>
</template>

<script lang="ts" setup>
import { ref, toRef } from 'vue'
import { useRouter } from 'vue-router'
import type { SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'
import SaplingDialogEdit from '@/components/dialog/SaplingDialogEdit.vue'
import { useSaplingGenericReferenceTarget } from '@/composables/reference/useSaplingGenericReferenceTarget'

const props = defineProps<{
  item: SaplingGenericItem
  col: EntityTemplate
}>()
const router = useRouter()
const dialogOpen = ref(false)

const {
  displayLabel,
  ensureTargetResolved,
  hasTarget,
  isLoading,
  resolvedItem,
  targetEntity,
  targetTemplates,
} = useSaplingGenericReferenceTarget({
  item: toRef(props, 'item'),
  template: toRef(props, 'col'),
  autoResolve: false,
})

async function openTarget() {
  const targetRecord = await ensureTargetResolved()
  if (!targetRecord || !targetEntity.value) return
  if (['company', 'person'].includes(targetEntity.value.handle) && targetRecord.handle != null) {
    await router.push({
      name: 'customer360',
      params: {
        entityHandle: targetEntity.value.handle,
        handle: String(targetRecord.handle),
      },
    })
    return
  }
  dialogOpen.value = true
}
</script>
