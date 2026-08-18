<template>
  <div class="sapling-stack-lg sapling-record-dialog-form-layout sapling-dialog-edit-form-layout">
    <section
      v-for="group in groups"
      :key="group.id"
      class="sapling-section-panel sapling-record-section sapling-dialog-edit-section"
      :data-dialog-group-id="group.id"
      :class="{
        'sapling-dialog-edit-section--collapsed': group.label && !isGroupExpanded(group.id),
        'sapling-record-section--dirty': mode !== 'readonly' && isGroupDirty(group.templates),
        'sapling-dialog-edit-section--dirty': mode !== 'readonly' && isGroupDirty(group.templates),
      }"
    >
      <div
        v-if="group.label"
        class="sapling-section-header sapling-record-section__header sapling-dialog-edit-section__header"
      >
        <button
          type="button"
          class="sapling-row-between-md sapling-record-section__toggle sapling-dialog-edit-section__toggle"
          :aria-expanded="isGroupExpanded(group.id)"
          @click="emit('toggle-group', group.id)"
        >
          <h3
            class="sapling-section-title sapling-record-section__title sapling-dialog-edit-section__title"
          >
            {{ group.label }}
          </h3>
          <v-icon
            :icon="isGroupExpanded(group.id) ? 'mdi-chevron-up' : 'mdi-chevron-down'"
            size="20"
          />
        </button>
      </div>
      <v-expand-transition>
        <div
          v-show="!group.label || isGroupExpanded(group.id)"
          class="sapling-record-section__body sapling-dialog-edit-section__body"
        >
          <v-row density="comfortable" class="sapling-record-form-grid sapling-dialog-edit-grid">
            <v-col
              v-for="template in group.templates"
              :key="template.name"
              v-bind="getTemplateColumnProps(template)"
              class="sapling-record-form-grid__column sapling-dialog-edit-grid__column"
            >
              <div
                class="sapling-record-field-shell sapling-dialog-edit-field-shell"
                :data-dialog-field-name="template.name"
                :class="{
                  'sapling-record-field-shell--dirty':
                    mode !== 'readonly' && isTemplateDirty(template),
                  'sapling-dialog-edit-field-shell--dirty':
                    mode !== 'readonly' && isTemplateDirty(template),
                }"
              >
                <SaplingDialogEditFieldRenderer
                  :template="template"
                  :entity-handle="entityHandle"
                  :item-handle="itemHandle ?? undefined"
                  :mode="mode"
                  :form-values="formValues"
                  :visible-templates="visibleTemplates"
                  :permissions="permissions"
                  :icon-names="iconNames"
                  :is-reference-visible="isReferenceVisible"
                  :rules="getRules(template)"
                  :field-disabled="isFieldDisabled(template)"
                  :reference-field-disabled="isReferenceFieldDisabled(template)"
                  :reference-parent-filter="
                    template.referenceDependency ? getReferenceParentFilter(template) : undefined
                  "
                  @update-field="(key, value) => emit('update-field', key, value)"
                  @select-record="(record) => emit('select-record', record)"
                />
              </div>
            </v-col>
          </v-row>
        </div>
      </v-expand-transition>
    </section>
  </div>
</template>

<script lang="ts" setup>
import SaplingDialogEditFieldRenderer from '@/components/dialog/SaplingDialogEditFieldRenderer.vue'
import type { SaplingGenericItem } from '@/entity/entity'
import type { AccumulatedPermission, DialogState, EntityTemplate } from '@/entity/structure'
import type { FilterQuery } from '@/services/api.generic.service'
import type {
  SaplingDialogColumnProps,
  SaplingDialogTemplateGroup,
} from '@/utils/saplingDialogLayoutUtil'

type ValidationRule = (value: unknown) => true | string

defineProps<{
  groups: SaplingDialogTemplateGroup[]
  mode: DialogState
  entityHandle: string
  itemHandle: string | number | null
  formValues: SaplingGenericItem
  visibleTemplates: EntityTemplate[]
  permissions: AccumulatedPermission[] | null
  iconNames: Array<{ name: string; unicode?: string }>
  isReferenceVisible: boolean
  isGroupExpanded: (groupId: string) => boolean
  isGroupDirty: (templates: EntityTemplate[]) => boolean
  isTemplateDirty: (template: EntityTemplate) => boolean
  getTemplateColumnProps: (template: EntityTemplate) => SaplingDialogColumnProps
  getRules: (template: EntityTemplate) => ValidationRule[]
  isFieldDisabled: (template: EntityTemplate) => boolean
  isReferenceFieldDisabled: (template: EntityTemplate) => boolean
  getReferenceParentFilter: (template: EntityTemplate) => FilterQuery
}>()

const emit = defineEmits<{
  (event: 'toggle-group', groupId: string): void
  (event: 'update-field', key: string, value: unknown): void
  (event: 'select-record', record: SaplingGenericItem): void
}>()
</script>
