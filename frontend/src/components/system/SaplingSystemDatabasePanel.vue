<template>
  <SaplingSurface as="article" class="sapling-section-panel">
    <div class="sapling-section-header">
      <div>
        <p class="sapling-eyebrow">{{ $t('system.database') }}</p>
        <h2 class="sapling-section-title">{{ name }}</h2>
      </div>
      <div class="d-flex align-center ga-2">
        <v-chip size="small" variant="tonal" color="primary">
          {{ engine }}
        </v-chip>
        <v-btn
          icon="mdi-table-eye"
          size="small"
          variant="tonal"
          color="primary"
          :aria-label="showAllLabel"
          :title="showAllLabel"
          @click="emit('show-details')"
        />
      </div>
    </div>

    <div class="sapling-detail-grid">
      <div v-for="item in details" :key="item.label" class="sapling-detail-card">
        <span>{{ item.label }}</span>
        <v-skeleton-loader v-if="item.loading" type="text" width="112" />
        <strong v-else>{{ item.value }}</strong>
      </div>
    </div>

    <div class="sapling-section-header">
      <p class="sapling-label">{{ $t('system.largestTables') }}</p>
      <v-chip size="small" variant="outlined">{{ items.length }} / {{ tableCount }}</v-chip>
    </div>

    <div
      v-if="items.length"
      class="sapling-system-storage-grid sapling-system-storage-grid--database"
    >
      <article v-for="item in items" :key="`${item.schema}.${item.name}`" class="sapling-data-card">
        <div class="sapling-section-header">
          <div>
            <h3>{{ item.label }}</h3>
          </div>
          <v-chip size="small" variant="tonal" color="primary">
            {{ item.sizeLabel }}
          </v-chip>
        </div>

        <v-progress-linear :model-value="item.share" color="primary" height="10" rounded />

        <div class="sapling-detail-grid">
          <div class="sapling-detail-card">
            <span>{{ $t('system.share') }}</span>
            <strong>{{ item.shareLabel }}</strong>
          </div>
        </div>
      </article>
    </div>

    <div
      v-else-if="!loading && !error"
      class="sapling-empty-state-panel sapling-empty-state-panel--compact"
    >
      {{ $t('system.noDatabaseTables') }}
    </div>
  </SaplingSurface>
</template>

<script lang="ts" setup>
import SaplingSurface from '@/components/common/SaplingSurface.vue'

defineProps<{
  name: string
  engine: string
  showAllLabel: string
  tableCount: number
  loading?: boolean
  items: Array<{
    schema: string
    name: string
    label: string
    sizeLabel: string
    share: number
    shareLabel: string
  }>
  details: Array<{
    label: string
    value: string
    loading?: boolean
  }>
  error?: string
}>()

const emit = defineEmits<{
  'show-details': []
}>()
</script>
