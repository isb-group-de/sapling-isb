<template>
  <v-container
    class="sapling-page-shell sapling-page-shell--panel sapling-page-shell--uniform-inset sapling-page-shell--fill fill-height sapling-dvelop-cloud"
    fluid
  >
    <SaplingPageHero
      class="sapling-dvelop-cloud__hero"
      variant="system"
      :eyebrow="$t('navigationGroup.dvelopCloud')"
      :title="$t('dvelopCloud.title')"
    >
      <p>{{ $t('dvelopCloud.subtitle') }}</p>
      <template #meta>
        <v-chip size="small" color="primary" variant="tonal" prepend-icon="mdi-cloud-outline">
          {{ connections.length }}
        </v-chip>
        <v-chip size="small" variant="outlined" prepend-icon="mdi-database-outline">
          {{ repositories.length }}
        </v-chip>
        <v-chip size="small" variant="outlined" prepend-icon="mdi-shape-outline">
          {{ objectDefinitions.length }}
        </v-chip>
        <v-chip size="small" variant="outlined" prepend-icon="mdi-tag-multiple-outline">
          {{ properties.length }}
        </v-chip>
      </template>
      <template #side>
        <div class="sapling-action-cluster sapling-dvelop-cloud__hero-actions">
          <v-btn
            icon="mdi-cloud-cog-outline"
            variant="tonal"
            :title="$t('dvelopCloud.openConnections')"
            :aria-label="$t('dvelopCloud.openConnections')"
            @click="openRoute('/table/dvelopConnection')"
          />
          <v-btn
            icon="mdi-file-tree-outline"
            variant="tonal"
            :title="$t('dvelopCloud.openMappings')"
            :aria-label="$t('dvelopCloud.openMappings')"
            @click="openRoute('/table/dvelopEntityMapping')"
          />
        </div>
      </template>
    </SaplingPageHero>

    <SaplingDvelopConnectionPanel
      v-model="selectedConnectionHandle"
      :connection-options="connectionOptions"
      :connection="selectedConnection"
      :repository-label="selectedRepositoryLabel"
      :loading="isLoadingConnections"
      :health-status="healthCheckResult?.status"
      :health-capabilities="healthCapabilityRows"
      :is-checking-health="isCheckingHealth"
      :is-syncing-all="isSyncingAll"
      :is-any-syncing="isAnySyncing"
      :is-syncing-repositories="isSyncingRepositories"
      :is-syncing-object-definitions="isSyncingObjectDefinitions"
      :is-syncing-properties="isSyncingProperties"
      @health-check="runHealthCheck"
      @sync-all="syncAll"
      @sync-repositories="syncRepositories"
      @sync-object-definitions="syncObjectDefinitions"
      @sync-properties="syncProperties"
    />

    <SaplingDvelopMetrics
      :repository-count="repositories.length"
      :object-definition-count="objectDefinitions.length"
      :property-count="properties.length"
      :repository-label="selectedRepositoryLabel"
      :last-sync-display="lastSyncDisplay"
      :connection-title="selectedConnection?.title"
    />

    <SaplingDvelopMetadataTables
      :repositories="repositories"
      :object-definitions="objectDefinitions"
      :properties="properties"
      :empty-state-label="emptyStateLabel"
      @open="openRoute"
    />
  </v-container>
</template>
<script lang="ts" setup>
// #region Imports
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import SaplingPageHero from '@/components/common/SaplingPageHero.vue'
import SaplingDvelopConnectionPanel from './SaplingDvelopConnectionPanel.vue'
import SaplingDvelopMetadataTables from './SaplingDvelopMetadataTables.vue'
import SaplingDvelopMetrics from './SaplingDvelopMetrics.vue'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import ApiDvelopService, {
  type DvelopHealthCheckCapabilityKey,
  type DvelopHealthCheckResponse,
} from '@/services/api.dvelop.service'
import ApiGenericService from '@/services/api.generic.service'
import type {
  DvelopConnectionItem,
  DvelopHealthCapabilityRow,
  DvelopObjectDefinitionItem,
  DvelopPropertyItem,
  DvelopRepositoryItem,
} from './dvelopCloudWorkspace.types'
import { capitalizeDvelopKey, formatDvelopDateTime } from './dvelopCloudWorkspace.utils'
// #endregion

const HEALTH_CAPABILITY_KEYS: DvelopHealthCheckCapabilityKey[] = [
  'apiKey',
  'repositories',
  'objectDefinitions',
  'properties',
]

// #region Composables
useTranslationLoader(
  'global',
  'navigationGroup',
  'dvelopCloud',
  'document',
  'dvelopConnection',
  'dvelopRepository',
  'dvelopObjectDefinition',
  'dvelopProperty',
)
const { t } = useI18n()
const router = useRouter()
const messageCenter = useSaplingMessageCenter()
// #endregion

