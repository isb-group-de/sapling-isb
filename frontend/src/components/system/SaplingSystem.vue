<template>
  <v-container
    class="sapling-page-shell sapling-page-shell--panel sapling-page-shell--uniform-inset sapling-system-page"
    fluid
  >
    <template v-if="isLoading">
      <div class="sapling-system-skeleton">
        <v-skeleton-loader type="article" />
        <div class="sapling-system-skeleton__metrics">
          <v-skeleton-loader v-for="item in 4" :key="item" type="article" />
        </div>
        <div class="sapling-system-skeleton__sections">
          <v-skeleton-loader type="article" />
          <v-skeleton-loader type="article" />
        </div>
      </div>
    </template>

    <template v-else>
      <header class="sapling-system-context glass-panel sapling-data-card">
        <div class="sapling-system-context__title">
          <span class="sapling-label">{{ $t('system.system') }}</span>
          <strong>{{ systemTitle }}</strong>
          <small>{{ systemSubtitle }}</small>
        </div>
        <div class="sapling-system-context__meta">
          <v-chip :color="state?.isReady ? 'success' : 'error'" size="small" variant="tonal">
            {{ state?.isReady ? $t('system.operational') : $t('system.requiresAttention') }}
          </v-chip>
          <v-chip size="small" variant="tonal">{{ displayValue(os?.platform) }}</v-chip>
          <v-chip size="small" variant="outlined">{{ displayValue(os?.arch) }}</v-chip>
          <v-chip v-if="version?.version" size="small" variant="outlined"
            >v{{ version.version }}</v-chip
          >
          <span>{{ formattedServerTime }}</span>
          <v-btn
            icon="mdi-refresh"
            size="small"
            variant="text"
            :loading="refreshing"
            :title="$t('system.refresh')"
            @click="refreshDashboard"
          />
        </div>
      </header>

      <SaplingSystemMonitoring>
        <template #performance>
          <SaplingSystemPerformancePanel
            class="sapling-system-tab-panel"
            :title="cpu?.brand || $t('system.cpu')"
            :manufacturer="cpu?.manufacturer"
            :cpu-gauge-label="$t('system.cpuUsage')"
            :cpu-gauge-value="formatPercentage(cpuLoadPercentage)"
            :cpu-gauge-loading="cpuSpeedLoading"
            :cpu-gauge-progress="cpuLoadPercentage"
            :memory-gauge-label="$t('system.memory')"
            :memory-gauge-value="formatPercentage(memoryUsagePercentage)"
            :memory-gauge-loading="memoryLoading"
            :memory-gauge-progress="memoryUsagePercentage"
            :details="performanceDetails"
          />
        </template>

        <template #storage>
          <div class="sapling-system-tab-stack">
            <SaplingSystemDocumentStoragePanel
              :total-size-label="formatBytes(documentStorage?.totalSize ?? 0)"
              :total-file-count="documentStorage?.totalFileCount ?? 0"
              :entity-count="documentStorage?.entityCount ?? 0"
              :loading="documentStorageLoading"
              :items="documentStorageItems"
              :show-all-label="$t('system.showAllStorageFolders')"
              :error="documentStorageError || ''"
              @show-details="openSizeDetails('documentStorage')"
            />
            <SaplingSystemStoragePanel
              :count="filesystem.length"
              :items="storageItems"
              :empty-label="filesystemLoading ? t('global.loading') : $t('system.noStorage')"
              :error="filesystemError || ''"
            />
          </div>
        </template>

        <template #database>
          <SaplingSystemDatabasePanel
            class="sapling-system-tab-panel"
            :name="displayValue(database?.name)"
            :engine="displayValue(database?.engine)"
            :table-count="database?.tableCount ?? 0"
            :loading="databaseLoading"
            :items="databaseTableItems"
            :show-all-label="$t('system.showAllDatabaseTables')"
            :details="databaseDetails"
            :error="databaseError || ''"
            @show-details="openSizeDetails('database')"
          />
        </template>

        <template #network>
          <SaplingSystemNetworkPanel
            :active-interface-count="activeInterfaceCount"
            :items="networkItems"
            :empty-label="networkLoading ? t('global.loading') : $t('system.noNetwork')"
            :error="networkError || ''"
          />
        </template>

        <template #system>
          <SaplingSystemOverviewPanel
            class="sapling-system-tab-panel"
            :hostname="displayValue(os?.hostname)"
            :details="overviewDetails"
          />
        </template>
      </SaplingSystemMonitoring>

      <SaplingSystemSizeDetailsDialog
        v-model="sizeDetailsOpen"
        :eyebrow="$t('system.details')"
        :title="sizeDetailsTitle"
        :total-size-label="sizeDetailsTotalSizeLabel"
        :total-count-label="sizeDetailsTotalCountLabel"
        :total-size-caption="$t('system.totalSize')"
        :total-count-caption="sizeDetailsTotalCountCaption"
        :empty-label="sizeDetailsEmptyLabel"
        :loading="sizeDetailsLoading"
        :error="sizeDetailsError"
        :items="sizeDetailsItems"
      />
    </template>
  </v-container>
