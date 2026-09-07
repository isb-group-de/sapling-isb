<template>
  <SaplingKpiGrid>
    <SaplingKpiTile v-for="card in cards" :key="card.handle" :rows="getKpiTileRows(card.kpi)">
      <v-skeleton-loader
        v-if="card.isLoading"
        elevation="12"
        class="fill-height glass-panel"
        type="paragraph"
      />
      <SaplingKpiCard v-else :kpi="card.kpi" :kpi-idx="card.index" :tilt="false" />
    </SaplingKpiTile>
  </SaplingKpiGrid>
</template>

<script setup lang="ts">
import SaplingKpiCard from '@/components/kpi/SaplingKpiCard.vue'
import SaplingKpiGrid from '@/components/dashboard/SaplingKpiGrid.vue'
import SaplingKpiTile from '@/components/dashboard/SaplingKpiTile.vue'
import { getKpiTileRows } from '@/composables/dashboard/saplingKpiTileSize'
import type { PlaygroundKpiCard } from './playground.types'

defineProps<{ cards: PlaygroundKpiCard[] }>()
</script>
