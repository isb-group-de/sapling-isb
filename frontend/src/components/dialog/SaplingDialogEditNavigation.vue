<template>
  <nav
    class="sapling-record-dialog-nav sapling-dialog-edit-nav"
    :aria-label="entityLabel"
    role="tablist"
  >
    <button
      class="sapling-record-dialog-nav-item sapling-dialog-edit-nav-item"
      :class="{
        'sapling-record-dialog-nav-item--active': activeTab === 0,
        'sapling-record-dialog-nav-item--record': true,
      }"
      type="button"
      :id="tabId(0)"
      role="tab"
      :aria-controls="panelId(0)"
      :aria-selected="activeTab === 0"
      :tabindex="activeTab === 0 ? 0 : -1"
      :aria-current="activeTab === 0 ? 'page' : undefined"
      @click="activeTab = 0"
      @keydown="onTabKeydown($event, 0)"
    >
      <v-icon class="sapling-record-dialog-nav-item__icon" size="18">
        mdi-file-document-edit-outline
      </v-icon>
      <span class="sapling-record-dialog-nav-item__label">{{ entityLabel }}</span>
    </button>
    <template v-if="mode !== 'create'">
      <button
        v-for="(template, idx) in relationTemplates"
        :key="template.name"
        class="sapling-record-dialog-nav-item sapling-dialog-edit-nav-item"
        :class="[
          relationKindClass(template),
          {
            'sapling-record-dialog-nav-item--active': activeTab === idx + 1,
          },
        ]"
        type="button"
        :id="tabId(idx + 1)"
        role="tab"
        :aria-controls="panelId(idx + 1)"
        :aria-selected="activeTab === idx + 1"
        :tabindex="activeTab === idx + 1 ? 0 : -1"
        :aria-current="activeTab === idx + 1 ? 'page' : undefined"
        :aria-label="
          relationKindLabel(template)
            ? $t(`${entityHandle}.${template.name}`) + ' (' + relationKindLabel(template) + ')'
            : $t(`${entityHandle}.${template.name}`)
        "
        :title="relationKindLabel(template)"
        @click="activeTab = idx + 1"
        @keydown="onTabKeydown($event, idx + 1)"
      >
        <v-icon class="sapling-record-dialog-nav-item__icon" size="18">
          {{ relationIcon(template) }}
        </v-icon>
        <span class="sapling-record-dialog-nav-item__label">
          {{ $t(`${entityHandle}.${template.name}`) }}
        </span>
        <span
          v-if="relationKindLabel(template)"
          class="sapling-record-dialog-nav-item__relation-type"
          aria-hidden="true"
        >
          {{ relationKindLabel(template) }}
        </span>
      </button>
    </template>
  </nav>
</template>

<script lang="ts" setup>
import type { DialogState, EntityTemplate } from '@/entity/structure'
import type { EntityItem } from '@/entity/entity'

const props = defineProps<{
  entityHandle: string
  entityLabel: string
  mode: DialogState
  relationTemplates: EntityTemplate[]
  relationEntities?: Record<string, EntityItem | null>
  tabIdPrefix?: string
}>()

const activeTab = defineModel<number>('activeTab', { required: true })

function tabId(index: number): string {
  return `${props.tabIdPrefix || `sapling-record-dialog-${props.entityHandle}`}-tab-${index}`
}

function panelId(index: number): string {
  return `${props.tabIdPrefix || `sapling-record-dialog-${props.entityHandle}`}-panel-${index}`
}

function onTabKeydown(event: KeyboardEvent, currentIndex: number): void {
  const tabCount = props.mode === 'create' ? 1 : props.relationTemplates.length + 1
  let nextIndex: number | null = null

  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      nextIndex = (currentIndex + 1) % tabCount
      break
    case 'ArrowUp':
    case 'ArrowLeft':
      nextIndex = (currentIndex - 1 + tabCount) % tabCount
      break
    case 'Home':
      nextIndex = 0
      break
    case 'End':
      nextIndex = tabCount - 1
      break
  }

  if (nextIndex === null) {
    return
  }

  event.preventDefault()
  activeTab.value = nextIndex
  const tabs = (
    event.currentTarget as HTMLElement | null
  )?.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]')
  tabs?.[nextIndex]?.focus()
}

function relationKindLabel(template: EntityTemplate): string {
  if (template.kind === '1:m') {
    return '1:m'
  }

  if (template.kind === 'm:n' || template.kind === 'n:m') {
    return 'm:n'
  }

  return ''
}

function relationKindClass(template: EntityTemplate): string {
  if (template.kind === '1:m') {
    return 'sapling-record-dialog-nav-item--one-to-many'
  }

  if (template.kind === 'm:n' || template.kind === 'n:m') {
    return 'sapling-record-dialog-nav-item--many-to-many'
  }

  return ''
}

function relationIcon(template: EntityTemplate): string {
  return props.relationEntities?.[template.name]?.icon?.trim() || 'mdi-link-variant'
}
</script>