</template>

<script lang="ts" setup>
// #region Imports
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Database, NetworkInterface } from '@/entity/system'
import { useSaplingSystem } from '@/composables/system/useSaplingSystem'
import SaplingSystemDatabasePanel from '@/components/system/SaplingSystemDatabasePanel.vue'
import SaplingSystemDocumentStoragePanel from '@/components/system/SaplingSystemDocumentStoragePanel.vue'
import SaplingSystemNetworkPanel from '@/components/system/SaplingSystemNetworkPanel.vue'
import SaplingSystemOverviewPanel from '@/components/system/SaplingSystemOverviewPanel.vue'
import SaplingSystemPerformancePanel from '@/components/system/SaplingSystemPerformancePanel.vue'
import SaplingSystemSizeDetailsDialog from '@/components/system/SaplingSystemSizeDetailsDialog.vue'
import SaplingSystemStoragePanel from '@/components/system/SaplingSystemStoragePanel.vue'
import SaplingSystemMonitoring from '@/components/system/SaplingSystemMonitoring.vue'
// #endregion

// #region Composable
const {
  cpu,
  cpuLoading,
  cpuSpeed,
  cpuSpeedLoading,
  memory,
  memoryLoading,
  filesystem,
  filesystemLoading,
  filesystemError,
  os,
  osLoading,
  state,
  time,
  timeLoading,
  version,
  versionLoading,
  network,
  networkLoading,
  networkError,
  database,
  databaseLoading,
  databaseError,
  documentStorage,
  documentStorageLoading,
  documentStorageError,
  databaseTables,
  databaseTablesLoading,
  databaseTablesError,
  documentStorageEntities,
  documentStorageEntitiesLoading,
  documentStorageEntitiesError,
  isLoading,
  fetchAll,
  fetchDatabaseTables,
  fetchDocumentStorageEntities,
  formatGigabytes,
  formatBytes,
  formatBytesPerSecond,
  formatPercentage,
  formatDateTime,
  formatUptime,
} = useSaplingSystem()
// #endregion

// #region State
const refreshing = ref(false)
const sizeDetailsOpen = ref(false)
const sizeDetailsKind = ref<'database' | 'documentStorage'>('database')
const { t, te } = useI18n()
// #endregion

// #region Computed
const systemTitle = computed(() => os.value?.hostname || t('system.system'))

const systemSubtitle = computed(() => {
  const segments = [os.value?.distro, os.value?.release, os.value?.arch].filter(Boolean)
  return segments.length ? segments.join(' • ') : displayValue(os.value?.platform)
})

const osSummary = computed(() => [os.value?.distro, os.value?.release].filter(Boolean).join(' '))
const cpuLoadPercentage = computed(() => cpuSpeed.value?.currentLoad ?? 0)

const memoryUsagePercentage = computed(() => {
  if (!memory.value?.total) {
    return 0
  }

  return (memory.value.used / memory.value.total) * 100
})

const activeInterfaceCount = computed(() => {
  return network.value.filter((iface) => isInterfaceActive(iface.operstate)).length
})

const formattedServerTime = computed(() => formatDateTime(time.value?.current))
const formattedUptime = computed(() => formatUptime(time.value?.uptime))
const versionDisplay = computed(() =>
  version.value?.version ? `v${version.value.version}` : t('global.notAvailable'),
)

const timezoneDisplay = computed(() => {
  const parts = [time.value?.timezoneName, time.value?.timezone].filter(Boolean)
  return parts.length ? parts.join(' • ') : t('global.notAvailable')
})

const cpuSpeedSummary = computed(() => {
  if (!cpu.value) {
    return t('global.notAvailable')
  }

  return `${cpu.value.speed} GHz · min ${cpu.value.speedMin ?? cpu.value.speed} GHz · max ${cpu.value.speedMax ?? cpu.value.speed} GHz`
})

