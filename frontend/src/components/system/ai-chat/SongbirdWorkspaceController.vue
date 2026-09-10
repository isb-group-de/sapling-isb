<template><span hidden /></template>
<script setup lang="ts">
import { onUnmounted } from 'vue'
import { useSongbirdWorkspace } from './useSongbirdWorkspace'
import {
  registerSongbirdWorkspace,
  unregisterSongbirdWorkspace,
  type SongbirdWorkspaceEntry,
} from './songbirdWorkspaceRegistry'
const props = defineProps<{ entry: SongbirdWorkspaceEntry }>()
const state = useSongbirdWorkspace(props.entry)
registerSongbirdWorkspace(props.entry.key, state)
onUnmounted(() => {
  unregisterSongbirdWorkspace(props.entry.key, state)
})
</script>
