<template>
  <div
    v-bind="$attrs"
    class="sapling-markdown-content"
    @click="openImage"
    @keydown="onImageKeydown"
  >
    <VueMarkdownRender
      :source="normalizedSource"
      :options="SAPLING_MARKDOWN_OPTIONS"
      :plugins="SAPLING_MARKDOWN_PLUGINS"
    />
  </div>
  <SaplingImagePreviewDialog
    v-if="selectedImage"
    :src="selectedImage.src"
    :alt="selectedImage.alt"
    @close="closeImage"
  />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, watch } from 'vue'
import VueMarkdownRender from 'vue-markdown-render'
import {
  normalizeMarkdownContent,
  SAPLING_MARKDOWN_OPTIONS,
  SAPLING_MARKDOWN_PLUGINS,
} from '@/utils/markdown'

const SaplingImagePreviewDialog = defineAsyncComponent(
  () => import('./SaplingImagePreviewDialog.vue'),
)
const selectedImage = ref<{ src: string; alt: string } | null>(null)
let selectedImageElement: HTMLImageElement | null = null
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    source?: string | null
  }>(),
  {
    source: '',
  },
)

const normalizedSource = computed(() => normalizeMarkdownContent(props.source))
watch(normalizedSource, () => {
  selectedImage.value = null
  selectedImageElement = null
})

function openImage(event: MouseEvent | KeyboardEvent) {
  const image = event.target
  if (!(image instanceof HTMLImageElement) || !image.getAttribute('src')) return
  event.preventDefault()
  event.stopPropagation()
  selectedImageElement = image
  selectedImage.value = { src: image.currentSrc || image.src, alt: image.alt }
}

async function closeImage() {
  selectedImage.value = null
  await nextTick()
  selectedImageElement?.focus({ preventScroll: true })
  selectedImageElement = null
}

function onImageKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') openImage(event)
}
</script>
