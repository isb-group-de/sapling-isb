<template>
  <!-- Table row for entity table, modularized for reuse and clarity -->
  <tr
    :data-tutorial="index === 0 ? 'table-first-row' : undefined"
    class="sapling-table-row"
    :class="{
      'active-row': props.isActive,
      'selected-row': !props.multiSelect && props.isSelected,
      'multi-selected-row': props.multiSelect && props.isSelected,
    }"
    tabindex="0"
    :aria-label="rowLabel"
    @mousedown="onRowMouseDown($event, index)"
    @dblclick="onRowDoubleClick($event)"
    @keydown="onRowKeydown($event, index)"
    @contextmenu.prevent="openContextMenu($event, item, index)"
  >
    <!-- Multi-select checkbox cell -->
    <td
      v-if="multiSelect && columns[0]?.key === '__select'"
      class="select-cell sapling-table-row__select-cell"
    >
      <v-checkbox
        class="sapling-table-selection-checkbox"
        :model-value="props.isSelected"
        hide-details
        density="compact"
        @update:model-value="toggleRowSelection(index)"
        @click.stop
      />
    </td>
    <!-- Render all other columns except actions -->
    <template v-for="col in columns" :key="col.key ?? ''">
      <td
        v-if="col.key !== '__actions' && col.key !== '__select'"
        :class="getColumnCellClass(col)"
        :data-tutorial="getCellTutorialTarget(col)"
      >
        <div v-if="'options' in col && col.options?.includes('isChip')">
          <SaplingTableChip
            :item="item"
            :col="col"
            :reference-templates="getReferenceTemplates(col.referenceName)"
          />
        </div>
        <SaplingTableGenericReference
          v-else-if="isGenericReferenceTemplate(col)"
          :item="item"
          :col="col"
        />
        <!-- Expansion panel for m:1 columns (object value) -->
        <div v-else-if="isReferenceColumn(col)">
          <template v-if="!canReadReferenceColumn(col)">
            <div></div>
          </template>
          <template v-else-if="item[col.key || ''] && !isReferenceLoading(col)">
            <v-btn
              size="small"
              @click.stop="openDialogForCol(col.key || '')"
              :loading="isDialogLoadingForCol(col.key || '')"
              :rounded="false"
              :max-height="32"
              class="glass-panel sapling-button-truncate"
            >
              <v-icon class="pr-3" left>mdi-eye</v-icon>
              <span
                v-if="getCompactPanelTitleLines(col.key || '').length > 0"
                class="sapling-table-reference-label sapling-button-truncate__label"
              >
                <span
                  v-for="line in getCompactPanelTitleLines(col.key || '')"
                  :key="`${line.isReference}:${line.value}`"
                  class="sapling-table-reference-label__line"
                  :class="{
                    'sapling-table-reference-label__line--reference': line.isReference,
                  }"
                >
                  {{ line.value }}
                </span>
              </span>
            </v-btn>
            <SaplingDialogEdit
              v-if="isDialogOpenForCol(col.key || '')"
              :model-value="isDialogOpenForCol(col.key || '')"
              :mode="getReferenceDialogMode(col.referenceName)"
              :item="getDialogItemForCol(col.key || '')"
              :entity="getReferenceEntity(col.referenceName)"
              :templates="getReferenceTemplates(col.referenceName)"
              :show-reference="true"
              @update:model-value="closeDialogForCol(col.key || '')"
              @save="
                (value, action, context) => saveDialogForCol(col.key || '', value, action, context)
              "
              @update:item="onDialogItemUpdate(col.key || '', $event)"
              @deleted="onDialogRecordDeleted(col.key || '')"
            />
          </template>
          <template v-else-if="!isReferenceLoading(col)">
            <div></div>
          </template>
          <template v-else>
            <v-skeleton-loader type="table-row" class="glass-panel" width="100%" />
          </template>
        </div>
        <SaplingCellBoolean
          v-else-if="typeof item[col.key || ''] === 'boolean'"
          :value="item[col.key || '']"
        />
        <SaplingCellColor
          v-else-if="'options' in col && col.options?.includes('isColor')"
          :value="item[col.key]"
        />
        <SaplingCellMoney
          v-else-if="'options' in col && col.options?.includes('isMoney')"
          :value="
            typeof item[col.key] !== 'undefined' && item[col.key] !== null ? item[col.key] : 0
          "
        />
        <SaplingCellIcon
          v-else-if="'options' in col && col.options?.includes('isIcon')"
          :value="item[col.key]"
        />
        <SaplingCellPercent
          v-else-if="'options' in col && col.options?.includes('isPercent')"
          :value="item[col.key]"
        />
        <SaplingCellPhone
          v-else-if="'options' in col && col.options?.includes('isPhone')"
          :value="item[col.key] != null ? String(item[col.key]) : ''"
          :entity-handle="props.entityHandle"
          :item-handle="item.handle"
          :item="item"
          :entity-templates="props.entityTemplates"
        >
          {{ formatPhoneNumber(item[col.key] != null ? String(item[col.key]) : '') }}
        </SaplingCellPhone>
        <SaplingCellMail
          v-else-if="'options' in col && col.options?.includes('isMail')"
          :value="item[col.key] != null ? String(item[col.key]) : ''"
          :entity-handle="props.entityHandle"
          :item-handle="item.handle"
          :item="item"
          :entity-templates="props.entityTemplates"
          :can-compose="props.entityPermission?.allowUpdate === true"
        >
          {{
            formatValue(
              item[col.key] != null ? String(item[col.key]) : '',
              (col as { type?: string }).type,
            )
          }}
        </SaplingCellMail>
        <SaplingCellLink
          v-else-if="'options' in col && col.options?.includes('isLink')"
          :value="item[col.key] != null ? String(item[col.key]) : ''"
          :href="formatLink(item[col.key] != null ? String(item[col.key]) : '')"
        >
          {{
            formatValue(
              item[col.key] != null ? String(item[col.key]) : '',
              (col as { type?: string }).type,
            )
          }}
        </SaplingCellLink>
        <SaplingCellDateTime
          v-else-if="isDateTimeColumn(col)"
          :value="getCellValue(item, col.key)"
          :date-value="getCellValue(item, `${String(col.key ?? '')}_date`)"
          :time-value="getCellValue(item, `${String(col.key ?? '')}_time`)"
          :is-deadline="'options' in col && col.options?.includes('isDeadline')"
        />
        <SaplingCellDate
          v-else-if="isDateColumn(col)"
          :value="getCellValue(item, col.key)"
          :is-deadline="'options' in col && col.options?.includes('isDeadline')"
        />
        <SaplingCellTime v-else-if="isTimeColumn(col)" :value="getCellValue(item, col.key)" />
        <SaplingTableJson
          v-else-if="col.type === 'JsonType'"
          :item="item"
          :template="col"
          :entityHandle="props.entityHandle"
        />
        <SaplingCellDefault
          v-else
          :value="
            formatValue(
              item[col.key] != null ? String(item[col.key]) : '',
              (col as { type?: string }).type,
            )
          "
        />
      </td>
    </template>
    <!-- Actions cell at the end of the row -->
    <td
      v-if="showActions && hasActionsColumn && hasActionMenuItems"
      class="actions-cell sapling-table-row__actions-cell"
    >
      <v-menu
        v-model="menuActive"
        content-class="sapling-record-action-menu__content"
        location="bottom end"
        location-strategy="connected"
        max-height="var(--sapling-record-action-menu-max-height)"
      >
        <template #activator="{ props: menuProps }">
          <v-btn
            data-tutorial="table-row-actions"
            class="glass-panel sapling-table-row__actions-button"
            v-bind="menuProps"
            icon="mdi-dots-vertical"
            size="small"
            :title="$t('global.more')"
            :aria-label="$t('global.more')"
            @click.stop
            :rounded="false"
            :max-height="32"
          ></v-btn>
        </template>
        <SaplingRecordActionMenuList
          v-if="menuActive"
          data-tutorial="table-row-menu"
          class="glass-panel"
          :menu-items="rowMenuItems"
          :show-close-item="true"
          :show-edit="true"
          @select="onMenuItemClick"
          @close="closeMenu"
        />
      </v-menu>
    </td>
  </tr>
