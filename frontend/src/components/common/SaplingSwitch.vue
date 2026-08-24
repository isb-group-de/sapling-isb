<template>
  <v-switch
    v-model="model"
    class="sapling-control sapling-control--selection sapling-control--switch"
    color="primary"
    density="comfortable"
    hide-details="auto"
    inset
    v-bind="$attrs"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </v-switch>
</template>

<script setup lang="ts" generic="T = boolean | null">
defineOptions({ inheritAttrs: false })

const model = defineModel<T>({ required: true })
</script>
