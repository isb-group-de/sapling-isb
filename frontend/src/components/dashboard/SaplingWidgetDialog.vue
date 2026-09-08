<template>
  <SaplingDialog
    :model-value="true"
    :size="kind === 'NOTE' || kind === 'ACTIONS' ? 'lg' : 'md'"
    :persistent="busy"
    @update:model-value="!$event && close()"
  >
    <SaplingDialogCard :close="close" :close-disabled="busy">
      <SaplingDialogShell>
        <template #hero
          ><SaplingDialogHero :title="$t(widget ? 'dashboard.editWidget' : 'dashboard.addWidget')"
        /></template>
        <template #body>
          <v-form ref="form" class="sapling-dialog-form" :disabled="busy">
            <v-select
              v-model="kind"
              :items="kindOptions"
              :label="$t('dashboard.widgetType')"
              :disabled="!!widget"
            />
            <SaplingTextField
              v-model="title"
              :label="$t('dashboard.widgetTitle')"
              :rules="[required]"
              maxlength="128"
            />
            <SaplingFieldSingleSelect
              v-if="kind === 'KPI'"
              v-model="kpi"
              entity-handle="kpi"
              :parent-filter="{ type: { $ne: 'CALENDAR' } }"
              :label="$t('navigation.kpi')"
              :rules="[required]"
            />
            <SaplingFieldSingleSelect
              v-if="kind === 'TABLE'"
              v-model="entity"
              entity-handle="entity"
              :parent-filter="{ handle: { $in: allowedEntityHandles } }"
              :label="$t('dashboard.widgetEntity')"
              :rules="[required]"
            />
            <template v-if="(kind === 'TABLE' || kind === 'AGENDA') && entityHandle">
              <SaplingFieldSingleSelect
                v-model="favorite"
                entity-handle="favorite"
                :additional-list-projection-fields="['filter', 'search', 'sortBy']"
                default-current-person-filter
                :parent-filter="{ entity: entityHandle }"
                :label="$t('dashboard.widgetWorklist')"
              />
              <p class="text-body-2">{{ $t('dashboard.widgetWorklistHint') }}</p>
              <v-btn variant="text" @click="resetFilters">{{
                $t('dashboard.resetWidgetFilters')
              }}</v-btn>
            </template>
            <template v-if="kind === 'AGENDA'">
              <SaplingFieldSingleSelect
                v-model="status"
                entity-handle="eventStatus"
                :label="$t('event.status')"
              />
              <SaplingTextField
                v-model.number="days"
                type="number"
                :label="$t('dashboard.widgetDays')"
                :rules="[rangeRule(1, 365)]"
              />
              <SaplingTextField
                v-model.number="limit"
                type="number"
                :label="$t('dashboard.widgetLimit')"
                :rules="[rangeRule(1, 50)]"
              />
            </template>
            <template v-if="kind === 'TABLE' && entityHandle">
              <v-select
                v-model="selectedColumns"
                :items="columnOptions"
                multiple
                chips
                clearable
                :label="$t('dashboard.widgetColumns')"
              />
              <v-select
                :model-value="sortBy[0]?.key"
                :items="columnOptions"
                clearable
                :label="$t('dashboard.widgetSort')"
                @update:model-value="
                  sortBy = $event ? [{ key: $event, order: sortBy[0]?.order ?? 'asc' }] : []
                "
              />
              <v-select
                v-if="sortBy.length"
                v-model="sortBy[0]!.order"
                :items="[
                  { value: 'asc', title: $t('dashboard.widgetAscending') },
                  { value: 'desc', title: $t('dashboard.widgetDescending') },
                ]"
                :label="$t('dashboard.widgetDirection')"
              />
              <SaplingTextField v-model="search" :label="$t('global.search')" maxlength="256" />
              <SaplingTextField
                v-model.number="pageSize"
                type="number"
                :label="$t('dashboard.widgetPageSize')"
                :rules="[rangeRule(1, 100)]"
              />
            </template>
            <template v-if="kind === 'WEBSITE'">
              <SaplingTextField
                v-model="url"
                :label="$t('dashboard.widgetUrl')"
                :rules="[urlRule]"
                maxlength="2048"
              />
              <v-select
                v-model="mode"
                :items="[
                  { value: 'link', title: $t('dashboard.widgetLink') },
                  { value: 'embed', title: $t('dashboard.widgetEmbed') },
                ]"
                :label="$t('dashboard.widgetDisplay')"
              />
              <p v-if="mode === 'embed'" class="text-body-2">
                {{ $t('dashboard.widgetEmbedHint') }}
              </p>
            </template>
            <SaplingFieldMarkdown
              v-if="kind === 'NOTE'"
              v-model="markdown"
              :label="$t('dashboard.widgetNoteContent')"
              :maxlength="20000"
            />
            <SaplingWidgetActionsEditor v-if="kind === 'ACTIONS'" v-model="actions" />
            <div class="sapling-two-column-grid">
              <v-select
                v-model="columns"
                :items="[1, 2, 3, 4]"
                :label="$t('dashboard.widgetWidth')"
                :rules="[spanRule]"
              />
              <v-select
                v-model="rows"
                :items="[1, 2, 3, 4]"
                :label="$t('dashboard.widgetHeight')"
                :rules="[spanRule]"
              />
            </div>
          </v-form>
        </template>
        <template #actions
          ><SaplingActionSave :cancel="close" :save="save" :busy="busy" :save-loading="busy"
        /></template>
      </SaplingDialogShell>
    </SaplingDialogCard>
  </SaplingDialog>
</template>
<script setup lang="ts">
import SaplingTextField from '@/components/common/SaplingTextField.vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DashboardWidget } from '@/entity/dashboard-widget.types'
import { useSaplingWidgetDialog } from '@/composables/dashboard/useSaplingWidgetDialog'
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingDialogShell from '@/components/common/SaplingDialogShell.vue'
import SaplingDialogHero from '@/components/common/SaplingDialogHero.vue'
import SaplingActionSave from '@/components/actions/SaplingActionSave.vue'
import SaplingFieldSingleSelect from '@/components/dialog/fields/SaplingFieldSingleSelect.vue'
import SaplingFieldMarkdown from '@/components/dialog/fields/SaplingFieldMarkdown.vue'
import SaplingWidgetActionsEditor from './SaplingWidgetActionsEditor.vue'
const props = defineProps<{ widget: DashboardWidget | null; busy: boolean }>()
const emit = defineEmits<{
  (event: 'close'): void
  (event: 'save', widget: DashboardWidget): void
}>()
const { t } = useI18n()
const form = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null)
const {
  kind,
  title,
  columns,
  rows,
  kpi,
  entity,
  favorite,
  status,
  selectedColumns,
  sortBy,
  search,
  pageSize,
  days,
  limit,
  url,
  mode,
  markdown,
  actions,
  entityHandle,
  allowedEntityHandles,
  columnOptions,
  kindOptions,
  required,
  urlRule,
  spanRule,
  resetFilters,
  build,
} = useSaplingWidgetDialog(props.widget)
const rangeRule = (min: number, max: number) => (value: unknown) =>
  (Number.isInteger(Number(value)) && Number(value) >= min && Number(value) <= max) ||
  t('dashboard.widgetNumberInvalid', { min, max })
function close() {
  if (!props.busy) emit('close')
}
async function save() {
  if (!props.busy && (await form.value?.validate())?.valid) emit('save', build())
}
</script>
