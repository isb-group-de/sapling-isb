<template>
  <SaplingAiChatSessions
    :sessions="c.sessions"
    :active-session-handle="c.activeSession?.handle ?? null"
    :active-session-title="c.activeSession?.title ?? ''"
    :include-archived="c.includeArchived"
    :editing-session-handle="c.editingSessionHandle"
    :editing-session-title="c.editingSessionTitle"
    :is-collapsible="false"
    :is-collapsed="false"
    :title-preview-limit="Number.MAX_SAFE_INTEGER"
    @update:include-archived="c.updateIncludeArchived"
    @update:editing-session-title="c.updateEditingSessionTitle($event)"
    @select="selectSession"
    @begin-rename="c.beginRename"
    @cancel-rename="c.cancelRename"
    @save-title="c.saveSessionTitle"
    @toggle-archive="c.toggleArchive"
  />
</template>
<script setup lang="ts">
import type { AiChatSessionItem } from '@/entity/entity'
import type { SongbirdWorkspaceState } from './useSongbirdWorkspace'
import SaplingAiChatSessions from './SaplingAiChatSessions.vue'
const props = defineProps<{ c: SongbirdWorkspaceState }>()
const emit = defineEmits<{ selected: [] }>()
function selectSession(session: AiChatSessionItem) {
  props.c.selectSession(session)
  emit('selected')
}
</script>
