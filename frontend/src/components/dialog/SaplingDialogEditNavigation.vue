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
        'sapling-record-dialog-nav-item--dirty': isRecordDirty,
      }"
      type="button"
      :id="tabId(0)"
      role="tab"
      :aria-controls="panelId(0)"
      :aria-selected="activeTab === 0"
      :tabindex="activeTab === 0 ? 0 : -1"
      :aria-current="activeTab === 0 ? 'page' : undefined"
      :aria-label="recordAriaLabel"
      @click="activeTab = 0"
      @keydown="onTabKeydown($event, 0)"
    >
      <v-icon class="sapling-record-dialog-nav-item__icon" size="18">
        mdi-file-document-edit-outline
      </v-icon>
      <span class="sapling-record-dialog-nav-item__label">{{ entityLabel }}</span>
      <span v-if="isRecordDirty" class="sapling-record-dialog-nav-item__meta">
        <span class="sapling-record-dialog-nav-item__dirty-indicator" aria-hidden="true" />
      </span>
    </button>
    <button
      v-for="(template, idx) in relationTemplates"
      :key="template.name"
      class="sapling-record-dialog-nav-item sapling-dialog-edit-nav-item"
      :class="{
        'sapling-record-dialog-nav-item--active': !relationsLocked && activeTab === idx + 1,
        'sapling-record-dialog-nav-item--locked': relationsLocked,
        'sapling-record-dialog-nav-item--dirty': isRelationDirty(template),
      }"
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
      :title="relationsLocked ? $t('global.referencesAvailableAfterSave') : undefined"
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
        <v-icon
          v-if="relationsLocked"
          class="sapling-record-dialog-nav-item__lock"
          size="15"
          aria-hidden="true"
        >
          mdi-lock-outline
        </v-icon>
        <span
          v-if="isRelationDirty(template)"
          class="sapling-record-dialog-nav-item__dirty-indicator"
          aria-hidden="true"
        />
      </span>
    </button>
    <button
      v-for="(tab, supplementalIndex) in supplementalTabs"
      :key="tab.value"
      class="sapling-record-dialog-nav-item sapling-dialog-edit-nav-item sapling-record-dialog-nav-item--supplemental"
      :class="{
        'sapling-record-dialog-nav-item--active': !tab.disabled && activeTab === tab.value,
        'sapling-record-dialog-nav-item--locked': tab.disabled,
        'sapling-record-dialog-nav-item--supplemental-first': supplementalIndex === 0,
      }"
      type="button"
      :id="tabId(tab.value)"
      role="tab"
      :aria-controls="panelId(tab.value)"
      :aria-selected="!tab.disabled && activeTab === tab.value"
      :aria-disabled="tab.disabled ? 'true' : undefined"
      :tabindex="!tab.disabled && activeTab === tab.value ? 0 : -1"
      :aria-current="!tab.disabled && activeTab === tab.value ? 'page' : undefined"
      :aria-label="supplementalAriaLabel(tab)"
      :title="tab.disabled ? tab.disabledReason : tab.label"
      @click="selectSupplementalTab(tab)"
      @keydown="onTabKeydown($event, tab.value)"
    >
      <v-icon class="sapling-record-dialog-nav-item__icon" size="18">
        {{ tab.icon }}
      </v-icon>
      <span class="sapling-record-dialog-nav-item__label">{{ tab.label }}</span>
      <span v-if="tab.disabled" class="sapling-record-dialog-nav-item__meta">
        <v-icon class="sapling-record-dialog-nav-item__lock" size="15" aria-hidden="true">
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

interface SupplementalTab {
  value: number
  label: string
  icon: string
  disabled?: boolean
  disabledReason?: string
}

const props = defineProps<{
  entityHandle: string
  entityLabel: string
  mode: DialogState
  relationTemplates: EntityTemplate[]
  relationEntities?: Record<string, EntityItem | null>
  tabIdPrefix?: string
  relationsLocked?: boolean
  dirtyFieldCount?: number
  dirtyRelationNames?: string[]
  supplementalTabs?: SupplementalTab[]
}>()

const activeTab = defineModel<number>('activeTab', { required: true })
const { t } = useI18n()
const relationsLocked = computed(
  () => props.relationsLocked === true && props.relationTemplates.length > 0,
)
const isRecordDirty = computed(() => (props.dirtyFieldCount ?? 0) > 0)
const recordAriaLabel = computed(() =>
  isRecordDirty.value
    ? `${props.entityLabel}. ${String(
        t(
          'global.dirtyFieldCount',
          { count: props.dirtyFieldCount ?? 0 },
          props.dirtyFieldCount ?? 0,
        ),
      )}`
    : props.entityLabel,
)
const lockedRelationsHintId = `${props.tabIdPrefix || `sapling-record-dialog-${props.entityHandle}`}-relations-locked-hint`

const supplementalTabs = computed(() => props.supplementalTabs ?? [])
const enabledTabValues = computed(() => [
  0,
  ...(relationsLocked.value
    ? []
    : props.relationTemplates.map((_, relationIndex) => relationIndex + 1)),
  ...supplementalTabs.value.filter((tab) => !tab.disabled).map((tab) => tab.value),
])

watch(
  [enabledTabValues, activeTab],
  ([enabledValues, currentTab]) => {
    if (!enabledValues.includes(currentTab)) {
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
  const currentPosition = enabledTabValues.value.indexOf(currentIndex)
  if (currentPosition < 0) {
    return
  }

  let nextPosition: number | null = null

  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      nextPosition = (currentPosition + 1) % enabledTabValues.value.length
      break
    case 'ArrowUp':
    case 'ArrowLeft':
      nextPosition =
        (currentPosition - 1 + enabledTabValues.value.length) % enabledTabValues.value.length
      break
    case 'Home':
      nextPosition = 0
      break
    case 'End':
      nextPosition = enabledTabValues.value.length - 1
      break
  }

  if (nextPosition === null) {
    return
  }

  event.preventDefault()
  activeTab.value = enabledTabValues.value[nextPosition] ?? 0
  const enabledTabs = (
    event.currentTarget as HTMLElement | null
  )?.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]:not([aria-disabled="true"])')
  enabledTabs?.[nextPosition]?.focus()
}

function selectRelationTab(index: number): void {
  if (relationsLocked.value) {
    return
  }

  activeTab.value = index
}

function selectSupplementalTab(tab: SupplementalTab): void {
  if (tab.disabled) {
    return
  }

  activeTab.value = tab.value
}

function supplementalAriaLabel(tab: SupplementalTab): string {
  return tab.disabled && tab.disabledReason ? `${tab.label}. ${tab.disabledReason}` : tab.label
}

function relationAriaLabel(template: EntityTemplate): string {
  const translatedLabel = String(t(`${props.entityHandle}.${template.name}`))
  const accessibleLabel = isRelationDirty(template)
    ? `${translatedLabel}. ${String(t('global.dirtyFieldCount', { count: 1 }, 1))}`
    : translatedLabel

  return relationsLocked.value
    ? `${accessibleLabel}. ${String(t('global.referencesAvailableAfterSave'))}`
    : accessibleLabel
}

function isRelationDirty(template: EntityTemplate): boolean {
  return props.dirtyRelationNames?.includes(template.name) ?? false
}

function relationIcon(template: EntityTemplate): string {
  return props.relationEntities?.[template.name]?.icon?.trim() || 'mdi-link-variant'
}
</script>
