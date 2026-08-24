<template>
  <v-textarea
    v-model="model"
    class="sapling-control sapling-control--textarea"
    density="comfortable"
    variant="outlined"
    hide-details="auto"
    v-bind="$attrs"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </v-textarea>
</template>

<script setup lang="ts" generic="T = string">
defineOptions({ inheritAttrs: false })

const model = defineModel<T>({ required: true })
</script>
