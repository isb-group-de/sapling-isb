<template>
  <v-app class="sapling-no-select">
    <div class="bg-wrapper">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
      <div class="blob blob-3"></div>
    </div>
    <div id="sparkle-trail-container"></div>
    <v-main class="sapling-main">
      <div class="sapling-main__content">
        <router-view />
      </div>
    </v-main>
    <SaplingAutomationDialog v-if="automationInspector.visible" />
  </v-app>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, onMounted, onUnmounted } from 'vue'
import { automationInspector } from '@/components/automation/automationInspector'
import { useSaplingAppearance } from '@/composables/system/useSaplingAppearance'

const SaplingAutomationDialog = defineAsyncComponent(
  () => import('@/components/automation/SaplingAutomationDialog.vue'),
)
useSaplingAppearance()

function handleContextMenu(event: MouseEvent) {
  event.preventDefault()
}

onMounted(() => {
  window.addEventListener('contextmenu', handleContextMenu)
})

onUnmounted(() => {
  window.removeEventListener('contextmenu', handleContextMenu)
})
</script>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'App',

  data() {
    return {}
  },
})
</script>
