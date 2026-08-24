<template>
  <SaplingAutocomplete
    :model-value="modelValue"
    :items="booleanItems"
    item-title="title"
    item-value="value"
    :label="$t('filter.value')"
    density="comfortable"
    variant="outlined"
    hide-details
    class="sapling-table-filter-menu__field"
    @update:model-value="updateValue"
  />
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingAutocomplete from '@/components/common/SaplingAutocomplete.vue'

defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()

const booleanItems = computed(() => [
  { title: t('filter.all'), value: '' },
  { title: t('filter.yes'), value: 'true' },
  { title: t('filter.no'), value: 'false' },
])

function updateValue(value: string | null) {
  emit('update:modelValue', value ?? '')
}
</script>
