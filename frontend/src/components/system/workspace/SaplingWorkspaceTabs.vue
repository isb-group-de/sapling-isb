<template>
  <section class="sapling-workspace">
    <div class="sapling-workspace__toolbar">
      <div
        class="sapling-workspace__tabs"
        role="tablist"
        :aria-label="t('tabs')"
        @keydown="onTabKeydown"
      >
        <div
          v-for="tab in tabs"
          :key="tab.id"
          class="sapling-workspace__tab"
          :class="{
            'sapling-workspace__tab--active': tab.id === activeId,
            'sapling-workspace__tab--calendar': tab.route.name === 'calendar',
          }"
        >
          <button
            :id="`workspace-tab-${tab.id}`"
            type="button"
            role="tab"
            :aria-selected="tab.id === activeId"
            :aria-controls="`workspace-panel-${tab.id}`"
            :tabindex="tab.id === activeId ? 0 : -1"
            :title="label(tab)"
            @click="activate(tab)"
          >
            <v-icon
              :icon="tab.route.path === '/' ? 'mdi-view-dashboard-outline' : 'mdi-tab'"
              size="16"
            />
            <span class="sapling-workspace__label">{{ label(tab) }}</span>
            <span v-if="tab.dirty.size" class="sapling-workspace__dirty" :aria-label="t('unsaved')"
              >●</span
            >
          </button>
          <button
            type="button"
            class="sapling-workspace__close"
            :aria-label="`${t('close')}: ${label(tab)}`"
            :title="t('close')"
            @click="close(tab, confirmDiscard)"
          >
            <v-icon icon="mdi-close" size="16" />
          </button>
        </div>
      </div>
      <v-btn
        icon="mdi-tab-plus"
        size="x-small"
        variant="text"
        :title="t('duplicate')"
        :aria-label="t('duplicate')"
        @click="duplicate"
      />
    </div>
    <div class="sapling-workspace__body">
      <template v-for="tab in tabs" :key="tab.id">
        <SaplingWorkspacePane
          v-if="tab.visited"
          v-show="tab.id === activeId"
          :tab="tab"
          :active="tab.id === activeId"
          @route-change="updateRoute(tab, $event)"
        />
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { useWorkspaceTabs, type WorkspaceTab } from '@/composables/system/useWorkspaceTabs'
import SaplingWorkspacePane from './SaplingWorkspacePane.vue'

// Shell controls must be available before an entity's server translations load.
const { t } = useI18n({
  useScope: 'local',
  messages: {
    de: {
      tabs: 'Arbeitsbereiche',
      close: 'Tab schließen',
      duplicate: 'Ansicht in neuem Tab öffnen',
      unsaved: 'Ungespeicherte Änderungen',
      discard: 'Dieser Tab enthält ungespeicherte Änderungen. Tab trotzdem schließen?',
      home: 'Übersicht',
    },
    en: {
      tabs: 'Workspaces',
      close: 'Close tab',
      duplicate: 'Open view in a new tab',
      unsaved: 'Unsaved changes',
      discard: 'This tab contains unsaved changes. Close it anyway?',
      home: 'Overview',
    },
  },
})
const { t: globalT, te } = useI18n({ useScope: 'global' })
const person = useCurrentPersonStore()
const { tabs, activeId, activate, duplicate, close, updateRoute } = useWorkspaceTabs(
  useRouter(),
  () =>
    person.person?.handle == null
      ? ''
      : `${person.person.handle}:${person.impersonator?.handle ?? ''}`,
)

function label(tab: WorkspaceTab) {
  const entity = tab.route.params.entity ?? tab.route.params.entityHandle
  const name = String(entity ?? tab.route.name ?? '')
  const title =
    tab.route.path === '/'
      ? t('home')
      : te(`navigation.${name}`)
        ? globalT(`navigation.${name}`)
        : name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase())
  const record = tab.route.query.open ?? tab.route.params.handle
  // Kanban opens its editor locally, without an `open` query parameter.
  const localKanbanRecord = record == null && tab.route.name === 'kanban'
  const recordLabel = [...tab.recordLabels.values()].find(
    (item) =>
      item.entityHandle === entity &&
      item.recordHandle != null &&
      (localKanbanRecord || item.recordHandle === String(record)) &&
      item.label.trim(),
  )?.label
  if (recordLabel) return `${title} · ${recordLabel}`
  const pageLabels = [...tab.pageLabels.values()]
  const pageLabel = pageLabels[pageLabels.length - 1]
  return pageLabel ? (tab.route.path === '/' ? pageLabel : `${title} · ${pageLabel}`) : title
}
const confirmDiscard = () => window.confirm(t('discard'))

async function onTabKeydown(event: KeyboardEvent) {
  if (!(event.target instanceof HTMLElement) || event.target.getAttribute('role') !== 'tab') return
  const index = tabs.findIndex((tab) => tab.id === activeId.value)
  let target: WorkspaceTab | undefined
  if (event.key === 'ArrowRight') target = tabs[(index + 1) % tabs.length]
  else if (event.key === 'ArrowLeft') target = tabs[(index + tabs.length - 1) % tabs.length]
  else if (event.key === 'Home') target = tabs[0]
  else if (event.key === 'End') target = tabs[tabs.length - 1]
  else if (event.key === 'Delete') {
    event.preventDefault()
    const tab = tabs[index]
    if (tab) await close(tab, confirmDiscard)
    await nextTick()
    document.getElementById(`workspace-tab-${activeId.value}`)?.focus()
    return
  }
  if (!target) return
  event.preventDefault()
  await activate(target)
  await nextTick()
  document.getElementById(`workspace-tab-${target.id}`)?.focus()
}
watch(activeId, async (id) => {
  await nextTick()
  document
    .getElementById(`workspace-tab-${id}`)
    ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
})
</script>
