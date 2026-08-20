<template>
  <v-icon start small class="mr-1 sapling-cell-mail__icon" @click.stop="openCompose"
    >mdi-email</v-icon
  >
  <a href="#" @click.prevent="openCompose">
    <slot />
  </a>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useSaplingMailDialog } from '@/composables/dialog/useSaplingMailDialog'
import type { SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'
import { getCommunicationValueLabel } from '@/utils/saplingCommunicationRecordUtil'

const props = defineProps<{
  value: string
  entityHandle: string
  itemHandle?: string | number
  item?: SaplingGenericItem
  entityTemplates?: EntityTemplate[]
}>()

const { openMailDialog } = useSaplingMailDialog()
const recordLabel = computed(() =>
  props.entityTemplates?.length
    ? getCommunicationValueLabel(props.item, props.entityTemplates)
    : '',
)

function openCompose() {
  openMailDialog({
    entityHandle: props.entityHandle,
    itemHandle: props.itemHandle,
    draftValues: props.item,
    initialTo: props.value ? [props.value] : [],
    recordLabel: recordLabel.value,
  })
}
</script>
