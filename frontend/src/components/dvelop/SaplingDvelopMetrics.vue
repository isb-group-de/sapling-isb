<template>
  <section
    class="sapling-responsive-grid sapling-responsive-grid--md sapling-dvelop-cloud__metrics"
  >
    <SaplingSurface as="article" class="sapling-metric-card sapling-dvelop-cloud__metric">
      <div class="sapling-icon-tile sapling-icon-tile--primary-soft">
        <v-icon icon="mdi-database-outline" />
      </div>
      <div class="sapling-metric-card__copy">
        <p>{{ $t('dvelopCloud.repositories') }}</p>
        <strong>{{ repositoryCount }}</strong>
        <span>{{ repositoryLabel }}</span>
      </div>
    </SaplingSurface>
    <SaplingSurface as="article" class="sapling-metric-card sapling-dvelop-cloud__metric">
      <div class="sapling-icon-tile sapling-icon-tile--info-soft">
        <v-icon icon="mdi-shape-outline" />
      </div>
      <div class="sapling-metric-card__copy">
        <p>{{ $t('dvelopCloud.objectDefinitions') }}</p>
        <strong>{{ objectDefinitionCount }}</strong>
        <span>{{ $t('dvelopCloud.categories') }}</span>
      </div>
    </SaplingSurface>
    <SaplingSurface as="article" class="sapling-metric-card sapling-dvelop-cloud__metric">
      <div class="sapling-icon-tile sapling-icon-tile--success-soft">
        <v-icon icon="mdi-tag-multiple-outline" />
      </div>
      <div class="sapling-metric-card__copy">
        <p>{{ $t('dvelopCloud.properties') }}</p>
        <strong>{{ propertyCount }}</strong>
        <span>{{ $t('dvelopCloud.fields') }}</span>
      </div>
    </SaplingSurface>
    <SaplingSurface as="article" class="sapling-metric-card sapling-dvelop-cloud__metric">
      <div class="sapling-icon-tile sapling-icon-tile--warning-soft">
        <v-icon icon="mdi-clock-outline" />
      </div>
      <div class="sapling-metric-card__copy">
        <p>{{ $t('dvelopCloud.lastSync') }}</p>
        <strong>{{ lastSyncDisplay }}</strong>
        <span>{{ connectionTitle || $t('dvelopCloud.connection') }}</span>
      </div>
    </SaplingSurface>
  </section>
</template>

<script lang="ts" setup>
import SaplingSurface from '@/components/common/SaplingSurface.vue'

defineProps<{
  repositoryCount: number
  objectDefinitionCount: number
  propertyCount: number
  repositoryLabel: string
  lastSyncDisplay: string
  connectionTitle?: string
}>()
</script>