// #region State
const connections = ref<DvelopConnectionItem[]>([])
const repositories = ref<DvelopRepositoryItem[]>([])
const objectDefinitions = ref<DvelopObjectDefinitionItem[]>([])
const properties = ref<DvelopPropertyItem[]>([])
const selectedConnectionHandle = ref<number | null>(null)
const isLoadingConnections = ref(false)
const isLoadingSyncedData = ref(false)
const isSyncingRepositories = ref(false)
const isSyncingObjectDefinitions = ref(false)
const isSyncingProperties = ref(false)
const isCheckingHealth = ref(false)
const healthCheckResult = ref<DvelopHealthCheckResponse | null>(null)
// #endregion

// #region Computed
const connectionOptions = computed(() =>
  connections.value.map((connection) => ({
    title: connection.title,
    value: connection.handle,
  })),
)

const selectedConnection = computed(() =>
  connections.value.find((connection) => connection.handle === selectedConnectionHandle.value),
)

const selectedRepository = computed(() => resolveRepository(selectedConnection.value?.repository))

const selectedRepositoryLabel = computed(() => {
  const repository = selectedRepository.value
  if (!repository) {
    return t('global.notAvailable')
  }

  return repository.title === repository.dvelopId
    ? repository.dvelopId
    : `${repository.title} (${repository.dvelopId})`
})

const isSyncingAll = computed(
  () =>
    isSyncingRepositories.value && isSyncingObjectDefinitions.value && isSyncingProperties.value,
)

const isAnySyncing = computed(
  () =>
    isSyncingRepositories.value || isSyncingObjectDefinitions.value || isSyncingProperties.value,
)

const emptyStateLabel = computed(() =>
  isLoadingSyncedData.value ? t('global.loading') : t('global.noData'),
)

const lastSyncDisplay = computed(() => {
  const dates = [...repositories.value, ...objectDefinitions.value, ...properties.value]
    .map((item) => item.lastSyncedAt)
    .filter(Boolean)
    .map((value) => new Date(value as string | Date))
    .filter((value) => Number.isFinite(value.getTime()))
    .sort((left, right) => right.getTime() - left.getTime())

  return dates.length > 0
    ? formatDvelopDateTime(dates[0], t('global.notAvailable'))
    : t('global.notAvailable')
})

const healthCapabilityRows = computed<DvelopHealthCapabilityRow[]>(() => {
  const capabilities = new Map(
    healthCheckResult.value?.capabilities.map((capability) => [capability.key, capability]) ?? [],
  )

  return HEALTH_CAPABILITY_KEYS.map((key) => {
    const capability = capabilities.get(key)
    return {
      key,
      status: capability?.status,
      count: capability?.count,
    }
  })
})
// #endregion

// #region Lifecycle
onMounted(async () => {
  await loadConnections()
})

watch(selectedConnectionHandle, async () => {
  await loadSyncedData()
})
// #endregion

// #region Methods
async function loadConnections() {
  isLoadingConnections.value = true

  try {
    const response = await ApiGenericService.findAll<DvelopConnectionItem>('dvelopConnection', {
      orderBy: { title: 'ASC' },
    })
    connections.value = response
    const currentConnection = selectedConnectionHandle.value
    selectedConnectionHandle.value =
      connections.value.find((connection) => connection.handle === currentConnection)?.handle ??
      connections.value.find((connection) => connection.isActive)?.handle ??
      connections.value[0]?.handle ??
      null
  } catch (error) {
    handleError(error, t('dvelopCloud.connectionLoadFailed'))
  } finally {
    isLoadingConnections.value = false
  }
}

async function loadSyncedData() {
  if (!selectedConnectionHandle.value) {
    repositories.value = []
    objectDefinitions.value = []
    properties.value = []
    return
  }

  isLoadingSyncedData.value = true

  try {
    const [nextRepositories, nextObjectDefinitions, nextProperties] = await Promise.all([
      loadAllGenericItems<DvelopRepositoryItem>('dvelopRepository', {
        connection: selectedConnectionHandle.value,
      }),
      loadAllGenericItems<DvelopObjectDefinitionItem>('dvelopObjectDefinition', {
        connection: selectedConnectionHandle.value,
      }),
      loadAllGenericItems<DvelopPropertyItem>('dvelopProperty', {
        connection: selectedConnectionHandle.value,
      }),
    ])
    repositories.value = nextRepositories
    objectDefinitions.value = nextObjectDefinitions
    properties.value = nextProperties
  } catch (error) {
    handleError(error, t('dvelopCloud.metadataLoadFailed'))
  } finally {
    isLoadingSyncedData.value = false
  }
}

