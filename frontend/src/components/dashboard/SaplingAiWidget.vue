<template>
  <div class="songbird-widget">
    <v-alert v-if="failed || !hasSaplingAiChatAccess" type="warning" density="compact">
      {{ $t(hasSaplingAiChatAccess ? 'aiChat.widgetLoadFailed' : 'global.permissionDenied') }}
      <v-btn v-if="hasSaplingAiChatAccess" variant="text" @click="load">{{
        $t('global.refresh')
      }}</v-btn>
    </v-alert>
    <SongbirdWorkspaceSurface v-else-if="state && !editing" :key="key" :c="state" />
    <v-progress-linear v-else-if="!editing" indeterminate />
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSaplingAiChat } from '@/composables/system/useSaplingAiChat'
import {
  ensureSongbirdWidget,
  songbirdSelection,
  songbirdWorkspaces,
  type AiWidget,
} from '@/components/system/ai-chat/songbirdWorkspaceRegistry'
import SongbirdWorkspaceSurface from '@/components/system/ai-chat/SongbirdWorkspaceSurface.vue'
const props = defineProps<{ widget: AiWidget; dashboardHandle: number; editing: boolean }>()
const { hasSaplingAiChatAccess, openSaplingAiChat } = useSaplingAiChat()
const failed = ref(false)
const key = computed(
  () => songbirdSelection.widgetKeys[`${props.dashboardHandle}:${props.widget.id}`] ?? '',
)
const state = computed(() => songbirdWorkspaces[key.value]?.state)
const canUseActions = computed(
  () => !!state.value && !props.editing && hasSaplingAiChatAccess.value,
)
function startNewChat() {
  if (canUseActions.value) state.value?.startNewChat()
}
async function load() {
  if (!hasSaplingAiChatAccess.value || props.editing) return
  failed.value = false
  try {
    await ensureSongbirdWidget(props.dashboardHandle, props.widget)
  } catch {
    failed.value = true
  }
}
watch(() => [hasSaplingAiChatAccess.value, props.editing, props.widget], load, {
  immediate: true,
  deep: true,
})
async function openPanel() {
  if (!canUseActions.value) return
  songbirdSelection.key = key.value
  await openSaplingAiChat()
}
defineExpose({ canUseActions, startNewChat, openPanel })
</script>
