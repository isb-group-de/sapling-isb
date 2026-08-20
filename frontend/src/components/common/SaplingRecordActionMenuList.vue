<template>
  <v-list class="sapling-record-action-menu-list glass-panel">
    <template v-for="(group, groupIdx) in visibleMenuItems" :key="`group-${groupIdx}`">
      <SaplingRecordActionMenuItem
        v-for="(menuItem, itemIdx) in group"
        :key="getMenuItemKey(menuItem, groupIdx, itemIdx)"
        :menu-item="menuItem"
        @select="emit('select', $event)"
      />
      <v-divider v-if="groupIdx < visibleMenuItems.length - 1" :key="`divider-${groupIdx}`" />
    </template>

    <v-list-item
      v-if="showCloseItem"
      prepend-icon="mdi-close"
      :title="$t('global.close')"
      @click="onClose"
    />
  </v-list>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import type {
  SaplingContextMenuTableMenuEntry,
  SaplingContextMenuTableMenuItem,
} from '@/composables/context/useSaplingContextMenuTable'
import SaplingRecordActionMenuItem from '@/components/common/SaplingRecordActionMenuItem.vue'

const props = withDefaults(
  defineProps<{
    menuItems: SaplingContextMenuTableMenuEntry[]
    showCloseItem?: boolean
    showEdit?: boolean
  }>(),
  {
    showCloseItem: false,
    showEdit: true,
  },
)

const emit = defineEmits<{
  select: [menuItem: SaplingContextMenuTableMenuItem]
  close: []
}>()

const visibleMenuItems = computed<SaplingContextMenuTableMenuItem[][]>(() =>
  props.menuItems
    .map((group) => (Array.isArray(group) ? group : [group]))
    .map((group) =>
      group.filter(
        (menuItem) => props.showEdit !== false || !['edit', 'show'].includes(menuItem.type),
      ),
    )
    .filter((group) => group.length > 0),
)

function getMenuItemKey(
  menuItem: SaplingContextMenuTableMenuItem,
  groupIdx: number,
  itemIdx: number,
): string {
  return `${groupIdx}-${itemIdx}-${menuItem.type}-${String(
    menuItem.scriptButton?.handle ??
      menuItem.scriptButton?.name ??
      menuItem.mailAction?.email ??
      menuItem.titleKey ??
      menuItem.title ??
      '',
  )}`
}

function onClose(event: MouseEvent | KeyboardEvent): void {
  event.stopPropagation()
  emit('close')
}
</script>
