<template>
  <SaplingEntityAccessGate :entity-handle="entityHandle">
    <SaplingKanbanBoard :entity-handle="entityHandle" />
  </SaplingEntityAccessGate>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import SaplingEntityAccessGate from '@/components/system/SaplingEntityAccessGate.vue'
import SaplingKanbanBoard from '@/components/kanban/SaplingKanbanBoard.vue'

const route = useRoute()
const entityHandle = computed(() => route.params.entity as string)
</script>
