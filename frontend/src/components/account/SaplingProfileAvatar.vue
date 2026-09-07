<template>
  <span class="sapling-profile-avatar" :class="{ 'sapling-profile-avatar--large': large }">
    <img
      v-if="pictures.activeUrl && !failed"
      :key="pictures.activeUrl"
      :src="pictures.activeUrl"
      :alt="name"
      crossorigin="use-credentials"
      @error="failed = true"
    />
    <span v-else aria-hidden="true">{{ initials }}</span>
  </span>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useProfilePictureStore } from '@/stores/profilePictureStore'

defineProps<{ name: string; initials: string; large?: boolean }>()
const pictures = useProfilePictureStore()
const failed = ref(false)
watch(
  () => pictures.activeUrl,
  () => {
    failed.value = false
  },
)
</script>
