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
      <SaplingDataTable
        class="sapling-dvelop-cloud__table"
        :empty-text="emptyStateLabel"
        :items="repositories"
        :columns="[
          { key: 'c0', title: $t('dvelopRepository.title'), value: (item) => item.title },
          { key: 'c1', title: $t('dvelopRepository.dvelopId'), value: (item) => item.dvelopId },
          {
            key: 'c2',
            title: $t('dvelopRepository.lastSyncedAt'),
            value: (item) => item.lastSyncedAt,
          },
        ]"
      >
        <template #row="{ item: item }">
          <tr>
            <td>{{ item.title }}</td>
            <td>{{ item.dvelopId }}</td>
            <td>{{ formatDateTime(item.lastSyncedAt) }}</td>
          </tr>
        </template>
      </SaplingDataTable>
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
      <SaplingDataTable
        class="sapling-dvelop-cloud__table"
        :empty-text="emptyStateLabel"
        :items="objectDefinitions"
        :columns="[
          { key: 'c0', title: $t('dvelopObjectDefinition.title'), value: (item) => item.title },
          {
            key: 'c1',
            title: $t('dvelopObjectDefinition.dvelopId'),
            value: (item) => item.dvelopId,
          },
          {
            key: 'c2',
            title: $t('dvelopObjectDefinition.lastSyncedAt'),
            value: (item) => item.lastSyncedAt,
          },
        ]"
      >
        <template #row="{ item: item }">
          <tr>
            <td>{{ item.title }}</td>
            <td>{{ item.dvelopId }}</td>
            <td>{{ formatDateTime(item.lastSyncedAt) }}</td>
          </tr>
        </template>
      </SaplingDataTable>
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
      <SaplingDataTable
        class="sapling-dvelop-cloud__table"
        :empty-text="emptyStateLabel"
        :items="properties"
        :columns="[
          { key: 'c0', title: $t('dvelopProperty.title'), value: (item) => item.title },
          {
            key: 'c1',
            title: $t('dvelopProperty.objectDefinition'),
            value: (item) => formatReference(item.objectDefinition),
          },
          { key: 'c2', title: $t('dvelopProperty.dvelopId'), value: (item) => item.dvelopId },
          { key: 'c3', title: $t('dvelopProperty.dataType'), value: (item) => item.dataType },
        ]"
      >
        <template #row="{ item: item }">
          <tr>
            <td>{{ item.title }}</td>
            <td>{{ formatReference(item.objectDefinition) }}</td>
            <td>{{ item.dvelopId }}</td>
            <td>{{ item.dataType || $t('global.notAvailable') }}</td>
          </tr>
        </template>
      </SaplingDataTable>
    </SaplingSurface>
  </section>
</template>

<script lang="ts" setup>
import SaplingDataTable from '@/components/table/SaplingDataTable.vue'
import { useI18n } from 'vue-i18n'
import SaplingSurface from '@/components/common/SaplingSurface.vue'
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
