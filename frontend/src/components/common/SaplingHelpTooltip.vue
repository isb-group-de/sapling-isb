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

<style scoped>
.sapling-help-tooltip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  cursor: help;
  opacity: var(--sapling-opacity-strong);
  pointer-events: auto;
  position: relative;
  z-index: 2;
}

.sapling-help-tooltip--compact {
  width: 1.125rem;
  height: 1.125rem;
}

.sapling-help-tooltip:hover,
.sapling-help-tooltip:focus-visible {
  background: rgba(var(--v-theme-primary), 0.1);
  opacity: 1;
}

.sapling-help-tooltip:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 1px;
}

.sapling-help-tooltip--floating {
  position: absolute;
  z-index: 3;
  top: -0.65rem;
  right: 0.25rem;
}
</style>
