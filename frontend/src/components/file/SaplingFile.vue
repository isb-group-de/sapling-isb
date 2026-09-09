<template>
  <v-container :class="fileContainerClasses" density="compact" fluid>
    <section
      class="sapling-browser-workspace sapling-browser-workspace--balanced sapling-file-workspace"
    >
      <template v-if="isTranslationLoading">
        <SaplingSurface
          as="aside"
          class="sapling-workspace-panel sapling-browser-workspace__sidebar sapling-browser-workspace__loading-panel sapling-file-workspace__sidebar sapling-file-loading-panel"
        >
          <v-skeleton-loader type="heading, table-heading, table-tbody" />
        </SaplingSurface>

        <section class="sapling-browser-workspace__detail sapling-file-workspace__detail">
          <SaplingSurface
            as="header"
            class="sapling-document-header sapling-browser-workspace__loading-panel sapling-file-loading-panel"
          >
            <v-skeleton-loader class="sapling-document-header__skeleton" type="heading, text" />
          </SaplingSurface>

          <SaplingSurface
            as="section"
            class="sapling-panel-shell sapling-preview-stage sapling-file-stage sapling-browser-workspace__loading-panel sapling-file-loading-panel"
          >
            <v-skeleton-loader
              class="sapling-preview-stage__skeleton sapling-file-stage__skeleton"
              type="image, article"
            />
          </SaplingSurface>
        </section>
      </template>

      <template v-else>
        <div
          class="sapling-panel-shell sapling-browser-workspace__table-shell sapling-file-workspace__table-shell"
        >
          <slot name="table-header" />

          <div
            class="sapling-browser-scroll sapling-browser-scroll--flush sapling-document-table-scroll"
          >
            <SaplingTable
              :items="items"
              :search="search ?? ''"
              :page="page"
              :items-per-page="itemsPerPage"
              :total-items="totalItems"
              :is-loading="isLoading"
              :sort-by="sortBy"
              :column-filters="columnFilters"
              :active-filter="activeFilter"
              :entity-handle="entity?.handle || ''"
              :entity="entity"
              :entity-permission="entityPermission"
              :entity-templates="entityTemplates || []"
              :show-actions="true"
              :multi-select="true"
              :active-item="activeDocument"
              :show-favorite="false"
              :parent-filter="parentFilter"
              :table-key="entityHandleRef + '-table'"
              @update:active-item="onActiveDocument"
              @update:search="onSearchUpdate"
              @update:page="onPageUpdate"
              @update:items-per-page="onItemsPerPageUpdate"
              @update:sort-by="onSortByUpdate"
              @update:column-filters="onColumnFiltersUpdate"
              @reload="loadData"
            />
          </div>
        </div>

        <section class="sapling-browser-workspace__detail sapling-file-workspace__detail">
          <SaplingFileHeader
            :selected-handle="selectedHandle"
            :selected-filename="selectedFilename"
            :preview-type="previewType"
            :has-selection="hasSelection"
            :is-loading="isPreviewLoading"
            :on-download-document="onDownloadDocument"
          />

          <SaplingFileDetail
            :has-selection="hasSelection"
            :is-loading="isPreviewLoading"
            :preview-component="previewComponent"
            :preview-props="previewProps"
          />
        </section>
      </template>
    </section>
  </v-container>
</template>

<script lang="ts" setup>
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import { BACKEND_URL, DEFAULT_PAGE_SIZE_SMALL } from '@/constants/project.constants'
import { useSaplingTable } from '@/composables/table/useSaplingTable'
import type { SaplingGenericItem } from '@/entity/entity'
import { defineAsyncComponent, ref, computed, onMounted, watch } from 'vue'
import SaplingSurface from '@/components/common/SaplingSurface.vue'
import SaplingFilePDF from './SaplingFilePDF.vue'
import SaplingFileImage from './SaplingFileImage.vue'
import { getImagePreviewMimeType, getPreviewType } from '@/utils/documentPreview'
import SaplingFileAudio from './SaplingFileAudio.vue'
import SaplingFileVideo from './SaplingFileVideo.vue'
import SaplingFileNoPreview from './SaplingFileNoPreview.vue'
import SaplingFileDetail from './SaplingFileDetail.vue'
import SaplingFileJSON from './SaplingFileJSON.vue'
import SaplingFileHeader from './SaplingFileHeader.vue'
import SaplingFileMail from './SaplingFileMail.vue'

const SaplingTable = defineAsyncComponent(() => import('@/components/table/SaplingTable.vue'))
const props = withDefaults(
  defineProps<{
    entityHandle: string
    recordFilter?: Record<string, unknown> | null
    embedded?: boolean
    reloadKey?: number
  }>(),
  {
    recordFilter: null,
    embedded: false,
    reloadKey: 0,
  },
)
const emit = defineEmits<{
  (event: 'update:total', value: number): void
}>()
const entityHandleRef = ref(props.entityHandle)
const { isLoading: isTranslationLoading } = useTranslationLoader('document', 'global')

const table = useSaplingTable(
  entityHandleRef,
  DEFAULT_PAGE_SIZE_SMALL,
  props.recordFilter == null,
  false,
  undefined,
  ['filename', 'mimetype'],
)

