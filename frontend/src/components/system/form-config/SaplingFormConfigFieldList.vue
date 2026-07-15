<template>
  <div class="sapling-config-field-tools sapling-form-config__field-tools">
    <v-text-field
      v-model="fieldSearch"
      density="comfortable"
      prepend-inner-icon="mdi-magnify"
      :label="t('global.search')"
      hide-details
    />
    <v-text-field
      v-model="newGroupLabel"
      density="comfortable"
      prepend-inner-icon="mdi-folder-plus-outline"
      :label="formConfigText('newGroup', 'Neue Gruppe')"
      hide-details
      @keyup.enter="addGroup"
    />
    <v-btn
      prepend-icon="mdi-plus"
      variant="tonal"
      :disabled="!newGroupLabel.trim()"
      @click="addGroup"
    >
      {{ formConfigText('addGroup', 'Gruppe hinzufügen') }}
    </v-btn>
    <v-btn
      prepend-icon="mdi-eye-check-outline"
      variant="text"
      :disabled="fields.length === 0"
      @click="emit('showAll')"
    >
      {{ t('formConfig.showAll') }}
    </v-btn>
    <v-btn
      icon="mdi-restore"
      variant="text"
      :title="t('filter.reset')"
      :disabled="fields.length === 0"
      @click="emit('reset')"
    />
  </div>

  <div
    class="sapling-scroll-list sapling-form-config-groups"
    role="list"
    :aria-label="formConfigText('groups', 'Formulargruppen')"
  >
    <SaplingSurface
      v-for="group in filteredGroups"
      :key="group.key || '__ungrouped__'"
      as="section"
      class="sapling-panel-shell sapling-form-config-group"
      :class="{
        'sapling-form-config-group--hidden': !group.visible,
        'sapling-form-config-group--drag-over': dragOverGroupKey === group.key,
      }"
      role="listitem"
      @dragover.prevent="onGroupDragOver(group.key)"
      @dragleave="clearGroupDragOver(group.key)"
      @drop.prevent="dropOnGroup(group.key)"
    >
      <header class="sapling-form-config-group__header">
        <v-btn
          class="sapling-form-config-drag-handle"
          icon="mdi-drag-vertical"
          variant="text"
          size="small"
          draggable="true"
          :title="formConfigText('dragGroup', 'Gruppe verschieben')"
          @dragstart.stop="startGroupDrag($event, group.key)"
          @dragend="endDrag"
        />
        <div class="sapling-form-config-group__identity">
          <strong>{{ resolveGroupLabel(group) }}</strong>
          <span>{{ group.key || formConfigText('ungrouped', 'Ohne Gruppe') }}</span>
        </div>
        <v-text-field
          v-model="group.label"
          class="sapling-form-config-group__label"
          density="compact"
          hide-details
          :label="formConfigText('groupLabel', 'Gruppenname')"
          :placeholder="resolveGroupLabel(group)"
        />
        <v-switch
          v-model="group.visible"
          class="sapling-form-config-group__visibility"
          color="primary"
          hide-details
          density="compact"
          :label="formConfigText('groupVisible', 'Gruppe sichtbar')"
        />
        <v-chip size="small" variant="tonal">
          {{ getGroupFields(group.key).length }}
        </v-chip>
        <v-btn
          v-if="group.key && getGroupFields(group.key).length === 0"
          icon="mdi-delete-outline"
          variant="text"
          color="error"
          size="small"
          :title="formConfigText('removeGroup', 'Leere Gruppe entfernen')"
          @click="emit('removeGroup', group.key)"
        />
      </header>

      <div
        class="sapling-form-config-group__fields"
        :class="{
          'sapling-form-config-group__fields--empty': getGroupFields(group.key).length === 0,
        }"
        @dragover.prevent.stop="onFieldDragOver(group.key)"
        @drop.prevent.stop="dropFieldAtEnd(group.key)"
      >
        <SaplingSurface
          v-for="(field, fieldIndex) in getGroupFields(group.key)"
          :key="field.name"
          as="article"
          class="sapling-panel-shell sapling-stack-md sapling-config-field sapling-form-config-field"
          :class="{
            'sapling-form-config-field--dragging': draggedFieldName === field.name,
            'sapling-form-config-field--drop-before': dropBeforeFieldName === field.name,
          }"
          @dragover.prevent.stop="onFieldDragOver(group.key, field.name)"
          @dragleave.stop="clearFieldDragOver(field.name)"
          @drop.prevent.stop="dropFieldBefore(group.key, fieldIndex)"
        >
          <div class="sapling-row-md sapling-config-field__main sapling-form-config-field__main">
            <v-btn
              class="sapling-form-config-drag-handle"
              icon="mdi-drag"
              variant="text"
              size="small"
              draggable="true"
              :title="formConfigText('dragField', 'Feld verschieben')"
              @dragstart.stop="startFieldDrag($event, field.name)"
              @dragend="endDrag"
            />
            <v-switch
              v-model="field.visible"
              color="primary"
              hide-details
              density="compact"
              :label="t('formConfig.formVisible')"
              :aria-label="t('formConfig.formVisible')"
            />
            <div class="sapling-form-config-field__identity">
              <strong>{{ getFieldLabel(field.name) }}</strong>
              <span>{{ field.name }} · {{ field.type }}</span>
            </div>
          </div>

          <div class="sapling-config-field__controls sapling-form-config-field__controls">
            <v-text-field
              v-model="field.label"
              class="sapling-config-field__control sapling-config-field__control--label"
              density="compact"
              hide-details
              :label="t('formConfig.label')"
            />
            <v-text-field
              v-model="field.placeholder"
              class="sapling-config-field__control sapling-config-field__control--placeholder"
              density="compact"
              hide-details
              :label="t('formConfig.placeholder')"
            />
            <v-number-input
              v-model="field.tableOrder"
              class="sapling-config-field__control"
              density="compact"
              hide-details
              :label="t('formConfig.tableOrder')"
            />
            <v-number-input
              v-model="field.mobileOrder"
              class="sapling-config-field__control"
              density="compact"
              hide-details
              :label="t('formConfig.mobileOrder')"
            />
            <SaplingStaticSelect
              v-model="field.width"
              class="sapling-config-field__control"
              density="compact"
              :items="widthOptions"
              :label="t('formConfig.width')"
            />
            <SaplingStaticSelect
              v-model="field.renderer"
              class="sapling-config-field__control"
              density="compact"
              :items="rendererOptions"
              :label="t('formConfig.renderer')"
            />
          </div>

          <div
            class="sapling-row-md sapling-config-field__toggles sapling-form-config-field__toggles"
          >
            <v-checkbox
              v-model="field.required"
              density="compact"
              hide-details
              :label="t('formConfig.required')"
            />
            <v-checkbox
              v-model="field.tableVisible"
              density="compact"
              hide-details
              :label="t('formConfig.tableVisible')"
            />
            <v-checkbox
              v-model="field.mobileVisible"
              density="compact"
              hide-details
              :label="t('formConfig.mobileVisible')"
            />
            <v-checkbox
              v-model="field.readonly"
              density="compact"
              hide-details
              :label="t('formConfig.readonly')"
            />
          </div>
        </SaplingSurface>

        <div v-if="getGroupFields(group.key).length === 0" class="sapling-form-config-group__empty">
          <v-icon icon="mdi-tray-arrow-down" />
          <span>{{ formConfigText('dropFieldsHere', 'Felder hier ablegen') }}</span>
        </div>
      </div>
    </SaplingSurface>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EntityTemplateFormWidth, SaplingFormRenderer } from '@/entity/structure'
