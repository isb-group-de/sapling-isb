<template>
  <section
    class="sapling-table-grouping"
    :class="{ 'sapling-table-grouping--over': dragOver }"
    :aria-label="$t('global.tableGroupField')"
    @dragover="onDragOver"
    @dragleave.self="dragOver = false"
    @drop.prevent="onDrop($event)"
  >
    <span class="sapling-table-grouping__hint">{{ $t('global.tableGroupDragHint') }}</span>
    <div class="sapling-table-grouping__levels">
      <div
        v-for="(field, index) in modelValue"
        :key="field"
        class="sapling-table-grouping__level"
        draggable="true"
        @dragstart="startDrag($event, field)"
        @dragend="dragOver = false"
        @drop.stop.prevent="onDrop($event, field)"
      >
        <v-icon size="small">mdi-drag-vertical</v-icon>
        <span>{{ index + 1 }}. {{ fields.find((entry) => entry.value === field)?.title }}</span>
        <v-btn
          icon="mdi-chevron-left"
          size="x-small"
          variant="text"
          :disabled="index === 0"
          :aria-label="`${$t('global.tableGroupEarlier')}: ${label(field)}`"
          @click="move(field, index - 1)"
        />
        <v-btn
          icon="mdi-chevron-right"
          size="x-small"
          variant="text"
          :disabled="index === modelValue.length - 1"
          :aria-label="`${$t('global.tableGroupLater')}: ${label(field)}`"
          @click="move(field, index + 1)"
        />
        <v-btn
          icon="mdi-close"
          size="x-small"
          variant="text"
          :aria-label="`${$t('global.tableGroupRemove')}: ${label(field)}`"
          @click="
            emit(
              'update:modelValue',
              modelValue.filter((value) => value !== field),
            )
          "
        />
      </div>
      <v-menu v-if="availableFields.length" location="bottom end">
        <template #activator="{ props: menuProps }">
          <v-btn v-bind="menuProps" size="small" variant="text" prepend-icon="mdi-plus">{{
            $t('global.tableGroupAdd')
          }}</v-btn>
        </template>
        <v-list density="compact" class="glass-panel" nav>
          <v-list-item
            v-for="field in availableFields"
            :key="field.value"
            :title="field.title"
            @click="add(field.value)"
          />
        </v-list>
      </v-menu>
    </div>
    <span class="sapling-table-grouping__hint">{{ $t('global.tableGroupPaging') }}</span>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { TABLE_GROUP_DRAG_TYPE } from '@/composables/table/saplingTablePreferences'

const props = defineProps<{ modelValue: string[]; fields: { value: string; title: string }[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()
const dragOver = ref(false)
const availableFields = computed(() =>
  props.fields.filter((field) => !props.modelValue.includes(field.value)),
)
const label = (field: string) => props.fields.find((entry) => entry.value === field)?.title ?? field
function add(field: string) {
  if (availableFields.value.some((entry) => entry.value === field))
    emit('update:modelValue', [...props.modelValue, field])
}
function move(field: string, index: number) {
  const fields = props.modelValue.filter((value) => value !== field)
  fields.splice(index, 0, field)
  emit('update:modelValue', fields)
}
function startDrag(event: DragEvent, field: string) {
  event.dataTransfer?.setData(TABLE_GROUP_DRAG_TYPE, field)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
function onDragOver(event: DragEvent) {
  if (!Array.from(event.dataTransfer?.types ?? []).includes(TABLE_GROUP_DRAG_TYPE)) return
  event.preventDefault()
  dragOver.value = true
}
function onDrop(event: DragEvent, before?: string) {
  dragOver.value = false
  const field = event.dataTransfer?.getData(TABLE_GROUP_DRAG_TYPE) ?? ''
  if (!props.fields.some((entry) => entry.value === field) || field === before) return
  const fields = props.modelValue.filter((value) => value !== field)
  const index = before ? fields.indexOf(before) : fields.length
  fields.splice(index < 0 ? fields.length : index, 0, field)
  emit('update:modelValue', fields)
}
</script>