async function syncAll() {
  if (!selectedConnection.value) {
    return
  }

  isSyncingRepositories.value = true
  isSyncingObjectDefinitions.value = true
  isSyncingProperties.value = true

  try {
    const result = await ApiDvelopService.syncConfiguration(selectedConnection.value.handle, {
      repositories: true,
      objectDefinitions: true,
      properties: true,
    })
    pushSyncSuccess(
      t('dvelopCloud.syncCompleted'),
      `${formatSummary(result.repositories)} / ${formatSummary(result.objectDefinitions)} / ${formatSummary(result.properties)}`,
    )
    await loadConnections()
    await loadSyncedData()
  } catch (error) {
    handleError(error, t('dvelopCloud.syncFailed'))
  } finally {
    isSyncingRepositories.value = false
    isSyncingObjectDefinitions.value = false
    isSyncingProperties.value = false
  }
}

async function runHealthCheck() {
  if (!selectedConnection.value) {
    return
  }

  isCheckingHealth.value = true

  try {
    healthCheckResult.value = await ApiDvelopService.healthCheckConfiguration(
      selectedConnection.value.handle,
    )
    messageCenter.pushMessage(
      healthCheckResult.value.status === 'error' ? 'warning' : 'success',
      t('dvelopCloud.healthCheckCompleted'),
      formatHealthStatus(healthCheckResult.value.status),
      'dvelopCloud',
      healthCheckResult.value,
    )
  } catch (error) {
    handleError(error, t('dvelopCloud.healthCheckFailed'))
  } finally {
    isCheckingHealth.value = false
  }
}

async function syncRepositories() {
  if (!selectedConnection.value) {
    return
  }

  isSyncingRepositories.value = true

  try {
    const result = await ApiDvelopService.syncConfiguration(selectedConnection.value.handle, {
      repositories: true,
    })
    pushSyncSuccess(t('dvelopCloud.repositoriesSynced'), formatSummary(result.repositories))
    await loadConnections()
    await loadSyncedData()
  } catch (error) {
    handleError(error, t('dvelopCloud.syncFailed'))
  } finally {
    isSyncingRepositories.value = false
  }
}

async function syncObjectDefinitions() {
  if (!selectedConnection.value) {
    return
  }

  isSyncingObjectDefinitions.value = true

  try {
    const result = await ApiDvelopService.syncConfiguration(selectedConnection.value.handle, {
      objectDefinitions: true,
    })
    pushSyncSuccess(
      t('dvelopCloud.objectDefinitionsSynced'),
      `${formatSummary(result.repositories)} / ${formatSummary(result.objectDefinitions)}`,
    )
    await loadConnections()
    await loadSyncedData()
  } catch (error) {
    handleError(error, t('dvelopCloud.syncFailed'))
  } finally {
    isSyncingObjectDefinitions.value = false
  }
}

async function syncProperties() {
  if (!selectedConnection.value) {
    return
  }

  isSyncingProperties.value = true

  try {
    const result = await ApiDvelopService.syncConfiguration(selectedConnection.value.handle, {
      properties: true,
    })
    pushSyncSuccess(
      t('dvelopCloud.propertiesSynced'),
      `${formatSummary(result.repositories)} / ${formatSummary(result.objectDefinitions)} / ${formatSummary(result.properties)}`,
    )
    await loadConnections()
    await loadSyncedData()
  } catch (error) {
    handleError(error, t('dvelopCloud.syncFailed'))
  } finally {
    isSyncingProperties.value = false
  }
}

async function loadAllGenericItems<T>(
  entityHandle: string,
  filter: Record<string, unknown>,
): Promise<T[]> {
  return ApiGenericService.findAll<T>(entityHandle, {
    filter,
    orderBy: { title: 'ASC', handle: 'ASC' },
  })
}

function formatSummary(summary: {
  total: number
  created: number
  updated: number
  skipped: number
}) {
  return t('dvelopCloud.syncSummary', {
    total: summary.total,
    created: summary.created,
    updated: summary.updated,
    skipped: summary.skipped,
  })
}

function resolveRepository(value: DvelopConnectionItem['repository']): DvelopRepositoryItem | null {
  if (!value) {
    return null
  }

  if (typeof value === 'object' && 'dvelopId' in value) {
    return value
  }

  const handle = Number(value)
  if (!Number.isFinite(handle)) {
    return null
  }

  return repositories.value.find((repository) => Number(repository.handle) === handle) ?? null
}

function formatHealthStatus(status: DvelopHealthCheckResponse['status']): string {
  return t(`dvelopCloud.healthStatus${capitalizeDvelopKey(status)}`)
}

function pushSyncSuccess(message: string, description: string) {
  messageCenter.pushMessage('success', message, description, 'dvelopCloud')
}

function handleError(error: unknown, fallback: string) {
  const message = getErrorMessage(error) || fallback
  messageCenter.pushMessage('error', fallback, message, 'dvelopCloud', error)
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return typeof error === 'string' ? error : ''
}

function openRoute(path: string) {
  void router.push(path)
}
// #endregion
</script>
