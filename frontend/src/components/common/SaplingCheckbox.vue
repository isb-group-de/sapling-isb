<template>
  <v-checkbox
    v-model="model"
    class="sapling-control sapling-control--selection sapling-control--checkbox"
    color="primary"
    density="comfortable"
    hide-details="auto"
    v-bind="$attrs"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </v-checkbox>
</template>

<script setup lang="ts" generic="T = boolean | null">
defineOptions({ inheritAttrs: false })

const model = defineModel<T>({ required: true })
</script>
