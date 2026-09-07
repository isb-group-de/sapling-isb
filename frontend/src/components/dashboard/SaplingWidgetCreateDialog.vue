<template>
  <SaplingDialogEdit
    v-model="editDialog.visible"
    v-model:mode="editDialog.mode"
    v-model:item="editDialog.item"
    :entity="state.entity"
    :templates="state.entityTemplates"
    :show-reference="true"
    @save="saveDialog"
    @cancel="closeDialog"
    @deleted="closeDialog"
  />
  <SaplingDialogUpdateConflict
    :model-value="updateConflictDialog.visible"
    :conflict="updateConflictDialog.conflict"
    :entity-handle="entityHandle"
    :entity-templates="state.entityTemplates"
    :is-saving="updateConflictDialog.isSaving"
    @update:model-value="!$event && closeUpdateConflictDialog()"
    @merge="mergeUpdateConflict"
    @reload="reloadUpdateConflictRecord"
    @open-change-log="openUpdateConflictChangeLog"
  />
</template>
<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useGenericStore } from '@/stores/genericStore'
import { useSaplingTableActions } from '@/composables/table/useSaplingTableActions'
import SaplingDialogEdit from '@/components/dialog/SaplingDialogEdit.vue'
import SaplingDialogUpdateConflict from '@/components/dialog/SaplingDialogUpdateConflict.vue'
const props = defineProps<{ entityHandle: string }>()
const emit = defineEmits<{ (event: 'close'): void }>()
const metadata = useGenericStore()
const state = computed(() => metadata.getState(props.entityHandle))
// Reuse the table's create/save flow, including pending relations, save-and-close,
// switching to edit after creation and optimistic-concurrency conflict handling.
const actions = useSaplingTableActions({
  props: reactive({
    items: [],
    search: '',
    sortBy: [],
    entityHandle: computed(() => props.entityHandle),
    entity: computed(() => state.value.entity),
    entityPermission: computed(() => state.value.entityPermission),
    entityTemplates: computed(() => state.value.entityTemplates),
  }),
  emit: () => {},
  localColumnFilters: ref({}),
  selectedItems: ref([]),
  selectedRows: ref([]),
  clearSelection: () => {},
})
const {
  editDialog,
  openCreateDialog,
  saveDialog,
  closeDialog,
  updateConflictDialog,
  closeUpdateConflictDialog,
  mergeUpdateConflict,
  reloadUpdateConflictRecord,
  openUpdateConflictChangeLog,
} = actions
openCreateDialog()
watch(
  () => editDialog.value.visible,
  (visible) => {
    if (!visible) emit('close')
  },
)
</script>
