<template>
  <v-autocomplete
    v-model="model"
    v-model:menu="menuOpen"
    class="sapling-control sapling-control--select"
    density="comfortable"
    variant="outlined"
    hide-details="auto"
    v-bind="$attrs"
    @keydown.tab="menuOpen = false"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </v-autocomplete>
</template>

<script setup lang="ts" generic="T = unknown">
defineOptions({ inheritAttrs: false })

const model = defineModel<T>({ required: true })
const menuOpen = defineModel<boolean>('menu', { default: false })
</script>
