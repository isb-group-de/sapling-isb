<template>
  <div class="sapling-config-field-tools sapling-form-config__field-tools glass-panel">
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
      }"
      role="listitem"
    >
      <header class="sapling-form-config-group__header">
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
      >
        <SaplingSurface
          v-for="field in getGroupFields(group.key)"
          :key="field.name"
          as="article"
          class="sapling-panel-shell sapling-stack-md sapling-config-field sapling-form-config-field"
        >
          <div class="sapling-row-md sapling-config-field__main sapling-form-config-field__main">
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
            <v-textarea
              v-model="field.helpText"
              class="sapling-config-field__control sapling-config-field__control--help-text"
              density="compact"
              hide-details
              auto-grow
              rows="1"
              :label="formConfigText('helpText', 'Hilfetext')"
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
          <v-icon icon="mdi-folder-outline" />
          <span>{{ formConfigText('emptyGroup', 'Leere Gruppe') }}</span>
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
}>()

const { t, te } = useI18n()
const fieldSearch = ref('')
const newGroupLabel = ref('')

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

function getFieldLabel(fieldName: string): string {
  return props.resolveFieldLabel(fieldName)
}

function formConfigText(key: string, fallback: string): string {
  const translationKey = `formConfig.${key}`
  return te(translationKey) ? t(translationKey) : fallback
}
</script>
