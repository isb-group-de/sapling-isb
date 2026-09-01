<template>
  <SaplingDialog
    v-if="modelValue"
    :model-value="modelValue"
    size="lg"
    @keydown.esc.stop="close"
    @update:model-value="updateVisibility"
  >
    <SaplingDialogCard class="sapling-markdown-image-picker" :close="close">
      <SaplingDialogShell
        fill-shell
        body-class="sapling-markdown-image-picker__body"
        :show-divider="false"
      >
        <template #hero>
          <SaplingDialogHero
            :loading="isTranslationLoading"
            :eyebrow="t('global.select')"
            :title="t('markdownImagePicker.selectReferencedImages')"
          />
        </template>

        <template #body>
          <v-skeleton-loader
            v-if="isTranslationLoading"
            class="sapling-markdown-image-picker__content"
            type="text, list-item, image"
          />
          <div v-else class="sapling-stack-md sapling-markdown-image-picker__content">
            <v-alert
              type="info"
              variant="tonal"
              density="compact"
              icon="mdi-shield-lock-outline"
              :text="t('markdownImagePicker.referencedImagesPrivacyHint')"
            />

            <div class="sapling-markdown-image-picker__toolbar">
              <SaplingTextField
                :model-value="search"
                :label="t('global.search')"
                prepend-inner-icon="mdi-magnify"
                clearable
                autofocus
                hide-details
                @update:model-value="search = String($event ?? '')"
              />
              <v-chip color="primary" variant="tonal" prepend-icon="mdi-check-circle-outline">
                {{ selectedHandles.length }} {{ t('global.selected') }}
              </v-chip>
            </div>

            <v-progress-linear v-if="isLoading" indeterminate color="primary" rounded />

            <v-alert
              v-else-if="hasLoadError"
              type="error"
              variant="tonal"
              :text="t('markdownImagePicker.referencedImagesLoadFailed')"
            >
              <template #append>
                <v-btn variant="text" prepend-icon="mdi-refresh" @click="loadImages">
                  {{ t('global.refresh') }}
                </v-btn>
              </template>
            </v-alert>

            <div
              v-else-if="filteredImages.length > 0"
              class="sapling-markdown-image-picker__grid"
              role="listbox"
              aria-multiselectable="true"
              :aria-label="t('markdownImagePicker.selectReferencedImages')"
            >
              <button
                v-for="image in filteredImages"
                :key="image.handle"
                type="button"
                class="sapling-markdown-image-picker__option"
                :class="{
                  'sapling-markdown-image-picker__option--selected': isSelected(image.handle),
                }"
                role="option"
                :aria-selected="isSelected(image.handle)"
                :aria-label="image.filename"
                @click="toggleSelection(image.handle)"
              >
                <div class="sapling-markdown-image-picker__preview">
                  <img
                    v-if="!failedPreviewHandles.has(image.handle)"
                    :src="getPreviewUrl(image.handle)"
                    :alt="image.description || image.filename"
                    loading="lazy"
                    @error="markPreviewFailed(image.handle)"
                  />
                  <v-icon v-else icon="mdi-image-broken-variant" size="42" />
                  <span class="sapling-markdown-image-picker__selection-indicator">
                    <v-icon
                      :icon="
                        isSelected(image.handle)
                          ? 'mdi-check-circle'
                          : 'mdi-checkbox-blank-circle-outline'
                      "
                      size="26"
                    />
                  </span>
                </div>
                <span class="sapling-markdown-image-picker__filename" :title="image.filename">
                  {{ image.filename }}
                </span>
                <span v-if="image.description" class="sapling-markdown-image-picker__description">
                  {{ image.description }}
                </span>
                <span v-if="image.createdAt" class="sapling-markdown-image-picker__date">
                  {{ formatCreatedAt(image.createdAt) }}
                </span>
              </button>
            </div>

            <div v-else class="sapling-empty-state-panel" role="status">
              <div class="sapling-empty-state-panel__icon">
                <v-icon
                  :icon="images.length > 0 ? 'mdi-image-search-outline' : 'mdi-image-off-outline'"
                  size="34"
                />
              </div>
              <h3 class="sapling-empty-state-panel__title">
                {{
                  images.length > 0
                    ? t('global.noData')
                    : t('markdownImagePicker.noReferencedImages')
                }}
              </h3>
              <p v-if="images.length === 0" class="sapling-empty-state-panel__text">
                {{ t('markdownImagePicker.noReferencedImagesDescription') }}
              </p>
            </div>
          </div>
        </template>

        <template #actions>
          <SaplingActionBarSkeleton v-if="isTranslationLoading" :leading="1" :trailing="1" />
          <SaplingActionBar v-else>
            <template #leading>
              <v-btn variant="text" prepend-icon="mdi-close" @click="close">
                {{ t('global.cancel') }}
              </v-btn>
            </template>
            <template #trailing>
              <v-btn
                color="primary"
                append-icon="mdi-image-plus-outline"
                :disabled="selectedHandles.length === 0"
                @click="insertSelected"
              >
                {{ t('markdownImagePicker.insertSelectedImages') }}
              </v-btn>
            </template>
          </SaplingActionBar>
        </template>
      </SaplingDialogShell>
    </SaplingDialogCard>
  </SaplingDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingActionBar from '@/components/actions/SaplingActionBar.vue'
