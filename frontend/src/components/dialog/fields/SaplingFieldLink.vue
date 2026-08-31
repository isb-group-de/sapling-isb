<template>
  <SaplingTextField
    :class="{ 'sapling-field-link--disabled': disabled }"
    :label="label"
    :model-value="modelValue"
    :rules="rules"
    :maxlength="maxlength"
    :readonly="disabled"
    :required="required"
    :placeholder="placeholder"
    autocomplete="off"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #append-inner>
      <a
        v-if="linkHref"
        class="sapling-field-link__action"
        :href="linkHref"
        rel="noopener noreferrer"
        :aria-label="modelValue"
        :title="modelValue"
        @click.stop
      >
        <v-icon icon="mdi-link-variant" />
      </a>
      <v-icon v-else icon="mdi-link-variant" />
    </template>
  </SaplingTextField>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import SaplingTextField from '@/components/common/SaplingTextField.vue'

const props = defineProps<{
  label: string
  modelValue: string
  rules?: ((value: string) => boolean | string)[]
  maxlength?: number
  disabled?: boolean
  required?: boolean
  placeholder: string
}>()

const linkHref = computed(() => {
  const value = props.modelValue.trim()
  if (!value) {
    return ''
  }

  return /^https?:\/\//i.test(value) ? value : `https://${value}`
})
</script>

<style scoped>
.sapling-field-link__action {
  align-items: center;
  color: inherit;
  display: inline-flex;
  text-decoration: none;
}
</style>
