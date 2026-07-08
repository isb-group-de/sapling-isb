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

    <SaplingSurface
      as="section"
      class="sapling-panel-shell sapling-section-panel sapling-dvelop-cloud__control-band"
    >
      <div class="sapling-dvelop-cloud__connection-panel">
        <v-select
          v-model="selectedConnectionHandle"
          class="sapling-dvelop-cloud__connection-field"
          :items="connectionOptions"
          :loading="isLoadingConnections"
          item-title="title"
          item-value="value"
          prepend-inner-icon="mdi-cloud-outline"
          variant="outlined"
          density="comfortable"
          hide-details="auto"
          :label="$t('dvelopCloud.connection')"
        />

        <div
          v-if="selectedConnection"
          class="sapling-detail-grid sapling-dvelop-cloud__connection-meta"
        >
          <div class="sapling-detail-card">
            <span>{{ $t('dvelopConnection.baseUrl') }}</span>
            <strong class="sapling-dvelop-cloud__meta-value">{{
              selectedConnection.baseUrl
            }}</strong>
          </div>
          <div class="sapling-detail-card">
            <span>{{ $t('dvelopConnection.repository') }}</span>
            <strong class="sapling-dvelop-cloud__meta-value">
              {{ selectedRepositoryLabel }}
            </strong>
          </div>
          <div class="sapling-detail-card">
            <span>{{ $t('dvelopConnection.isActive') }}</span>
            <strong>
              <v-chip
                :color="selectedConnection.isActive ? 'success' : 'default'"
                size="small"
                variant="tonal"
              >
                {{ selectedConnection.isActive ? $t('global.yes') : $t('global.no') }}
              </v-chip>
            </strong>
          </div>
        </div>
      </div>

      <div class="sapling-action-cluster sapling-dvelop-cloud__sync-actions">
        <v-btn
          color="primary"
          variant="flat"
          prepend-icon="mdi-download"
          :disabled="!selectedConnection"
          :loading="isSyncingAll"
          @click="syncAll"
        >
          {{ $t('dvelopCloud.syncAll') }}
        </v-btn>
        <v-btn
          variant="tonal"
          prepend-icon="mdi-shape-outline"
          :disabled="!selectedConnection || isAnySyncing"
          :loading="isSyncingObjectDefinitions"
          @click="syncObjectDefinitions"
        >
          {{ $t('dvelopCloud.syncObjectDefinitions') }}
        </v-btn>
        <v-btn
          variant="tonal"
          prepend-icon="mdi-tag-multiple-outline"
          :disabled="!selectedConnection || isAnySyncing"
          :loading="isSyncingProperties"
          @click="syncProperties"
        >
          {{ $t('dvelopCloud.syncProperties') }}
        </v-btn>
      </div>
    </SaplingSurface>

    <section
      class="sapling-responsive-grid sapling-responsive-grid--md sapling-dvelop-cloud__metrics"
    >
      <SaplingSurface as="article" class="sapling-metric-card sapling-dvelop-cloud__metric">
        <div class="sapling-icon-tile sapling-icon-tile--primary-soft">
          <v-icon icon="mdi-database-outline" />
        </div>
        <div class="sapling-metric-card__copy">
          <p>{{ $t('dvelopCloud.repositories') }}</p>
          <strong>{{ repositories.length }}</strong>
          <span>{{ selectedRepositoryLabel }}</span>
        </div>
      </SaplingSurface>
      <SaplingSurface as="article" class="sapling-metric-card sapling-dvelop-cloud__metric">
        <div class="sapling-icon-tile sapling-icon-tile--info-soft">
          <v-icon icon="mdi-shape-outline" />
        </div>
        <div class="sapling-metric-card__copy">
          <p>{{ $t('dvelopCloud.objectDefinitions') }}</p>
          <strong>{{ objectDefinitions.length }}</strong>
          <span>{{ $t('dvelopCloud.categories') }}</span>
        </div>
      </SaplingSurface>
      <SaplingSurface as="article" class="sapling-metric-card sapling-dvelop-cloud__metric">
        <div class="sapling-icon-tile sapling-icon-tile--success-soft">
          <v-icon icon="mdi-tag-multiple-outline" />
        </div>
        <div class="sapling-metric-card__copy">
          <p>{{ $t('dvelopCloud.properties') }}</p>
          <strong>{{ properties.length }}</strong>
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
          <span>{{ selectedConnection?.title || $t('dvelopCloud.connection') }}</span>
        </div>
      </SaplingSurface>
    </section>

    <section class="sapling-dvelop-cloud__tables">
      <SaplingSurface
        as="section"
        class="sapling-panel-shell sapling-section-panel sapling-dvelop-cloud__table-panel"
      >
        <div class="sapling-section-header">
          <div>
            <span class="sapling-label">{{ $t('dvelopCloud.repositories') }}</span>
            <h2 class="sapling-section-title">{{ $t('dvelopCloud.repositoryList') }}</h2>
          </div>
          <v-btn
            icon="mdi-table"
            size="small"
            variant="text"
            :title="$t('dvelopCloud.openRepositories')"
            :aria-label="$t('dvelopCloud.openRepositories')"
            @click="openRoute('/table/dvelopRepository')"
          />
        </div>

        <v-table density="compact" class="sapling-table sapling-dvelop-cloud__table">
          <thead>
            <tr>
              <th>{{ $t('dvelopRepository.title') }}</th>
              <th>{{ $t('dvelopRepository.dvelopId') }}</th>
              <th>{{ $t('dvelopRepository.lastSyncedAt') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in repositories" :key="item.handle ?? item.dvelopId">
              <td>{{ item.title }}</td>
              <td>{{ item.dvelopId }}</td>
              <td>{{ formatDateTime(item.lastSyncedAt) }}</td>
            </tr>
            <tr v-if="repositories.length === 0">
              <td colspan="3">
                <div class="sapling-inline-empty">{{ emptyStateLabel }}</div>
              </td>
            </tr>
          </tbody>
        </v-table>
      </SaplingSurface>

      <SaplingSurface
        as="section"
        class="sapling-panel-shell sapling-section-panel sapling-dvelop-cloud__table-panel"
      >
        <div class="sapling-section-header">
          <div>
            <span class="sapling-label">{{ $t('dvelopCloud.objectDefinitions') }}</span>
            <h2 class="sapling-section-title">{{ $t('dvelopCloud.categories') }}</h2>
          </div>
          <v-btn
            icon="mdi-table"
            size="small"
            variant="text"
            :title="$t('dvelopCloud.openObjectDefinitions')"
            :aria-label="$t('dvelopCloud.openObjectDefinitions')"
            @click="openRoute('/table/dvelopObjectDefinition')"
          />
        </div>

        <v-table density="compact" class="sapling-table sapling-dvelop-cloud__table">
          <thead>
            <tr>
              <th>{{ $t('dvelopObjectDefinition.title') }}</th>
              <th>{{ $t('dvelopObjectDefinition.dvelopId') }}</th>
              <th>{{ $t('dvelopObjectDefinition.lastSyncedAt') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in objectDefinitions" :key="item.handle ?? item.dvelopId">
              <td>{{ item.title }}</td>
              <td>{{ item.dvelopId }}</td>
              <td>{{ formatDateTime(item.lastSyncedAt) }}</td>
            </tr>
            <tr v-if="objectDefinitions.length === 0">
              <td colspan="3">
                <div class="sapling-inline-empty">{{ emptyStateLabel }}</div>
              </td>
            </tr>
          </tbody>
        </v-table>
      </SaplingSurface>

      <SaplingSurface
        as="section"
        class="sapling-panel-shell sapling-section-panel sapling-dvelop-cloud__table-panel"
      >
        <div class="sapling-section-header">
          <div>
            <span class="sapling-label">{{ $t('dvelopCloud.properties') }}</span>
            <h2 class="sapling-section-title">{{ $t('dvelopCloud.fields') }}</h2>
          </div>
          <v-btn
            icon="mdi-table"
            size="small"
            variant="text"
            :title="$t('dvelopCloud.openProperties')"
            :aria-label="$t('dvelopCloud.openProperties')"
            @click="openRoute('/table/dvelopProperty')"
          />
        </div>

        <v-table density="compact" class="sapling-table sapling-dvelop-cloud__table">
          <thead>
            <tr>
              <th>{{ $t('dvelopProperty.title') }}</th>
              <th>{{ $t('dvelopProperty.dvelopId') }}</th>
              <th>{{ $t('dvelopProperty.dataType') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in properties" :key="item.handle ?? item.dvelopId">
              <td>{{ item.title }}</td>
              <td>{{ item.dvelopId }}</td>
              <td>{{ item.dataType || $t('global.notAvailable') }}</td>
            </tr>
            <tr v-if="properties.length === 0">
              <td colspan="3">
                <div class="sapling-inline-empty">{{ emptyStateLabel }}</div>
              </td>
            </tr>
          </tbody>
        </v-table>
      </SaplingSurface>
    </section>
  </v-container>
</template>

<script lang="ts" setup>
// #region Imports
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import SaplingPageHero from '@/components/common/SaplingPageHero.vue'
import SaplingSurface from '@/components/common/SaplingSurface.vue'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import type { SaplingGenericItem } from '@/entity/entity'
import ApiDvelopService from '@/services/api.dvelop.service'
import ApiGenericService from '@/services/api.generic.service'
// #endregion

interface DvelopConnectionItem extends SaplingGenericItem {
  handle: number
  title: string
  baseUrl: string
  repository?: DvelopRepositoryItem | number | string | null
  isActive: boolean
}

interface DvelopRepositoryItem extends SaplingGenericItem {
  handle?: number | null
  title: string
  dvelopId: string
  lastSyncedAt?: string | Date | null
}

interface DvelopObjectDefinitionItem extends SaplingGenericItem {
  handle?: number | null
  title: string
  dvelopId: string
  lastSyncedAt?: string | Date | null
}

interface DvelopPropertyItem extends SaplingGenericItem {
  handle?: number | null
  title: string
  dvelopId: string
  dataType?: string | null
  lastSyncedAt?: string | Date | null
}

const GENERIC_PAGE_LIMIT = 200

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

  return dates.length > 0 ? formatDateTime(dates[0]) : t('global.notAvailable')
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
    const response = await ApiGenericService.find<DvelopConnectionItem>('dvelopConnection', {
      orderBy: { title: 'ASC' },
      limit: GENERIC_PAGE_LIMIT,
    })
    connections.value = response.data
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
      formatSummary(result.objectDefinitions),
    )
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
    pushSyncSuccess(t('dvelopCloud.propertiesSynced'), formatSummary(result.properties))
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
  const items: T[] = []
  let page = 1

  while (true) {
    const response = await ApiGenericService.find<T>(entityHandle, {
      filter,
      orderBy: { title: 'ASC' },
      page,
      limit: GENERIC_PAGE_LIMIT,
    })
    items.push(...response.data)

    if (page >= response.meta.totalPages || response.data.length === 0) {
      return items
    }

    page += 1
  }
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

function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) {
    return t('global.notAvailable')
  }

  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) {
    return t('global.notAvailable')
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function openRoute(path: string) {
  void router.push(path)
}
// #endregion
</script>
