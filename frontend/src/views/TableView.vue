<template>
  <div
    class="sapling-page-shell sapling-page-shell--fill sapling-page-shell--uniform-inset sapling-table-page"
  >
    <SaplingEntityAccessGate :entity-handle="entityHandle">
      <SaplingTableWorkspace :entity-handle="entityHandle" />
    </SaplingEntityAccessGate>
  </div>
</template>

<script lang="ts" setup>
// #region Imports
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import SaplingEntityAccessGate from '@/components/system/SaplingEntityAccessGate.vue'
import SaplingTableWorkspace from '@/components/table/SaplingTableWorkspace.vue'
// #endregion

// #region Entity Name
// Get the current route to determine the entity handle
const route = useRoute()
const entityHandle = computed(() => route.params.entity as string)
// #endregion
</script>
