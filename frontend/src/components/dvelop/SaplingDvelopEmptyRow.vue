<template>
  <tr>
    <td :colspan="columns">
      <div class="sapling-inline-empty">{{ label }}</div>
    </td>
  </tr>
</template>

<script lang="ts" setup>
defineProps<{ label: string; columns: number }>()
</script>