import SaplingActionBarSkeleton from '@/components/actions/SaplingActionBarSkeleton.vue'
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import SaplingDialogHero from '@/components/common/SaplingDialogHero.vue'
import SaplingDialogShell from '@/components/common/SaplingDialogShell.vue'
import SaplingTextField from '@/components/common/SaplingTextField.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import ApiDocumentService from '@/services/api.document.service'
import type { ReferencedImageDocument } from '@/services/api.document.service'

const props = defineProps<{
  modelValue: boolean
  entityHandle: string
  itemHandle: string | number
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'insert', images: ReferencedImageDocument[]): void
}>()

const { d, t } = useI18n()
const { isLoading: isTranslationLoading } = useTranslationLoader('markdownImagePicker')
const images = ref<ReferencedImageDocument[]>([])
const selectedHandles = ref<number[]>([])
const failedPreviewHandles = ref(new Set<number>())
const search = ref('')
const isLoading = ref(false)
const hasLoadError = ref(false)
let loadRequestId = 0

const filteredImages = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  if (!query) {
    return images.value
  }

  return images.value.filter((image) =>
    [image.filename, image.description ?? ''].some((value) =>
      value.toLocaleLowerCase().includes(query),
    ),
  )
})

function updateVisibility(value: boolean) {
  emit('update:modelValue', value)
}

function close() {
  emit('update:modelValue', false)
}

function isSelected(handle: number): boolean {
  return selectedHandles.value.includes(handle)
}

function toggleSelection(handle: number) {
  selectedHandles.value = isSelected(handle)
    ? selectedHandles.value.filter((selectedHandle) => selectedHandle !== handle)
    : [...selectedHandles.value, handle]
}

function markPreviewFailed(handle: number) {
  failedPreviewHandles.value = new Set([...failedPreviewHandles.value, handle])
}

function getPreviewUrl(handle: number): string {
  return ApiDocumentService.getDownloadUrl(handle)
}

function formatCreatedAt(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : d(date)
}

function insertSelected() {
  const imageByHandle = new Map(images.value.map((image) => [image.handle, image]))
  const selected = selectedHandles.value.flatMap((handle) => {
    const image = imageByHandle.get(handle)
    return image ? [image] : []
  })
  if (selected.length === 0) {
    return
  }

  emit('insert', selected)
  close()
}

async function loadImages() {
  const requestId = ++loadRequestId
  isLoading.value = true
  hasLoadError.value = false

  try {
    const response = await ApiDocumentService.getReferencedImages(
      props.entityHandle,
      String(props.itemHandle),
    )
    if (requestId === loadRequestId) {
      images.value = response
    }
  } catch {
    if (requestId === loadRequestId) {
      images.value = []
      hasLoadError.value = true
    }
  } finally {
    if (requestId === loadRequestId) {
      isLoading.value = false
    }
  }
}

watch(
  () => props.modelValue,
  (isOpen) => {
    if (!isOpen) {
      return
    }

    search.value = ''
    selectedHandles.value = []
    failedPreviewHandles.value = new Set()
    void loadImages()
  },
  { immediate: true },
)
</script>