const overviewDetails = computed(() => [
  {
    label: t('system.os'),
    value: displayValue(osSummary.value),
    loading: osLoading.value,
  },
  {
    label: t('system.kernel'),
    value: displayValue(os.value?.kernel),
    loading: osLoading.value,
  },
  {
    label: t('system.hostname'),
    value: displayValue(os.value?.hostname),
    loading: osLoading.value,
  },
  {
    label: t('system.arch'),
    value: displayValue(os.value?.arch),
    loading: osLoading.value,
  },
  {
    label: t('system.fqdn'),
    value: displayValue(os.value?.fqdn),
    loading: osLoading.value,
  },
  {
    label: t('system.codename'),
    value: displayValue(os.value?.codename),
    loading: osLoading.value,
  },
  {
    label: t('system.serverTime'),
    value: formattedServerTime.value,
    loading: timeLoading.value,
  },
  {
    label: t('system.timezone'),
    value: timezoneDisplay.value,
    loading: timeLoading.value,
  },
  {
    label: t('system.uptime'),
    value: formattedUptime.value,
    loading: timeLoading.value,
  },
  {
    label: t('system.build'),
    value: versionDisplay.value,
    loading: versionLoading.value,
  },
])

const performanceDetails = computed(() => [
  {
    label: t('system.socket'),
    value: displayValue(cpu.value?.socket),
    loading: cpuLoading.value,
  },
  {
    label: t('system.speed'),
    value: cpuSpeedSummary.value,
    loading: cpuLoading.value,
  },
  {
    label: t('system.cores'),
    value: displayValue(cpu.value?.cores),
    loading: cpuLoading.value,
  },
  {
    label: t('system.physicalCores'),
    value: displayValue(cpu.value?.physicalCores),
    loading: cpuLoading.value,
  },
  {
    label: t('system.processors'),
    value: displayValue(cpu.value?.processors),
    loading: cpuLoading.value,
  },
  {
    label: t('system.virtualization'),
    value: cpu.value?.virtualization
      ? t('system.virtualizationEnabled')
      : t('system.virtualizationDisabled'),
    loading: cpuLoading.value,
  },
  {
    label: t('system.total'),
    value: formatGigabytes(memory.value?.total ?? 0),
    loading: memoryLoading.value,
  },
  {
    label: t('system.available'),
    value: formatGigabytes(memory.value?.available ?? 0),
    loading: memoryLoading.value,
  },
])

const databaseDetails = computed(() => [
  {
    label: t('system.databaseVersion'),
    value: displayValue(database.value?.version),
    loading: databaseLoading.value,
  },
  {
    label: t('system.databaseSize'),
    value: formatBytes(database.value?.size ?? 0),
    loading: databaseLoading.value,
  },
  {
    label: t('system.databaseSchema'),
    value: displayValue(database.value?.schema),
    loading: databaseLoading.value,
  },
  {
    label: t('system.databaseConnections'),
    value: database.value
      ? `${database.value.activeConnections} / ${database.value.maxConnections}`
      : t('global.notAvailable'),
    loading: databaseLoading.value,
  },
])

const databaseTableItems = computed(() => {
  const totalSize = database.value?.size ?? 0

  return (database.value?.largestTables ?? []).map((table) => {
    const share = totalSize > 0 ? (table.size / totalSize) * 100 : 0

    return {
      schema: table.schema,
      name: table.name,
      label: getDatabaseTableLabel(table),
      sizeLabel: formatBytes(table.size),
      share,
      shareLabel: formatPercentage(share),
    }
  })
})

const storageItems = computed(() =>
  filesystem.value.map((fs) => ({
    key: fs.fs,
    title: fs.fs,
    subtitle: fs.type,
    usageLabel: formatPercentage(fs.use),
    usageProgress: fs.use,
    sizeLabel: formatGigabytes(fs.size),
    usedLabel: formatGigabytes(fs.used),
    freeLabel: formatGigabytes(fs.available),
  })),
)

const documentStorageItems = computed(() => {
  const totalSize = documentStorage.value?.totalSize ?? 0

  return (documentStorage.value?.entities ?? []).slice(0, 9).map((entity) => {
    const translationKey = `navigation.${entity.entityHandle}`
    const share = totalSize > 0 ? (entity.size / totalSize) * 100 : 0

    return {
      entityHandle: entity.entityHandle,
      label: te(translationKey) ? t(translationKey) : entity.entityHandle,
      sizeLabel: formatBytes(entity.size),
      fileCount: entity.fileCount,
      share,
      shareLabel: formatPercentage(share),
    }
  })
})

const sizeDetailsTitle = computed(() =>
  sizeDetailsKind.value === 'database'
    ? t('system.allDatabaseTables')
    : t('system.allStorageFolders'),
)

const sizeDetailsTotalSizeLabel = computed(() =>
  formatBytes(
    sizeDetailsKind.value === 'database'
      ? (database.value?.size ?? 0)
      : (documentStorage.value?.totalSize ?? 0),
  ),
)

