<template>
  <v-menu v-if="hasChildren" submenu open-on-hover>
    <template #activator="{ props: activatorProps }">
      <v-list-item
        v-bind="activatorProps"
        :prepend-icon="menuItem.icon"
        :title="resolvedTitle"
        append-icon="mdi-chevron-right"
        :disabled="disabled"
      />
    </template>

    <v-list class="sapling-record-action-menu-list glass-panel" min-width="220">
      <SaplingRecordActionMenuItem
        v-for="(child, index) in menuItem.children"
        :key="getChildKey(child, index)"
        :menu-item="child"
        :disabled="disabled"
        @select="emit('select', $event)"
      />
    </v-list>
  </v-menu>

  <v-list-item
    v-else
    :prepend-icon="menuItem.icon"
    :title="resolvedTitle"
    :disabled="disabled"
    @click="onSelect"
  />
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SaplingContextMenuTableMenuItem } from '@/composables/context/useSaplingContextMenuTable'

defineOptions({ name: 'SaplingRecordActionMenuItem' })

const props = withDefaults(
  defineProps<{
    menuItem: SaplingContextMenuTableMenuItem
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{
  select: [menuItem: SaplingContextMenuTableMenuItem]
}>()

const { t, te } = useI18n()
const hasChildren = computed(() => (props.menuItem.children?.length ?? 0) > 0)
const resolvedTitle = computed(() => {
  if (props.menuItem.titleKey) {
    return t(props.menuItem.titleKey)
  }
  if (!props.menuItem.title) {
    return ''
  }
  return te(props.menuItem.title) ? t(props.menuItem.title) : props.menuItem.title
})

function getChildKey(child: SaplingContextMenuTableMenuItem, index: number): string {
  return `${index}-${child.type}-${String(
    child.mailAction?.email ?? child.titleKey ?? child.title ?? '',
  )}`
}

function onSelect(event: MouseEvent | KeyboardEvent): void {
  event.stopPropagation()
  emit('select', props.menuItem)
}
</script>
