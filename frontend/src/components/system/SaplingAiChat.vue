<template>
  <SongbirdWorkspaceController
    v-for="entry in songbirdWorkspaces"
    :key="entry.key"
    :entry="entry"
  />
  <Teleport to="body">
    <v-btn
      v-if="hasSaplingAiChatAccess && !isOpen && !isGhostEasterEggActive"
      data-tutorial="songbird"
      class="sapling-button--round sapling-ai-chat-fab"
      color="primary"
      size="large"
      icon="mdi-bird"
      aria-label="Songbird"
      @click="openSaplingAiChat"
    />
    <GhostEasterEgg
      v-else-if="hasSaplingAiChatAccess && !isOpen"
      placement="ai-fab"
      @activate="openSaplingAiChat"
    />
    <aside
      v-if="isOpen && hasSaplingAiChatAccess"
      class="songbird-panel sapling-ai-chat"
      :class="{ 'songbird-panel--fullscreen': fullscreen }"
      aria-label="Songbird"
      data-tutorial="songbird-chat"
    >
      <div
        v-if="!fullscreen"
        role="separator"
        tabindex="0"
        aria-orientation="vertical"
        :aria-label="$t('aiChat.resizePanel')"
        :aria-valuenow="width"
        :aria-valuemin="360"
        :aria-valuemax="715"
        class="songbird-panel__resize"
        @pointerdown="startResize"
        @keydown.left.prevent="setWidth(width + 20)"
        @keydown.right.prevent="setWidth(width - 20)"
      />
      <header class="songbird-panel__toolbar">
        <strong>Songbird</strong>
        <v-btn
          size="small"
          variant="text"
          :title="$t('aiChat.newOperation')"
          :aria-label="$t('aiChat.newOperation')"
          icon="mdi-plus"
          @click="newSongbirdWorkspace()"
        />
        <v-btn
          size="small"
          variant="text"
          :title="$t('aiChat.openAccountSettings')"
          :aria-label="$t('aiChat.openAccountSettings')"
          icon="mdi-account-cog-outline"
          @click="c?.openAccountSettings()"
        />
        <v-btn
          size="small"
          variant="text"
          :title="$t('aiChat.expandWorkspace')"
          :aria-label="$t('aiChat.expandWorkspace')"
          :icon="expanded ? 'mdi-arrow-collapse' : 'mdi-arrow-expand'"
          @click="expanded = !expanded"
        />
        <v-btn size="small" variant="text" @click="closeSaplingAiChat">{{
          $t('aiChat.backToWork')
        }}</v-btn>
      </header>
      <template v-if="c">
        <div class="songbird-panel__context">
          <span :title="c.contextLabel">{{ c.contextLabel }}</span>
          <v-btn
            size="small"
            variant="text"
            :icon="c.followPage ? 'mdi-pin-outline' : 'mdi-pin-off-outline'"
            :aria-label="$t(c.followPage ? 'aiChat.pinContext' : 'aiChat.followContext')"
            :title="$t(c.followPage ? 'aiChat.pinContext' : 'aiChat.followContext')"
            @click="c.toggleContext()"
          />
        </div>
        <div class="songbird-panel__body">
          <div v-if="showSessionSidebar" class="songbird-session-sidebar songbird-session-history">
            <SongbirdSessionHistory :c="c" />
          </div>
          <div class="songbird-panel__operation">
            <SongbirdSessionMenu v-if="!showSessionSidebar" :c="c" />
            <SongbirdWorkspaceSurface :key="songbirdSelection.key" :c="c" />
          </div>
        </div>
      </template>
      <v-progress-linear v-else indeterminate />
    </aside>
  </Teleport>
