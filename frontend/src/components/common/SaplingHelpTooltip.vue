<template>
  <v-tooltip
    v-model="isOpen"
    :text="text"
    :location="location"
    :max-width="maxWidth"
    open-on-click
    open-on-focus
    open-on-hover
  >
    <template #activator="{ props: tooltipProps }">
      <slot name="activator" :props="tooltipProps">
        <button
          v-bind="tooltipProps"
          type="button"
          class="sapling-help-tooltip"
          :class="{
            'sapling-help-tooltip--compact': compact,
            'sapling-help-tooltip--floating': floating,
          }"
          :aria-label="ariaLabel || text"
          @click.stop="isOpen = !isOpen"
        >
          <v-icon icon="mdi-help-circle-outline" :size="iconSize" />
        </button>
      </slot>
    </template>
  </v-tooltip>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const isOpen = ref(false)

withDefaults(
  defineProps<{
    text: string
    ariaLabel?: string
    location?: 'top' | 'bottom' | 'start' | 'end'
    maxWidth?: number | string
    iconSize?: number | string
    compact?: boolean
    floating?: boolean
  }>(),
  {
    ariaLabel: '',
    location: 'top',
    maxWidth: 360,
    iconSize: 18,
    compact: false,
    floating: false,
  },
)
</script>
