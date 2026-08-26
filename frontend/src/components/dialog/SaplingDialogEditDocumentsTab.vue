<template>
  <div
    class="sapling-record-dialog-tab-scroll sapling-dialog-edit-tab-scroll sapling-dialog-edit-tab-scroll--documents"
  >
    <section class="sapling-stack-md sapling-record-documents">
      <v-skeleton-loader
        v-if="isResolvingDocumentMode || isTranslationLoading"
        class="sapling-record-documents__loading"
        elevation="12"
        type="table, image"
      />

      <div
        v-else-if="!documentModeError && isDvelopActive"
        class="sapling-section-panel sapling-record-documents__cloud"
      >
        <header class="sapling-record-documents__panel-header">
          <div class="sapling-record-relation-summary">
            <div class="sapling-record-relation-summary__icon">
              <v-icon icon="mdi-file-document-multiple-outline" size="22" />
            </div>
            <div class="sapling-record-relation-summary__copy">
              <span class="sapling-record-relation-summary__eyebrow">{{ entityLabel }}</span>
              <h3 class="sapling-record-relation-summary__title">
                {{ $t('navigation.document') }}
              </h3>
            </div>
          </div>

          <div class="sapling-action-cluster">
            <v-btn variant="tonal" prepend-icon="mdi-open-in-new" @click="showDocuments">
              {{ $t('global.showDocuments') }}
            </v-btn>
            <v-btn
              v-if="canUpload"
              color="primary"
              prepend-icon="mdi-cloud-upload-outline"
              :loading="isOpeningUpload"
              @click="uploadDocument"
            >
              {{ $t('global.uploadDocument') }}
            </v-btn>
          </div>
        </header>

        <div class="sapling-empty-state-panel">
          <div class="sapling-empty-state-panel__icon">
            <v-icon icon="mdi-cloud-outline" size="34" />
          </div>
          <h3 class="sapling-empty-state-panel__title">{{ $t('navigation.document') }}</h3>
          <p class="sapling-empty-state-panel__text">
            {{ $t('document.dvelopTabDescription') }}
          </p>
        </div>
      </div>

      <SaplingFile
        v-else-if="!documentModeError"
        embedded
        entity-handle="document"
        :record-filter="recordFilter"
        :reload-key="reloadKey"
      >
        <template #table-header>
          <header class="sapling-record-documents__panel-header">
            <div class="sapling-record-relation-summary">
              <div class="sapling-record-relation-summary__icon">
                <v-icon icon="mdi-file-document-multiple-outline" size="22" />
              </div>
              <div class="sapling-record-relation-summary__copy">
                <span class="sapling-record-relation-summary__eyebrow">{{ entityLabel }}</span>
                <h3 class="sapling-record-relation-summary__title">
                  {{ $t('navigation.document') }}
                </h3>
              </div>
            </div>

            <v-btn
              v-if="canUpload"
              color="primary"
              size="small"
              variant="tonal"
              prepend-icon="mdi-cloud-upload-outline"
              :loading="isOpeningUpload"
              @click="uploadDocument"
            >
              {{ $t('global.uploadDocument') }}
            </v-btn>
          </header>
        </template>
      </SaplingFile>
    </section>
  </div>

  <SaplingTableRowUpload
    v-if="showUploadDialog"
    :show="showUploadDialog"
    :item="item"
    :entity-handle="entityHandle"
    @close="showUploadDialog = false"
    @uploaded="onUploaded"
  />
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SaplingGenericItem } from '@/entity/entity'
import SaplingFile from '@/components/file/SaplingFile.vue'
import SaplingTableRowUpload from '@/components/table/SaplingTableRowUpload.vue'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import ApiDocumentService from '@/services/api.document.service'
import { openDocumentView, openDvelopUploadDialog } from '@/utils/saplingDocumentActionUtil'

const props = defineProps<{
  item: SaplingGenericItem | null
  entityHandle: string
  canUpload: boolean
}>()

const { t, te } = useI18n()
const { isLoading: isTranslationLoading } = useTranslationLoader('document', 'global')
const isResolvingDocumentMode = ref(false)
const isOpeningUpload = ref(false)
const isDvelopActive = ref(false)
const documentModeError = ref(false)
const showUploadDialog = ref(false)
const reloadKey = ref(0)

const referenceHandle = computed(() => {
  const handle = props.item?.handle
  return handle == null ? '' : String(handle)
})

const recordFilter = computed(() => ({
  entity: props.entityHandle,
  reference: referenceHandle.value,
}))

const entityLabel = computed(() => {
  const key = `navigation.${props.entityHandle}`
  return te(key) ? t(key) : props.entityHandle
})

async function resolveDocumentMode() {
  if (!props.entityHandle || !referenceHandle.value) {
    return
  }

  isResolvingDocumentMode.value = true
  documentModeError.value = false

  try {
    const result = await ApiDocumentService.getDvelopDocumentsUrl(
      props.entityHandle,
      referenceHandle.value,
    )
    isDvelopActive.value = result.isActive
  } catch {
    documentModeError.value = true
  } finally {
    isResolvingDocumentMode.value = false
  }
}

async function showDocuments() {
  if (!referenceHandle.value) {
    return
  }

  try {
    await openDocumentView(props.entityHandle, referenceHandle.value)
  } catch {
    return
  }
}

async function uploadDocument() {
  if (!props.canUpload || !referenceHandle.value) {
    return
  }

  isOpeningUpload.value = true

  try {
    const openedInDvelop = await openDvelopUploadDialog(props.entityHandle, referenceHandle.value)
    if (!openedInDvelop) {
      showUploadDialog.value = true
    }
  } catch {
    return
  } finally {
    isOpeningUpload.value = false
  }
}

function onUploaded() {
  showUploadDialog.value = false
  reloadKey.value += 1
}

watch(() => [props.entityHandle, referenceHandle.value] as const, resolveDocumentMode, {
  immediate: true,
})
</script>