const sizeDetailsTotalCountLabel = computed(() =>
  String(
    sizeDetailsKind.value === 'database'
      ? (database.value?.tableCount ?? 0)
      : (documentStorage.value?.entityCount ?? 0),
  ),
)

const sizeDetailsTotalCountCaption = computed(() =>
  sizeDetailsKind.value === 'database' ? t('system.databaseTables') : t('system.storageFolders'),
)

const sizeDetailsEmptyLabel = computed(() =>
  sizeDetailsKind.value === 'database'
    ? t('system.noDatabaseTables')
    : t('system.noDocumentsStored'),
)

const sizeDetailsLoading = computed(() =>
  sizeDetailsKind.value === 'database'
    ? databaseTablesLoading.value
    : documentStorageEntitiesLoading.value,
)

const sizeDetailsError = computed(() => {
  const error =
    sizeDetailsKind.value === 'database'
      ? databaseTablesError.value
      : documentStorageEntitiesError.value
  return error ? t(error) : ''
})

const sizeDetailsItems = computed(() => {
  if (sizeDetailsKind.value === 'database') {
    const totalSize = database.value?.size ?? 0
    return databaseTables.value.map((table) => {
      const share = totalSize > 0 ? (table.size / totalSize) * 100 : 0
      return {
        key: `${table.schema}.${table.name}`,
        label: getDatabaseTableLabel(table),
        sizeLabel: formatBytes(table.size),
        share,
        shareLabel: formatPercentage(share),
      }
    })
  }

  const totalSize = documentStorage.value?.totalSize ?? 0
  return documentStorageEntities.value.map((entity) => {
    const translationKey = `navigation.${entity.entityHandle}`
    const share = totalSize > 0 ? (entity.size / totalSize) * 100 : 0
    return {
      key: entity.entityHandle,
      label: te(translationKey) ? t(translationKey) : entity.entityHandle,
      sizeLabel: formatBytes(entity.size),
      share,
      shareLabel: formatPercentage(share),
    }
  })
})

function getDatabaseTableLabel(table: Database['largestTables'][number]): string {
  if (!table.entityHandle) return table.name

  const translationKey = `navigation.${table.entityHandle}`
  return te(translationKey) ? t(translationKey) : table.entityHandle
}

const networkItems = computed(() =>
  network.value.map((iface) => ({
    key: iface.iface,
    title: iface.iface,
    subtitle: interfaceStateLabel(iface.operstate),
    isActive: isInterfaceActive(iface.operstate),
    incidentCount: interfaceIncidentCount(iface),
    receivedLabel: formatBytes(iface.rx_bytes),
    sentLabel: formatBytes(iface.tx_bytes),
    receivedRateLabel: formatBytesPerSecond(iface.rx_sec),
    sentRateLabel: formatBytesPerSecond(iface.tx_sec),
    pingLabel: `${iface.ms} ms`,
    errorCount: iface.rx_errors + iface.tx_errors,
    dropCount: iface.rx_dropped + iface.tx_dropped,
  })),
)
// #endregion

// #region Methods
function displayValue(value: string | number | null | undefined) {
  if (value == null || value === '') {
    return t('global.notAvailable')
  }

  return String(value)
}

function isInterfaceActive(stateValue: string | null | undefined) {
  return String(stateValue || '').toLowerCase() === 'up'
}

function interfaceStateLabel(stateValue: string | null | undefined) {
  const label = displayValue(stateValue)
  return label === t('global.notAvailable') ? t('system.unknownState') : label
}

function interfaceIncidentCount(iface: NetworkInterface) {
  return iface.rx_errors + iface.tx_errors + iface.rx_dropped + iface.tx_dropped
}

async function refreshDashboard() {
  refreshing.value = true

  try {
    await fetchAll()
  } finally {
    refreshing.value = false
  }
}

async function openSizeDetails(kind: 'database' | 'documentStorage') {
  sizeDetailsKind.value = kind
  sizeDetailsOpen.value = true

  if (kind === 'database') {
    await fetchDatabaseTables()
    return
  }

  await fetchDocumentStorageEntities()
}
// #endregion
</script>

<style scoped>
.sapling-system-tab-stack {
  display: grid;
  gap: 18px;
}

.sapling-system-tab-panel {
  width: 100%;
}

.sapling-system-context {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 68px;
  margin-bottom: 14px;
  padding: 10px 16px;
}

.sapling-system-context__title {
  display: grid;
  grid-template-columns: auto auto;
  align-items: baseline;
  gap: 2px 10px;
}

.sapling-system-context__title small {
  grid-column: 2;
  color: rgb(var(--v-theme-on-surface-variant));
}

.sapling-system-context__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.8rem;
}

@media (max-width: 760px) {
  .sapling-system-context {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
