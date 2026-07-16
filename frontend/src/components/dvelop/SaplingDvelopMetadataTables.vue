<template>
  <section class="sapling-dvelop-cloud__tables">
    <SaplingSurface
      as="section"
      class="sapling-panel-shell sapling-section-panel sapling-dvelop-cloud__table-panel"
    >
      <SaplingDvelopTableHeader
        label-key="dvelopCloud.repositories"
        title-key="dvelopCloud.repositoryList"
        open-label-key="dvelopCloud.openRepositories"
        @open="$emit('open', '/table/dvelopRepository')"
      />
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
          <SaplingDvelopEmptyRow
            v-if="repositories.length === 0"
            :label="emptyStateLabel"
            :columns="3"
          />
        </tbody>
      </v-table>
    </SaplingSurface>

    <SaplingSurface
      as="section"
      class="sapling-panel-shell sapling-section-panel sapling-dvelop-cloud__table-panel"
    >
      <SaplingDvelopTableHeader
        label-key="dvelopCloud.objectDefinitions"
        title-key="dvelopCloud.categories"
        open-label-key="dvelopCloud.openObjectDefinitions"
        @open="$emit('open', '/table/dvelopObjectDefinition')"
      />
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
          <SaplingDvelopEmptyRow
            v-if="objectDefinitions.length === 0"
            :label="emptyStateLabel"
            :columns="3"
          />
        </tbody>
      </v-table>
    </SaplingSurface>

    <SaplingSurface
      as="section"
      class="sapling-panel-shell sapling-section-panel sapling-dvelop-cloud__table-panel"
    >
      <SaplingDvelopTableHeader
        label-key="dvelopCloud.properties"
        title-key="dvelopCloud.fields"
        open-label-key="dvelopCloud.openProperties"
        @open="$emit('open', '/table/dvelopProperty')"
      />
      <v-table density="compact" class="sapling-table sapling-dvelop-cloud__table">
        <thead>
          <tr>
            <th>{{ $t('dvelopProperty.title') }}</th>
            <th>{{ $t('dvelopProperty.objectDefinition') }}</th>
            <th>{{ $t('dvelopProperty.dvelopId') }}</th>
            <th>{{ $t('dvelopProperty.dataType') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in properties" :key="item.handle ?? item.dvelopId">
            <td>{{ item.title }}</td>
            <td>{{ formatReference(item.objectDefinition) }}</td>
            <td>{{ item.dvelopId }}</td>
            <td>{{ item.dataType || $t('global.notAvailable') }}</td>
          </tr>
          <SaplingDvelopEmptyRow
            v-if="properties.length === 0"
            :label="emptyStateLabel"
            :columns="4"
          />
        </tbody>
      </v-table>
    </SaplingSurface>
  </section>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import SaplingSurface from '@/components/common/SaplingSurface.vue'
import SaplingDvelopEmptyRow from './SaplingDvelopEmptyRow.vue'
import SaplingDvelopTableHeader from './SaplingDvelopTableHeader.vue'
import type {
  DvelopObjectDefinitionItem,
  DvelopPropertyItem,
  DvelopRepositoryItem,
} from './dvelopCloudWorkspace.types'
import { formatDvelopDateTime, formatDvelopReference } from './dvelopCloudWorkspace.utils'

defineProps<{
  repositories: DvelopRepositoryItem[]
  objectDefinitions: DvelopObjectDefinitionItem[]
  properties: DvelopPropertyItem[]
  emptyStateLabel: string
}>()

defineEmits<{ open: [path: string] }>()

const { t } = useI18n()
const formatDateTime = (value: string | Date | null | undefined) =>
  formatDvelopDateTime(value, t('global.notAvailable'))
const formatReference = (value: DvelopPropertyItem['objectDefinition']) =>
  formatDvelopReference(value, t('global.notAvailable'))
</script>