import SaplingStaticSelect from '@/components/common/SaplingStaticSelect.vue'
import SaplingSurface from '@/components/common/SaplingSurface.vue'
import type { FieldDraft, GroupDraft, StaticOption } from './formConfigAdmin.types'

const props = defineProps<{
  fields: FieldDraft[]
  groups: GroupDraft[]
  widthOptions: StaticOption<EntityTemplateFormWidth>[]
  rendererOptions: StaticOption<SaplingFormRenderer>[]
  resolveFieldLabel: (fieldName: string) => string
  resolveGroupLabel: (group: GroupDraft) => string
}>()

const emit = defineEmits<{
  (event: 'showAll'): void
  (event: 'reset'): void
  (event: 'addGroup', label: string): void
  (event: 'removeGroup', groupKey: string): void
  (event: 'moveField', fieldName: string, targetGroupKey: string, targetIndex: number): void
  (event: 'reorderGroup', sourceKey: string, targetKey: string): void
}>()

const { t, te } = useI18n()
const fieldSearch = ref('')
const newGroupLabel = ref('')
const draggedFieldName = ref('')
const draggedGroupKey = ref<string | null>(null)
const dragOverGroupKey = ref<string | null>(null)
const dropBeforeFieldName = ref('')

const filteredGroups = computed(() => {
  const query = fieldSearch.value.trim().toLowerCase()
  const sortedGroups = [...props.groups].sort((left, right) => left.order - right.order)
  if (!query) return sortedGroups

  return sortedGroups.filter((group) => {
    const matchesGroup = [group.key, group.label, props.resolveGroupLabel(group)].some((value) =>
      String(value ?? '')
        .toLowerCase()
        .includes(query),
    )
    return matchesGroup || getGroupFields(group.key).length > 0
  })
})

