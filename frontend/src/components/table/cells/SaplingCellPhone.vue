<template>
  <v-icon start small class="mr-1 sapling-cell-phone__icon" @click.stop="openCallDialog"
    >mdi-phone</v-icon
  >
  <a href="#" @click.prevent="openCallDialog">
    <slot />
  </a>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useSaplingPhoneDialog } from '@/composables/dialog/useSaplingPhoneDialog'
import { useSaplingPhoneNumber } from '@/composables/phone/useSaplingPhoneNumber'
import type { SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'
import { getCommunicationValueLabel } from '@/utils/saplingCommunicationRecordUtil'

const props = defineProps<{
  value: string
  entityHandle?: string
  itemHandle?: string | number
  item?: SaplingGenericItem
  entityTemplates?: EntityTemplate[]
}>()

const { openPhoneDialog } = useSaplingPhoneDialog()
const { formatPhoneNumber } = useSaplingPhoneNumber()
const formattedPhoneNumber = computed(() => formatPhoneNumber(props.value))
const recordLabel = computed(() =>
  props.entityTemplates?.length
    ? getCommunicationValueLabel(props.item, props.entityTemplates)
    : '',
)

function openCallDialog() {
  if (!formattedPhoneNumber.value) {
    return
  }

  openPhoneDialog({
    entityHandle: props.entityHandle,
    itemHandle: props.itemHandle,
    draftValues: props.item,
    phoneNumber: formattedPhoneNumber.value,
    recordLabel: recordLabel.value,
  })
}
</script>