const {
  items,
  search,
  page,
  itemsPerPage,
  totalItems,
  isLoading,
  sortBy,
  columnFilters,
  activeFilter,
  entityTemplates,
  entity,
  entityPermission,
  isInitialized,
  loadData,
  onSearchUpdate,
  onPageUpdate,
  onItemsPerPageUpdate,
  onColumnFiltersUpdate,
  onSortByUpdate,
  parentFilter,
} = table

watch(
  [isInitialized, totalItems],
  ([initialized, total]) => {
    if (initialized) {
      emit('update:total', total)
    }
  },
  { immediate: true },
)

onMounted(() => {
  void table.initializeEntityState({
    beforeInitialLoad: () => {
      if (props.recordFilter) {
        parentFilter.value = { ...props.recordFilter }
      }
    },
  })
})

const fileContainerClasses = computed(() => [
  'sapling-fill-shell',
  props.embedded
    ? 'sapling-file-embedded'
    : 'sapling-page-shell sapling-page-shell--panel sapling-page-shell--fill sapling-page-shell--uniform-inset sapling-browser-page sapling-file-page',
])

const selectedHandle = ref('')
const activeDocument = ref<SaplingGenericItem | null>(null)

const selectedMimeType = ref('')

const selectedFilename = ref('')

watch(
  () => props.entityHandle,
  (value) => {
    entityHandleRef.value = value
    clearSelection()
  },
)

watch(
  () => JSON.stringify(props.recordFilter ?? {}),
  () => {
    if (!props.recordFilter) {
      return
    }

    parentFilter.value = { ...props.recordFilter }
    page.value = 1
    clearSelection()
  },
)

watch(
  () => props.reloadKey,
  () => {
    clearSelection()
    void loadData()
  },
)

const hasSelection = computed(() => selectedHandle.value.length > 0)
const isPreviewLoading = computed(() => isLoading.value && !isInitialized.value)

function getSelectedDocumentHandle(item?: SaplingGenericItem) {
  const handle = item?.handle
  return handle == null ? '' : String(handle)
}

function onActiveDocument(nextItem: SaplingGenericItem | null) {
  activeDocument.value = nextItem
  selectedHandle.value = getSelectedDocumentHandle(nextItem ?? undefined)
  selectedMimeType.value = nextItem?.mimetype || ''
  selectedFilename.value = normalizeStoredFilename(nextItem?.filename || '')
}

function clearSelection() {
  activeDocument.value = null
  selectedHandle.value = ''
  selectedMimeType.value = ''
  selectedFilename.value = ''
}

function onDownloadDocument() {
  if (!selectedHandle.value) return
  // Korrekte Backend-URL für Download
  const url = `${BACKEND_URL}document/download/${selectedHandle.value}`
  // Download als Datei auslösen
  const link = document.createElement('a')
  link.href = url
  link.download = ''
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const previewType = computed(() => getPreviewType(selectedMimeType.value, selectedFilename.value))
const isImagePreview = computed(() =>
  ['png', 'jpeg', 'svg', 'ico', 'image'].includes(previewType.value),
)

const previewComponent = computed(() => {
  if (previewType.value === 'pdf') return SaplingFilePDF
  if (isImagePreview.value) return SaplingFileImage
  if (previewType.value === 'audio') return SaplingFileAudio
  if (previewType.value === 'video') return SaplingFileVideo
  if (previewType.value === 'json') return SaplingFileJSON
  if (previewType.value === 'mail') return SaplingFileMail
  return SaplingFileNoPreview
})

const previewProps = computed(() => {
  if (!selectedHandle.value) return {}
  if (previewType.value === 'pdf') {
    // PDF Vorschau-Endpunkt
    const url = `${BACKEND_URL}document/preview/${selectedHandle.value}`
    return { pdfUrl: url }
  }
  if (previewType.value === 'json') {
    const url = `${BACKEND_URL}document/download/${selectedHandle.value}`
    return { jsonUrl: url }
  }

  const url = `${BACKEND_URL}document/download/${selectedHandle.value}`
  if (isImagePreview.value) {
    return {
      imageUrl: url,
      mimeType: getImagePreviewMimeType(selectedMimeType.value, selectedFilename.value),
      fileName: selectedFilename.value,
    }
  }
  if (previewType.value === 'audio') {
    return {
      audioUrl: url,
      mimeType: selectedMimeType.value,
      fileName: selectedFilename.value,
    }
  }
  if (previewType.value === 'video') {
    return {
      videoUrl: url,
      mimeType: selectedMimeType.value,
      fileName: selectedFilename.value,
    }
  }
  if (previewType.value === 'mail') {
    return {
      mailUrl: url,
      fileName: selectedFilename.value,
      mimeType: selectedMimeType.value,
    }
  }

  return {}
})

function normalizeStoredFilename(filename: string) {
  if (!filename || [...filename].some((character) => character.charCodeAt(0) > 0xff)) {
    return filename
  }

  const bytes = Uint8Array.from(filename, (character) => character.charCodeAt(0))

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return filename
  }
}
</script>