function getGroupFields(groupKey: string): FieldDraft[] {
  const query = fieldSearch.value.trim().toLowerCase()
  return props.fields
    .filter((field) => field.group === groupKey)
    .filter(
      (field) =>
        !query ||
        [field.name, field.label, field.type].some((value) =>
          String(value ?? '')
            .toLowerCase()
            .includes(query),
        ),
    )
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
}

function addGroup(): void {
  const label = newGroupLabel.value.trim()
  if (!label) return
  emit('addGroup', label)
  newGroupLabel.value = ''
}

function startFieldDrag(event: DragEvent, fieldName: string): void {
  draggedFieldName.value = fieldName
  draggedGroupKey.value = null
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', `field:${fieldName}`)
  }
}

function startGroupDrag(event: DragEvent, groupKey: string): void {
  draggedGroupKey.value = groupKey
  draggedFieldName.value = ''
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', `group:${groupKey}`)
  }
}

function onGroupDragOver(groupKey: string): void {
  if (draggedGroupKey.value !== null || draggedFieldName.value) {
    dragOverGroupKey.value = groupKey
  }
}

function clearGroupDragOver(groupKey: string): void {
  if (dragOverGroupKey.value === groupKey) dragOverGroupKey.value = null
}

function onFieldDragOver(groupKey: string, fieldName = ''): void {
  if (!draggedFieldName.value) return
  dragOverGroupKey.value = groupKey
  dropBeforeFieldName.value = fieldName
}

function clearFieldDragOver(fieldName: string): void {
  if (dropBeforeFieldName.value === fieldName) dropBeforeFieldName.value = ''
}

function dropOnGroup(groupKey: string): void {
  if (draggedGroupKey.value !== null) {
    emit('reorderGroup', draggedGroupKey.value, groupKey)
  } else if (draggedFieldName.value) {
    emit('moveField', draggedFieldName.value, groupKey, getGroupFields(groupKey).length)
  }
  endDrag()
}

function dropFieldBefore(groupKey: string, targetIndex: number): void {
  if (draggedFieldName.value) {
    emit('moveField', draggedFieldName.value, groupKey, targetIndex)
  }
  endDrag()
}

function dropFieldAtEnd(groupKey: string): void {
  if (draggedFieldName.value) {
    emit('moveField', draggedFieldName.value, groupKey, getGroupFields(groupKey).length)
  }
  endDrag()
}

function endDrag(): void {
  draggedFieldName.value = ''
  draggedGroupKey.value = null
  dragOverGroupKey.value = null
  dropBeforeFieldName.value = ''
}

function getFieldLabel(fieldName: string): string {
  return props.resolveFieldLabel(fieldName)
}

function formConfigText(key: string, fallback: string): string {
  const translationKey = `formConfig.${key}`
  return te(translationKey) ? t(translationKey) : fallback
}
</script>
