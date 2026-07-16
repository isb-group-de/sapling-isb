<template>
  <SaplingSurface
    as="section"
    class="sapling-panel-shell sapling-section-panel sapling-dvelop-cloud__control-band"
  >
    <div class="sapling-dvelop-cloud__connection-panel">
      <v-select
        :model-value="modelValue"
        class="sapling-dvelop-cloud__connection-field"
        :items="connectionOptions"
        :loading="loading"
        item-title="title"
        item-value="value"
        prepend-inner-icon="mdi-cloud-outline"
        variant="outlined"
        density="comfortable"
        hide-details="auto"
        :label="$t('dvelopCloud.connection')"
        @update:model-value="$emit('update:modelValue', $event)"
      />

      <div v-if="connection" class="sapling-detail-grid sapling-dvelop-cloud__connection-meta">
        <div class="sapling-detail-card">
          <span>{{ $t('dvelopConnection.baseUrl') }}</span>
          <strong class="sapling-dvelop-cloud__meta-value">{{ connection.baseUrl }}</strong>
        </div>
        <div class="sapling-detail-card">
          <span>{{ $t('dvelopConnection.repository') }}</span>
          <strong class="sapling-dvelop-cloud__meta-value">{{ repositoryLabel }}</strong>
        </div>
        <div class="sapling-detail-card">
          <span>{{ $t('dvelopConnection.isActive') }}</span>
          <strong>
            <v-chip
              :color="connection.isActive ? 'success' : 'default'"
              size="small"
              variant="tonal"
            >
              {{ connection.isActive ? $t('global.yes') : $t('global.no') }}
            </v-chip>
          </strong>
        </div>
      </div>

      <div class="sapling-dvelop-cloud__health-strip">
        <div class="sapling-dvelop-cloud__health-summary">
          <span class="sapling-label">{{ $t('dvelopCloud.healthStatus') }}</span>
          <v-chip :color="dvelopHealthStatusColor(healthStatus)" size="small" variant="tonal">
            {{ formatHealthStatus(healthStatus) }}
          </v-chip>
        </div>
        <div class="sapling-dvelop-cloud__health-capabilities">
          <v-chip
            v-for="capability in healthCapabilities"
            :key="capability.key"
            :color="dvelopHealthStatusColor(capability.status)"
            :prepend-icon="dvelopHealthStatusIcon(capability.status)"
            size="small"
            variant="tonal"
          >
            {{ formatCapability(capability) }}
          </v-chip>
        </div>
      </div>
    </div>

    <div class="sapling-action-cluster sapling-dvelop-cloud__sync-actions">
      <v-btn
        variant="tonal"
        prepend-icon="mdi-shield-check-outline"
        :disabled="!connection || isAnySyncing"
        :loading="isCheckingHealth"
        @click="$emit('health-check')"
      >
        {{ $t('dvelopCloud.healthCheck') }}
      </v-btn>
      <v-btn
        color="primary"
        variant="flat"
        prepend-icon="mdi-download"
        :disabled="!connection || isCheckingHealth"
        :loading="isSyncingAll"
        @click="$emit('sync-all')"
      >
        {{ $t('dvelopCloud.syncAll') }}
      </v-btn>
      <v-btn
        variant="tonal"
        prepend-icon="mdi-database-sync-outline"
        :disabled="!connection || isAnySyncing || isCheckingHealth"
        :loading="isSyncingRepositories"
        @click="$emit('sync-repositories')"
      >
        {{ $t('dvelopCloud.syncRepositories') }}
      </v-btn>
      <v-btn
        variant="tonal"
        prepend-icon="mdi-shape-outline"
        :disabled="!connection || isAnySyncing || isCheckingHealth"
        :loading="isSyncingObjectDefinitions"
        @click="$emit('sync-object-definitions')"
      >
        {{ $t('dvelopCloud.syncObjectDefinitions') }}
      </v-btn>
      <v-btn
        variant="tonal"
        prepend-icon="mdi-tag-multiple-outline"
        :disabled="!connection || isAnySyncing || isCheckingHealth"
        :loading="isSyncingProperties"
        @click="$emit('sync-properties')"
      >
        {{ $t('dvelopCloud.syncProperties') }}
      </v-btn>
    </div>
  </SaplingSurface>
</template>

<script lang="ts" setup>
import SaplingSurface from '@/components/common/SaplingSurface.vue'
import type { DvelopHealthCheckStatus } from '@/services/api.dvelop.service'
import type { DvelopConnectionItem, DvelopHealthCapabilityRow } from './dvelopCloudWorkspace.types'
import {
  capitalizeDvelopKey,
  dvelopHealthStatusColor,
  dvelopHealthStatusIcon,
} from './dvelopCloudWorkspace.utils'
import { useI18n } from 'vue-i18n'

defineProps<{
  modelValue: number | null
  connectionOptions: Array<{ title: string; value: number }>
  connection?: DvelopConnectionItem
  repositoryLabel: string
  loading: boolean
  healthStatus?: DvelopHealthCheckStatus
  healthCapabilities: DvelopHealthCapabilityRow[]
  isCheckingHealth: boolean
  isSyncingAll: boolean
  isAnySyncing: boolean
  isSyncingRepositories: boolean
  isSyncingObjectDefinitions: boolean
  isSyncingProperties: boolean
}>()

defineEmits<{
  'update:modelValue': [value: number | null]
  'health-check': []
  'sync-all': []
  'sync-repositories': []
  'sync-object-definitions': []
  'sync-properties': []
}>()

const { t } = useI18n()

function formatHealthStatus(status?: DvelopHealthCheckStatus): string {
  return status
    ? t(`dvelopCloud.healthStatus${capitalizeDvelopKey(status)}`)
    : t('global.notAvailable')
}

function formatCapability(capability: DvelopHealthCapabilityRow): string {
  const label = t(`dvelopCloud.healthCapability${capitalizeDvelopKey(capability.key)}`)
  return `${label}: ${formatHealthStatus(capability.status)}`
}
</script>
