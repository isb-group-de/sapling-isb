<template>
  <v-card
    elevation="1"
    class="mb-6 glass-panel sapling-showcase__content-card sapling-playground__content-card"
    v-tilt="TILT_SOFT_OPTIONS"
  >
    <v-card-title class="text-h6">{{ title }}</v-card-title>
    <v-card-text><slot /></v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { TILT_SOFT_OPTIONS } from '@/constants/tilt.constants'

defineProps<{ title: string }>()
</script>
