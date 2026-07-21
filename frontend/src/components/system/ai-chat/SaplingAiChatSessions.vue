<template>
  <aside
    class="sapling-stack-xl sapling-chat-rail sapling-ai-chat__sessions"
    :class="{
      'sapling-ai-chat__sessions--collapsible': isCollapsible,
      'sapling-ai-chat__sessions--collapsed': isCollapsible && isCollapsed,
      'sapling-chat-rail--collapsed': isCollapsible && isCollapsed,
    }"
  >
    <div class="sapling-stack-md sapling-chat-rail__header sapling-ai-chat__sessions-header">
      <button
        v-if="isCollapsible"
        type="button"
        class="sapling-row-between-md sapling-chat-rail__toggle sapling-ai-chat__sessions-toggle"
        :aria-expanded="!isCollapsed"
        :title="t('aiChat.sessions')"
        @click="emit('toggleCollapse')"
      >
        <span class="sapling-chat-rail__toggle-copy sapling-ai-chat__sessions-toggle-copy">
          <span class="sapling-chat-rail__toggle-label sapling-ai-chat__sessions-toggle-label">
            {{ t('aiChat.sessions') }}
          </span>
          <span class="sapling-chat-rail__toggle-meta sapling-ai-chat__sessions-toggle-meta">
            {{ sessionRailSummary }}
          </span>
        </span>
        <v-icon :icon="isCollapsed ? 'mdi-chevron-down' : 'mdi-chevron-up'" size="small" />
      </button>
      <span v-else>{{ t('aiChat.sessions') }}</span>
      <v-switch
        :model-value="includeArchived"
        color="primary"
        density="compact"
        hide-details
        inset
        @update:model-value="handleIncludeArchivedUpdate"
      >
        <template #label>
          <span class="sapling-chat-rail__switch-label sapling-ai-chat__switch-label">
            {{ t('aiChat.showArchived') }}
          </span>
        </template>
      </v-switch>
    </div>

    <v-text-field
      v-if="!isCollapsed && sessions.length > 0"
      v-model="searchQuery"
      class="sapling-chat-rail__search sapling-ai-chat__session-search"
      density="compact"
      hide-details
      single-line
      clearable
      prepend-inner-icon="mdi-magnify"
      type="search"
      name="sapling-ai-chat-session-search"
      autocomplete="off"
      autocapitalize="none"
      autocorrect="off"
      :spellcheck="false"
      :placeholder="getTranslationLabel('searchSessions', 'Chats durchsuchen')"
      :aria-label="getTranslationLabel('searchSessions', 'Chats durchsuchen')"
    />

    <div
      v-if="!isCollapsed && sessions.length === 0"
      class="sapling-empty-state-panel sapling-empty-state-panel--compact sapling-chat-empty-state sapling-ai-chat__empty-state"
    >
      {{ t('aiChat.noSessions') }}
    </div>

    <div
      v-else-if="!isCollapsed && sessionGroups.length === 0"
      class="sapling-empty-state-panel sapling-empty-state-panel--compact sapling-chat-empty-state sapling-ai-chat__empty-state"
    >
      {{ getTranslationLabel('noMatchingSessions', 'Keine passenden Chats gefunden.') }}
    </div>

    <div
      v-else-if="!isCollapsed"
      class="sapling-scroll-list sapling-chat-rail__list sapling-ai-chat__session-list"
    >
      <section
        v-for="group in sessionGroups"
        :key="group.key"
        class="sapling-chat-rail__group sapling-ai-chat__session-group"
      >
        <div class="sapling-chat-rail__group-label sapling-ai-chat__session-group-label">
          {{ getSessionGroupLabel(group.key) }}
        </div>

        <div class="sapling-chat-rail__group-items">
          <article
            v-for="session in group.sessions"
            :key="session.handle ?? session.title"
            class="sapling-interactive-list-item sapling-chat-rail__item sapling-ai-chat__session-item"
            :class="{
              'sapling-interactive-list-item--active': session.handle === activeSessionHandle,
              'sapling-ai-chat__session-item--active': session.handle === activeSessionHandle,
              'sapling-chat-rail__item--active': session.handle === activeSessionHandle,
            }"
          >
            <template v-if="editingSessionHandle === session.handle">
              <v-text-field
                v-model="editingSessionTitleModel"
                density="compact"
                hide-details
                autocomplete="off"
                autofocus
                @keyup.enter="emit('saveTitle', session)"
                @keyup.esc="emit('cancelRename')"
              />
              <div class="sapling-row-xs sapling-chat-rail__rename-actions">
                <v-btn
                  icon="mdi-check"
                  size="x-small"
                  variant="tonal"
                  :aria-label="t('global.save')"
                  :title="t('global.save')"
                  @click="emit('saveTitle', session)"
                />
                <v-btn
                  icon="mdi-close"
                  size="x-small"
                  variant="text"
                  :aria-label="t('global.cancel')"
                  :title="t('global.cancel')"
                  @click="emit('cancelRename')"
                />
              </div>
            </template>

            <template v-else>
              <button
                type="button"
                class="sapling-chat-rail__item-primary sapling-ai-chat__session-primary"
                @click="emit('select', session)"
              >
                <span class="sapling-row-xs sapling-chat-rail__item-title-row">
                  <span class="sapling-chat-rail__item-title sapling-ai-chat__session-title">
                    {{ getTruncatedTitle(session.title) }}
                  </span>
                  <v-icon
                    v-if="session.isArchived"
                    icon="mdi-archive-outline"
                    size="x-small"
                    :title="t('aiChat.archived')"
                  />
                  <v-tooltip v-if="isTitleTruncated(session.title)" location="top" max-width="400">
                    <template #activator="{ props: tooltipProps }">
                      <v-icon
                        v-bind="tooltipProps"
                        icon="mdi-information-outline"
                        class="sapling-chat-conversation__title-info sapling-ai-chat__title-info"
                        size="small"
                      />
                    </template>
                    <span>{{ session.title }}</span>
                  </v-tooltip>
                </span>

                <span
                  v-if="formatSessionRuntimeSummary(session)"
                  class="sapling-chat-rail__item-runtime sapling-ai-chat__session-runtime"
                  :title="formatSessionRuntimeSummary(session)"
                >
                  <v-icon icon="mdi-robot-outline" size="x-small" />
                  <span>{{ formatSessionRuntimeSummary(session) }}</span>
                </span>

                <span class="sapling-chat-rail__item-footer">
                  <span class="sapling-chat-rail__item-meta sapling-ai-chat__session-meta">
                    {{ formatSessionMeta(session) }}
                  </span>
                  <span
                    v-if="getSessionActivity(session)"
                    class="sapling-chat-rail__item-activity"
                    :class="`sapling-chat-rail__item-activity--${getSessionActivity(session)}`"
                    role="status"
                  >
                    <v-progress-circular
                      v-if="getSessionActivity(session) === 'responding'"
                      indeterminate
                      size="12"
                      width="2"
                    />
                    <v-icon v-else icon="mdi-circle" size="8" />
                    <span>{{ getSessionActivityLabel(session) }}</span>
                  </span>
                </span>
              </button>

              <v-menu location="bottom end">
                <template #activator="{ props: menuProps }">
                  <v-btn
                    v-bind="menuProps"
                    class="sapling-chat-rail__item-menu sapling-ai-chat__session-menu"
                    icon="mdi-dots-vertical"
                    size="x-small"
                    variant="text"
                    :aria-label="getTranslationLabel('sessionActions', 'Chat-Aktionen')"
                    :title="getTranslationLabel('sessionActions', 'Chat-Aktionen')"
                  />
                </template>
                <v-list density="compact" class="glass-panel" nav>
                  <v-list-item
                    prepend-icon="mdi-pencil-outline"
                    :title="getTranslationLabel('renameSession', 'Chat umbenennen')"
                    @click="emit('beginRename', session)"
                  />
                  <v-list-item
                    :prepend-icon="
                      session.isArchived ? 'mdi-archive-arrow-up-outline' : 'mdi-archive-outline'
                    "
                    :title="
                      session.isArchived
                        ? getTranslationLabel('unarchiveSession', 'Chat wiederherstellen')
                        : getTranslationLabel('archiveSession', 'Chat archivieren')
                    "
                    @click="emit('toggleArchive', session)"
                  />
                </v-list>
              </v-menu>
            </template>
          </article>
        </div>
      </section>
    </div>
  </aside>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AiChatSessionItem } from '@/entity/entity'