</template>

<script lang="ts" setup>
// #region Imports
import { computed } from 'vue'
import type { SaplingContextMenuTableMenuItem } from '@/composables/context/useSaplingContextMenuTable'
import type { SaplingTableHeaderItem } from '@/entity/structure'
import SaplingRecordActionMenuList from '@/components/common/SaplingRecordActionMenuList.vue'
import SaplingDialogEdit from '@/components/dialog/SaplingDialogEdit.vue'
import SaplingTableJson from '@/components/table/SaplingTableJson.vue'
import SaplingTableChip from '@/components/table/SaplingTableChip.vue'
import SaplingTableGenericReference from '@/components/table/SaplingTableGenericReference.vue'
import { useSaplingPhoneNumber } from '@/composables/phone/useSaplingPhoneNumber'
import { formatValue } from '@/utils/saplingFormatUtil'
import { isGenericReferenceTemplate } from '@/utils/saplingTableUtil'
import {
  useSaplingTableRow,
  type UseSaplingTableRowEmit,
  type UseSaplingTableRowProps,
} from '@/composables/table/useSaplingTableRow'
import SaplingCellBoolean from './cells/SaplingCellBoolean.vue'
import SaplingCellColor from './cells/SaplingCellColor.vue'
import SaplingCellMoney from './cells/SaplingCellMoney.vue'
import SaplingCellIcon from './cells/SaplingCellIcon.vue'
import SaplingCellPhone from './cells/SaplingCellPhone.vue'
import SaplingCellMail from './cells/SaplingCellMail.vue'
import SaplingCellLink from './cells/SaplingCellLink.vue'
import SaplingCellDefault from './cells/SaplingCellDefault.vue'
import SaplingCellPercent from './cells/SaplingCellPercent.vue'
import SaplingCellDate from './cells/SaplingCellDate.vue'
import SaplingCellTime from './cells/SaplingCellTime.vue'
import SaplingCellDateTime from './cells/SaplingCellDateTime.vue'
// #endregion