</template>
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import GhostEasterEgg from '@/components/easter-egg/GhostEasterEgg.vue'
import { useGhostEasterEgg } from '@/composables/easter-egg/useGhostEasterEgg'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { useSaplingAiChat } from '@/composables/system/useSaplingAiChat'
import { useSongbirdDock } from '@/composables/system/useSongbirdDock'
import { hasSongbirdGlobalRecordDialog } from '@/composables/system/songbirdPageContext'
import ApiAiService from '@/services/api.ai.service'
import { SAPLING_AI_CHAT_PROMPT_EVENT } from '@/utils/saplingScriptResultUtil'
import type { SaplingAiChatPromptEventDetail } from './ai-chat/saplingAiChat.utils'
import {
  songbirdWorkspaces,
  songbirdSelection,
  createSongbirdWorkspace,
  selectSongbirdSession,
  newSongbirdWorkspace,
  resetSongbirdWorkspaces,
} from './ai-chat/songbirdWorkspaceRegistry'
import SongbirdWorkspaceController from './ai-chat/SongbirdWorkspaceController.vue'
import SongbirdWorkspaceSurface from './ai-chat/SongbirdWorkspaceSurface.vue'
import SongbirdSessionMenu from './ai-chat/SongbirdSessionMenu.vue'
import SongbirdSessionHistory from './ai-chat/SongbirdSessionHistory.vue'
const person = useCurrentPersonStore()
const { isOpen, hasSaplingAiChatAccess, openSaplingAiChat, closeSaplingAiChat } = useSaplingAiChat()
const { isActive: isGhostEasterEggActive } = useGhostEasterEgg()
const { width, fullscreen, docked, expanded, setWidth, showSessionSidebar } = useSongbirdDock()
const c = computed(() => songbirdWorkspaces[songbirdSelection.key]?.state)
const principal = computed(
  () => String(person.person?.handle ?? '') + ':' + String(person.impersonator?.handle ?? ''),
)
const storageKey = computed(() => 'songbird-active-session:' + principal.value)
watch(principal, () => {
  resetSongbirdWorkspaces()
  closeSaplingAiChat()
})
watch(
  () => c.value?.activeSession?.handle,
  (handle) => {
    try {
      if (handle) localStorage.setItem(storageKey.value, String(handle))
    } catch {
      /* Optional browser preference. */
    }
  },
)
watch(
  [isOpen, () => songbirdSelection.key],
  async ([open]) => {
    if (!open || songbirdSelection.key) return
    const identity = principal.value
    try {
      const handle = Number(localStorage.getItem(storageKey.value))
      const session = handle
        ? (await ApiAiService.listSessions()).find((s) => s.handle === handle)
        : null
      if (identity !== principal.value || songbirdSelection.key) return
      if (session) selectSongbirdSession(session)
      else songbirdSelection.key = createSongbirdWorkspace()
    } catch {
      if (identity === principal.value && !songbirdSelection.key)
        songbirdSelection.key = createSongbirdWorkspace()
    }
  },
  { immediate: true },
)
watch(
  [docked, width, fullscreen, isOpen, hasSaplingAiChatAccess],
  () => {
    document.documentElement.style.setProperty('--songbird-panel-width', width.value + 'px')
    document.documentElement.style.setProperty(
      '--songbird-reserved-width',
      docked.value ? width.value + 'px' : '0px',
    )
    document.documentElement.classList.toggle('songbird-docked', docked.value)
    document.documentElement.classList.toggle(
      'songbird-fullscreen',
      isOpen.value && hasSaplingAiChatAccess.value && fullscreen.value,
    )
  },
  { immediate: true },
)
function setWorkInert(inert: boolean) {
  document
    .querySelectorAll<HTMLElement>('.sapling-auth-layout__body, .sapling-app-layout__header')
    .forEach((element) => {
      element.inert = inert
    })
}
watch(
  [hasSongbirdGlobalRecordDialog, isOpen, fullscreen, hasSaplingAiChatAccess],
  () => {
    setWorkInert(
      isOpen.value &&
        hasSaplingAiChatAccess.value &&
        (fullscreen.value || hasSongbirdGlobalRecordDialog.value),
    )
  },
  { immediate: true, flush: 'post' },
)
function resize(event: PointerEvent) {
  setWidth(window.innerWidth - event.clientX)
}
function stopResize() {
  window.removeEventListener('pointermove', resize)
  window.removeEventListener('pointerup', stopResize)
}
function startResize(event: PointerEvent) {
  event.preventDefault()
  window.addEventListener('pointermove', resize)
  window.addEventListener('pointerup', stopResize, { once: true })
}
async function prompt(event: Event) {
  const detail = (event as CustomEvent<SaplingAiChatPromptEventDetail>).detail
  if (!detail?.prompt || !(await openSaplingAiChat())) return
  if (detail.newChat !== false || !songbirdSelection.key) newSongbirdWorkspace()
  await nextTick()
  await c.value?.openPromptFromScriptButton(detail)
}
onMounted(() => window.addEventListener(SAPLING_AI_CHAT_PROMPT_EVENT, prompt))
onUnmounted(() => {
  window.removeEventListener(SAPLING_AI_CHAT_PROMPT_EVENT, prompt)
  stopResize()
  setWorkInert(false)
  document.documentElement.classList.remove('songbird-docked', 'songbird-fullscreen')
  document.documentElement.style.removeProperty('--songbird-reserved-width')
  resetSongbirdWorkspaces()
})
</script>
