<template>
  <div class="sapling-header__primary-actions">
    <v-tooltip location="bottom" :text="homeLabel">
      <template #activator="{ props: tooltipProps }">
        <v-btn
          v-bind="tooltipProps"
          data-tutorial="header-home"
          class="sapling-button--action sapling-header__primary-action sapling-header__home text-none"
          variant="text"
          to="/"
          :aria-label="homeLabel"
          :title="homeLabel"
        >
          <span class="sapling-header__primary-action-content">
            <v-icon class="sapling-header__primary-action-icon" icon="mdi-home-outline" />
            <span class="sapling-header__primary-action-label">Sapling</span>
          </span>
        </v-btn>
      </template>
    </v-tooltip>

    <SaplingHeaderQuicklinks />
  </div>
</template>

<script lang="ts" setup>
import SaplingHeaderQuicklinks from '@/components/system/header/SaplingHeaderQuicklinks.vue'

defineProps<{
  homeLabel: string
}>()
</script>