// #region Props and Emits
const props = defineProps<UseSaplingTableRowProps>()
const emit = defineEmits<UseSaplingTableRowEmit>()

function getCellTutorialTarget(column: SaplingTableHeaderItem) {
  if (props.index !== 0 || !('options' in column)) {
    return undefined
  }

  if (column.options?.includes('isPhone') || column.options?.includes('isMail')) {
    return 'table-contact-cell'
  }

  if (isReferenceColumn(column)) {
    return 'table-reference-cell'
  }

  return undefined
}
// #endregion

// #region Composable
const {
  menuActive,
  rowMenuItems,
  hasActionsColumn,
  hasActionMenuItems,
  openContextMenu,
  onRowMouseDown,
  onRowDoubleClick,
  onRowKeydown,
  openDialogForCol,
  closeDialogForCol,
  isDialogOpenForCol,
  getDialogItemForCol,
  isDialogLoadingForCol,
  getReferenceDialogMode,
  saveDialogForCol,
  onDialogItemUpdate,
  onDialogRecordDeleted,
  closeMenu,
  requestEdit,
  requestChangeLog,
  requestShow,
  requestDelete,
  requestCopy,
  requestScript,
  requestNavigate,
  requestTimeline,
  requestUploadDocument,
  requestShowDocuments,
  requestShowInformation,
  requestShowExternalRecordLinks,
  requestCustomer360,
  requestMail,
  getReferenceTemplates,
  getReferenceEntity,
  isReferenceColumn,
  canReadReferenceColumn,
  isReferenceLoading,
  getCompactPanelTitleLines,
  isDateTimeColumn,
  isDateColumn,
  isTimeColumn,
  getCellValue,
  toggleRowSelection,
  getColumnCellClass,
  formatLink,
} = useSaplingTableRow(props, emit)
const { formatPhoneNumber } = useSaplingPhoneNumber()

const rowLabel = computed(() => {
  const firstReadableColumn = props.columns.find(
    (column) => column.key && column.key !== '__actions' && column.key !== '__select',
  )
  const value = firstReadableColumn?.key ? props.item[firstReadableColumn.key] : undefined
  return value == null || value === '' ? String(props.index + 1) : String(value)
})

function onMenuItemClick(menuItem: SaplingContextMenuTableMenuItem) {
  switch (menuItem.type) {
    case 'edit':
      requestEdit(props.item)
      break
    case 'changeLog':
      requestChangeLog(props.item)
      break
    case 'show':
      requestShow(props.item)
      break
    case 'delete':
      requestDelete(props.item)
      break
    case 'copy':
      requestCopy(props.item)
      break
    case 'customer360':
      requestCustomer360(props.item)
      break
    case 'navigate':
      requestNavigate(props.item)
      break
    case 'timeline':
      requestTimeline(props.item)
      break
    case 'uploadDocument':
      requestUploadDocument(props.item)
      break
    case 'showDocuments':
      requestShowDocuments(props.item)
      break
    case 'showInformation':
      requestShowInformation(props.item)
      break
    case 'showExternalRecordLinks':
      requestShowExternalRecordLinks(props.item)
      break
    case 'mail':
      if (menuItem.mailAction) {
        requestMail(props.item, menuItem.mailAction.email)
      }
      break
    case 'script':
      if (menuItem.scriptButton) {
        requestScript(props.item, menuItem.scriptButton)
      }
      break
    default:
      closeMenu()
      break
  }
}
// #endregion
</script>
