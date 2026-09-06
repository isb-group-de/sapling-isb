<template>
  <component :is="systemComponent" v-if="systemComponent" />
  <v-container
    v-else
    class="sapling-page-shell sapling-page-shell--panel sapling-page-shell--uniform-inset sapling-system-page"
    fluid
  >
    <v-alert v-if="loadFailed" type="error" variant="tonal">
      {{ $t('global.errorOnLoading') }}
      <template #append>
        <v-btn variant="text" @click="loadSystem">{{ $t('global.refresh') }}</v-btn>
      </template>
    </v-alert>
    <SaplingSystemSkeleton v-else />
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref, shallowRef, type Component } from 'vue'
import SaplingSystemSkeleton from '@/components/system/SaplingSystemSkeleton.vue'

const systemComponent = shallowRef<Component>()
const loadFailed = ref(false)

// Start after mounting so neither the router nor the layout's Suspense waits
// for monitoring panels and ECharts before displaying the page skeleton.
async function loadSystem() {
  loadFailed.value = false
  try {
    systemComponent.value = (await import('@/components/system/SaplingSystem.vue')).default
  } catch {
    loadFailed.value = true
  }
}

onMounted(loadSystem)
</script>
