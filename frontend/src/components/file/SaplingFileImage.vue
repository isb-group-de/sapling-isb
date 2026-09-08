<template>
  <SaplingFileNoPreview v-if="failed" />
  <div
    v-else
    class="sapling-file-preview sapling-preview-viewer sapling-file-viewer sapling-preview-fullheight sapling-file-preview-fullheight"
  >
    <SaplingImageViewer
      v-if="source"
      :src="source"
      :alt="fileName || $t('document.preview')"
      expandable
      @expand="expanded = true"
      @error="failed = true"
    />
    <SaplingImagePreviewDialog
      v-if="expanded && source"
      :src="source"
      :alt="fileName || $t('document.preview')"
      @close="expanded = false"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue'
import SaplingFileNoPreview from './SaplingFileNoPreview.vue'
import SaplingImageViewer from '@/components/common/SaplingImageViewer.vue'
import SaplingImagePreviewDialog from '@/components/common/SaplingImagePreviewDialog.vue'

const props = defineProps<{
  imageUrl: string
  mimeType: string
  fileName?: string
}>()
const source = ref('')
const failed = ref(false)
const expanded = ref(false)

watch(
  [() => props.imageUrl, () => props.mimeType],
  async ([url, mimeType], _previous, onCleanup) => {
    const controller = new AbortController()
    let objectUrl = ''
    source.value = ''
    failed.value = false
    expanded.value = false
    onCleanup(() => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    })
    if (!url) return

    try {
      const response = await fetch(url, {
        credentials: 'include',
        signal: controller.signal,
      })
      if (!response.ok) throw new Error('Image download failed')
      const blob = await response.blob()
      if (controller.signal.aborted) return
      // Older uploads may have a generic MIME type. Always render SVG as an image,
      // never as inline markup or an embedded document.
      objectUrl = URL.createObjectURL(new Blob([blob], { type: mimeType }))
      source.value = objectUrl
    } catch {
      if (!controller.signal.aborted) failed.value = true
    }
  },
  { immediate: true },
)
</script>
