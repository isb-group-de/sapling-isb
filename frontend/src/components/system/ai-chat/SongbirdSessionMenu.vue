<template>
  <v-menu
    v-model="open"
    location="bottom start"
    :close-on-content-click="false"
    :viewport-margin="0"
  >
    <template #activator="{ props: menuProps }">
      <v-btn
        v-bind="menuProps"
        class="songbird-session-trigger"
        variant="text"
        :rounded="0"
        append-icon="mdi-chevron-down"
        :title="c.activeConversationTitle"
      >
        {{ c.activeConversationTitle }}
      </v-btn>
    </template>
    <div class="songbird-session-menu songbird-session-history">
      <SongbirdSessionHistory :c="c" @selected="open = false" />
    </div>
  </v-menu>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import type { SongbirdWorkspaceState } from './useSongbirdWorkspace'
import SongbirdSessionHistory from './SongbirdSessionHistory.vue'
defineProps<{ c: SongbirdWorkspaceState }>()
const open = ref(false)
</script>
