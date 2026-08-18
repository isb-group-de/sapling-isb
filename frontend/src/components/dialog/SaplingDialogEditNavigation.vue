<template>
  <nav
    class="sapling-record-dialog-nav sapling-dialog-edit-nav"
    :aria-label="entityLabel"
    role="tablist"
  >
    <p
      v-if="relationsLocked"
      :id="lockedRelationsHintId"
      class="sapling-dialog-edit-nav__locked-hint"
    >
      <v-icon size="16" aria-hidden="true">mdi-lock-outline</v-icon>
      <span>{{ $t('global.referencesAvailableAfterSave') }}</span>
    </p>
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
    <button
      v-for="(template, idx) in relationTemplates"
      :key="template.name"
      class="sapling-record-dialog-nav-item sapling-dialog-edit-nav-item"
      :class="[
        relationKindClass(template),
        {
          'sapling-record-dialog-nav-item--active': !relationsLocked && activeTab === idx + 1,
          'sapling-record-dialog-nav-item--locked': relationsLocked,
        },
      ]"
      type="button"
      :id="tabId(idx + 1)"
      role="tab"
      :aria-controls="panelId(idx + 1)"
      :aria-selected="!relationsLocked && activeTab === idx + 1"
      :aria-disabled="relationsLocked ? 'true' : undefined"
      :aria-describedby="relationsLocked ? lockedRelationsHintId : undefined"
      :tabindex="relationsLocked ? -1 : activeTab === idx + 1 ? 0 : -1"
      :aria-current="!relationsLocked && activeTab === idx + 1 ? 'page' : undefined"
      :aria-label="relationAriaLabel(template)"
      :title="
        relationsLocked ? $t('global.referencesAvailableAfterSave') : relationKindLabel(template)
      "
      @click="selectRelationTab(idx + 1)"
      @keydown="onTabKeydown($event, idx + 1)"
    >
      <v-icon class="sapling-record-dialog-nav-item__icon" size="18">
        {{ relationIcon(template) }}
      </v-icon>
      <span class="sapling-record-dialog-nav-item__label">
        {{ $t(`${entityHandle}.${template.name}`) }}
      </span>
      <span class="sapling-record-dialog-nav-item__meta">
        <span
          v-if="relationKindLabel(template)"
          class="sapling-record-dialog-nav-item__relation-type"
          aria-hidden="true"
        >
          {{ relationKindLabel(template) }}
        </span>
        <v-icon
          v-if="relationsLocked"
          class="sapling-record-dialog-nav-item__lock"
          size="15"
          aria-hidden="true"
        >
          mdi-lock-outline
        </v-icon>
      </span>
    </button>
  </nav>
</template>

<script lang="ts" setup>
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
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
const { t } = useI18n()
const relationsLocked = computed(
  () => props.mode === 'create' && props.relationTemplates.length > 0,
)
const lockedRelationsHintId = `${props.tabIdPrefix || `sapling-record-dialog-${props.entityHandle}`}-relations-locked-hint`

watch(
  [relationsLocked, activeTab],
  ([locked, currentTab]) => {
    if (locked && currentTab !== 0) {
      activeTab.value = 0
    }
  },
  { immediate: true },
)

function tabId(index: number): string {
  return `${props.tabIdPrefix || `sapling-record-dialog-${props.entityHandle}`}-tab-${index}`
}

function panelId(index: number): string {
  return `${props.tabIdPrefix || `sapling-record-dialog-${props.entityHandle}`}-panel-${index}`
}

function onTabKeydown(event: KeyboardEvent, currentIndex: number): void {
  if (relationsLocked.value && currentIndex > 0) {
    return
  }

  const tabCount = relationsLocked.value ? 1 : props.relationTemplates.length + 1
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

function selectRelationTab(index: number): void {
  if (relationsLocked.value) {
    return
  }

  activeTab.value = index
}

function relationAriaLabel(template: EntityTemplate): string {
  const translatedLabel = String(t(`${props.entityHandle}.${template.name}`))
  const kind = relationKindLabel(template)
  const relationLabel = kind ? `${translatedLabel} (${kind})` : translatedLabel

  return relationsLocked.value
    ? `${relationLabel}. ${String(t('global.referencesAvailableAfterSave'))}`
    : relationLabel
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
