<template>
  <SaplingSurface as="section" class="sapling-section-panel">
    <div class="sapling-section-header">
      <div>
        <p class="sapling-eyebrow">{{ $t('system.documents') }}</p>
        <h2 class="sapling-section-title">{{ $t('system.documentStorageTitle') }}</h2>
      </div>
      <div class="d-flex align-center ga-2">
        <v-chip size="small" variant="tonal" color="primary">
          {{ totalSizeLabel }}
        </v-chip>
        <v-btn
          icon="mdi-folder-search-outline"
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
      <div class="sapling-detail-card">
        <span>{{ $t('system.totalSize') }}</span>
        <v-skeleton-loader v-if="loading" type="text" width="112" />
        <strong v-else>{{ totalSizeLabel }}</strong>
      </div>
      <div class="sapling-detail-card">
        <span>{{ $t('system.fileCount') }}</span>
        <v-skeleton-loader v-if="loading" type="text" width="72" />
        <strong v-else>{{ totalFileCount }}</strong>
      </div>
      <div class="sapling-detail-card">
        <span>{{ $t('system.entityCount') }}</span>
        <v-skeleton-loader v-if="loading" type="text" width="72" />
        <strong v-else>{{ entityCount }}</strong>
      </div>
    </div>

    <div class="sapling-section-header">
      <p class="sapling-label">{{ $t('system.largestEntityFolders') }}</p>
      <v-chip size="small" variant="outlined">{{ items.length }} / {{ entityCount }}</v-chip>
    </div>

    <div v-if="items.length" class="sapling-system-storage-grid">
      <article v-for="item in items" :key="item.entityHandle" class="sapling-data-card">
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
            <span>{{ $t('system.fileCount') }}</span>
            <strong>{{ item.fileCount }}</strong>
          </div>
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
      {{ $t('system.noDocumentsStored') }}
    </div>
  </SaplingSurface>
</template>

<script lang="ts" setup>
import SaplingSurface from '@/components/common/SaplingSurface.vue'

defineProps<{
  totalSizeLabel: string
  totalFileCount: number
  entityCount: number
  showAllLabel: string
  loading?: boolean
  items: Array<{
    entityHandle: string
    label: string
    sizeLabel: string
    fileCount: number
    share: number
    shareLabel: string
  }>
  error?: string
}>()

const emit = defineEmits<{
  'show-details': []
}>()
</script>
