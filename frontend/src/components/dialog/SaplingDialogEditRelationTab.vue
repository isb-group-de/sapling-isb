<template>
  <div class="sapling-record-dialog-tab-scroll sapling-dialog-edit-tab-scroll">
    <div class="sapling-stack-lg sapling-record-relation-shell sapling-dialog-edit-relation-shell">
      <v-card
        class="sapling-panel-shell sapling-record-relation-card sapling-dialog-edit-relation-card"
        :aria-busy="isMutating"
      >
        <v-card-text
          class="sapling-section-panel sapling-record-relation-content sapling-dialog-edit-relation-content"
        >
          <div class="sapling-record-relation-overview">
            <div class="sapling-record-relation-summary">
              <div class="sapling-record-relation-summary__icon" aria-hidden="true">
                <v-icon size="22">mdi-link-variant</v-icon>
              </div>
              <div class="sapling-record-relation-summary__copy">
                <span class="sapling-record-relation-summary__eyebrow">{{ entityLabel }}</span>
                <h3 class="sapling-record-relation-summary__title">{{ relationLabel }}</h3>
              </div>
            </div>

            <div v-if="!isReadOnlyRelation" class="sapling-record-relation-actions">
              <template v-if="isInitialLoading">
                <div
                  class="sapling-record-relation-action-section sapling-record-relation-action-section--add"
                >
                  <v-skeleton-loader
                    class="sapling-record-relation-action-skeleton"
                    type="text, button"
                  />
                </div>
                <div
                  class="sapling-record-relation-action-section sapling-record-relation-action-section--remove"
                >
                  <v-skeleton-loader
                    class="sapling-record-relation-action-skeleton"
                    type="text, button"
                  />
                </div>
              </template>
              <template v-else>
                <div
                  class="sapling-record-relation-action-section sapling-record-relation-action-section--add"
                >
                  <div class="sapling-record-relation-action-section__header">
                    <span class="sapling-record-relation-action-section__label">
                      <v-icon size="17">mdi-link-plus</v-icon>
                      {{ $t('global.add') }}
                    </span>
                    <span class="sapling-record-relation-action-section__count" aria-live="polite">
                      <strong>{{ selectedRelations.length }}</strong>
                      {{ $t('global.selected') }}
                    </span>
                  </div>
                  <SaplingSelectAddField
                    class="sapling-record-relation-actions__field"
                    :label="relationLabel"
                    :entity-handle="template.referenceName ?? ''"
                    :model-value="selectedRelations"
                    :rules="[]"
                    :disabled="isMutating"
                    :loading="isMutating && selectedRelations.length > 0"
                    :action-label="$t('global.addSelected')"
                    action-icon="mdi-link-plus"
                    show-action-label
                    @update:model-value="
                      (val: SaplingGenericItem[]) => emit('update:selected-relations', val)
                    "
                    @add-selected="emit('add-relation')"
                  />
                </div>

                <div
                  class="sapling-record-relation-action-section sapling-record-relation-action-section--remove sapling-record-relation-selection"
                >
                  <div class="sapling-record-relation-action-section__header">
                    <span class="sapling-record-relation-action-section__label">
                      <v-icon size="17">mdi-link-variant-off</v-icon>
                      {{ $t('global.remove') }}
                    </span>
                    <span class="sapling-record-relation-action-section__count" aria-live="polite">
                      <strong>{{ selectedItems.length }}</strong>
                      {{ $t('global.selected') }}
                    </span>
                  </div>
                  <v-btn
                    class="sapling-record-relation-selection__remove"
                    color="error"
                    variant="tonal"
                    prepend-icon="mdi-link-variant-off"
                    :disabled="selectedItems.length === 0 || isMutating"
                    :loading="isMutating && selectedItems.length > 0"
                    @click="emit('remove-relation')"
                  >
                    {{ $t('global.remove') }}
                  </v-btn>
                </div>
              </template>
            </div>
          </div>

          <div class="sapling-record-relation-table sapling-dialog-edit-relation-table">
            <v-skeleton-loader
              v-if="isInitialLoading"
              class="sapling-record-relation-table-skeleton"
              type="table"
            />
            <SaplingTable
              v-else
              :headers="headers"
              :items="items"
              :parent="item"
              :parent-entity="entity"
              :search="search"
              :page="page"
              :items-per-page="itemsPerPage"
              :total-items="totalItems"
              :is-loading="isLoading"
              :sort-by="sortBy"
              :column-filters="columnFilters"
              :entity-handle="template.referenceName ?? ''"
              :entity-templates="entityTemplates"
              :entity="relationEntity"
              :entity-permission="entityPermission"
              :show-actions="!isReadOnlyRelation"
              :multi-select="!isReadOnlyRelation"
              :show-favorite="false"
              :show-add="false"
              :show-import="false"
              :show-form-config="false"
              :show-selection-toolbar="false"
              :table-key="template.name"
              :selected="selectedItems"
              @update:selected="(val: SaplingGenericItem[]) => emit('update:selected-items', val)"
              @update:search="(val: string) => emit('update:search', val)"
              @update:page="(val: number) => emit('update:page', val)"
              @update:items-per-page="(val: number) => emit('update:items-per-page', val)"
              @update:sort-by="(val: SortItem[]) => emit('update:sort-by', val)"
              @update:column-filters="
                (val: Record<string, ColumnFilterItem>) => emit('update:column-filters', val)
              "
              @reload="emit('reload')"
            />
          </div>
        </v-card-text>
      </v-card>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingSelectAddField from '@/components/dialog/fields/SaplingFieldSelectAdd.vue'
import SaplingTable from '@/components/table/SaplingTable.vue'
import type { EntityItem, SaplingGenericItem } from '@/entity/entity'
import type {
  AccumulatedPermission,
  ColumnFilterItem,
  DialogState,
  EntityTemplate,
  SortItem,
  SaplingTableHeaderItem,
} from '@/entity/structure'

const props = defineProps<{
  template: EntityTemplate
  mode: DialogState
  entityHandle: string
  entityLabel: string
  item: SaplingGenericItem | null
  entity: EntityItem | null
  headers: SaplingTableHeaderItem[]
  items: SaplingGenericItem[]
  search: string
  page: number
  itemsPerPage: number
  totalItems: number
  isLoading: boolean
  sortBy: SortItem[]
  columnFilters: Record<string, ColumnFilterItem>
  entityTemplates: EntityTemplate[]
  relationEntity: EntityItem | null
  entityPermission: AccumulatedPermission | null
  selectedRelations: SaplingGenericItem[]
  selectedItems: SaplingGenericItem[]
  isMutating: boolean
  isInitialLoading: boolean
}>()

const { t } = useI18n()
const relationLabel = computed(() => t(`${props.entityHandle}.${props.template.name}`))
const isReadOnlyRelation = computed(
  () =>
    props.mode !== 'edit' ||
    props.template.fieldAccess?.allowUpdate === false ||
    (props.template.options?.includes('isReadOnly') ?? false),
)

const emit = defineEmits<{
  (event: 'update:selected-relations', value: SaplingGenericItem[]): void
  (event: 'update:selected-items', value: SaplingGenericItem[]): void
  (event: 'add-relation'): void
  (event: 'remove-relation'): void
  (event: 'update:search', value: string): void
  (event: 'update:page', value: number): void
  (event: 'update:items-per-page', value: number): void
  (event: 'update:sort-by', value: SortItem[]): void
  (event: 'update:column-filters', value: Record<string, ColumnFilterItem>): void
  (event: 'reload'): void
}>()
</script>
