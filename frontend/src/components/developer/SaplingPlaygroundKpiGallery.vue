<template>
  <v-row>
    <v-col v-for="card in cards" :key="card.handle" cols="12" md="6">
      <v-skeleton-loader
        v-if="card.isLoading"
        elevation="12"
        class="fill-height glass-panel"
        type="paragraph"
      />
      <SaplingKpiCard v-else :kpi="card.kpi" :kpi-idx="card.index" />
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import SaplingKpiCard from '@/components/kpi/SaplingKpiCard.vue'
import type { PlaygroundKpiCard } from './playground.types'

defineProps<{ cards: PlaygroundKpiCard[] }>()
</script>