import {
  formatSessionRuntimeSummary,
  getPersistedSessionActivity,
  getSessionDate,
  getSessionDateGroup,
  type SessionDateGroup,
} from './aiChatSessionPresentation'

const props = withDefaults(
  defineProps<{
    sessions: AiChatSessionItem[]
    activeSessionHandle: number | null
    activeSessionTitle?: string
    includeArchived: boolean
    editingSessionHandle: number | null
    editingSessionTitle: string
    isCollapsible?: boolean
    isCollapsed?: boolean
    titlePreviewLimit?: number
  }>(),
  {
    activeSessionTitle: '',
    isCollapsible: false,
    isCollapsed: false,
    titlePreviewLimit: 30,
  },
)

const emit = defineEmits<{
  (event: 'update:includeArchived', value: boolean): void
  (event: 'update:editingSessionTitle', value: string): void
  (event: 'toggleCollapse'): void
  (event: 'select', session: AiChatSessionItem): void
  (event: 'beginRename', session: AiChatSessionItem): void
  (event: 'cancelRename'): void
  (event: 'saveTitle', session: AiChatSessionItem): void
  (event: 'toggleArchive', session: AiChatSessionItem): void
}>()

const { t, te } = useI18n()
const searchQuery = ref('')
const groupOrder: SessionDateGroup[] = ['today', 'yesterday', 'lastSevenDays', 'older']

const sessionRailSummary = computed(() => {
  if (props.activeSessionTitle?.trim()) return getTruncatedTitle(props.activeSessionTitle)
  if (props.sessions.length === 0) return t('aiChat.noSessions')
  return String(props.sessions.length)
})

const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLocaleLowerCase())

const filteredSessions = computed(() => {
  if (!normalizedSearchQuery.value) return props.sessions

  return props.sessions.filter((session) =>
    [session.title, formatSessionRuntimeSummary(session)]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedSearchQuery.value),
  )
})

const sessionGroups = computed(() => {
  const grouped = new Map<SessionDateGroup, AiChatSessionItem[]>()

  for (const session of filteredSessions.value) {
    const key = getSessionDateGroup(session)
    grouped.set(key, [...(grouped.get(key) ?? []), session])
  }

  return groupOrder
    .map((key) => ({ key, sessions: grouped.get(key) ?? [] }))
    .filter((group) => group.sessions.length > 0)
})

const editingSessionTitleModel = computed({
  get: () => props.editingSessionTitle,
  set: (value: string) => emit('update:editingSessionTitle', value),
})

function handleIncludeArchivedUpdate(value: boolean | null) {
  emit('update:includeArchived', Boolean(value))
}

function isTitleTruncated(value?: string | null) {
  return typeof value === 'string' && value.length > props.titlePreviewLimit
}

function getTruncatedTitle(value?: string | null) {
  if (!value) return ''
  return isTitleTruncated(value) ? `${value.slice(0, props.titlePreviewLimit)}...` : value
}

function formatSessionMeta(session: AiChatSessionItem) {
  const date = getSessionDate(session)
  if (!date) return session.isArchived ? t('aiChat.archived') : t('aiChat.active')

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getSessionActivity(session: AiChatSessionItem) {
  return getPersistedSessionActivity(session)
}

function getSessionActivityLabel(session: AiChatSessionItem) {
  return getSessionActivity(session) === 'responding'
    ? getTranslationLabel('sessionResponding', 'Antwortet …')
    : getTranslationLabel('sessionUnread', 'Neu')
}

function getTranslationLabel(property: string, fallback: string) {
  const key = `aiChat.${property}`
  return te(key) ? t(key) : fallback
}

function getSessionGroupLabel(group: SessionDateGroup) {
  const fallbacks: Record<SessionDateGroup, string> = {
    today: 'Heute',
    yesterday: 'Gestern',
    lastSevenDays: 'Letzte 7 Tage',
    older: 'Älter',
  }
  return getTranslationLabel(`sessionGroup.${group}`, fallbacks[group])
}
</script>
