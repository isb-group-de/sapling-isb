<template>
  <div class="sapling-image-viewer">
    <div class="sapling-image-viewer__toolbar">
      <v-slider
        v-model="zoom"
        :min="50"
        :max="200"
        :step="10"
        :label="$t('document.imageZoom')"
        :aria-label="$t('document.imageZoom')"
        :disabled="!loaded || failed"
        hide-details
      />
      <v-btn variant="text" :disabled="!loaded || failed" @click="reset"> {{ zoom }} % </v-btn>
      <v-btn
        v-if="expandable"
        icon="mdi-arrow-expand-all"
        variant="text"
        :aria-label="$t('document.enlargeImage')"
        :title="$t('document.enlargeImage')"
        :disabled="!loaded || failed"
        @click="emit('expand')"
      />
    </div>
    <SaplingFileNoPreview v-if="failed" />
    <div
      v-else
      ref="viewport"
      class="sapling-image-viewer__viewport"
      :class="{ 'sapling-image-viewer__viewport--dragging': dragging }"
      tabindex="0"
      role="region"
      :aria-label="$t('document.imagePanHint')"
      @pointerdown="pointerDown"
      @pointermove="pointerMove"
      @pointerup="pointerEnd"
      @pointercancel="pointerEnd"
      @lostpointercapture="pointerEnd"
      @dblclick="expandable && loaded && emit('expand')"
    >
      <img
        :key="src"
        :src="src"
        :alt="alt"
        :width="loaded ? (width * zoom) / 100 : undefined"
        :height="loaded ? (height * zoom) / 100 : undefined"
        draggable="false"
        @load="imageLoaded"
        @error="imageFailed"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import SaplingFileNoPreview from '@/components/file/SaplingFileNoPreview.vue'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'

const props = defineProps<{ src: string; alt: string; expandable?: boolean }>()
const emit = defineEmits<{ expand: []; error: [] }>()
useTranslationLoader('document', 'global')
const viewport = ref<HTMLDivElement>()
const zoom = ref(100)
const width = ref(0)
const height = ref(0)
const loaded = ref(false)
const failed = ref(false)
const dragging = ref(false)
let drag: { pointerId: number; x: number; y: number; left: number; top: number } | null = null

function reset() {
  pointerEnd()
  zoom.value = 100
  if (viewport.value) {
    viewport.value.scrollLeft = 0
    viewport.value.scrollTop = 0
  }
}

watch(
  () => props.src,
  () => {
    reset()
    loaded.value = false
    failed.value = false
  },
)

function imageLoaded(event: Event) {
  const image = event.target as HTMLImageElement
  width.value = image.naturalWidth
  height.value = image.naturalHeight
  loaded.value = true
}

function imageFailed() {
  failed.value = true
  emit('error')
}

function pointerDown(event: PointerEvent) {
  const element = viewport.value
  if (!element || !loaded.value || drag || event.button !== 0) return
  drag = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    left: element.scrollLeft,
    top: element.scrollTop,
  }
  element.setPointerCapture(event.pointerId)
  dragging.value = true
  element.focus({ preventScroll: true })
  event.preventDefault()
}

function pointerMove(event: PointerEvent) {
  if (!drag || drag.pointerId !== event.pointerId || !viewport.value) return
  viewport.value.scrollLeft = drag.left - (event.clientX - drag.x)
  viewport.value.scrollTop = drag.top - (event.clientY - drag.y)
}

function pointerEnd(event?: PointerEvent) {
  if (event && drag && event.pointerId !== drag.pointerId) return
  const pointerId = drag?.pointerId
  drag = null
  dragging.value = false
  if (pointerId !== undefined && viewport.value?.hasPointerCapture(pointerId)) {
    viewport.value.releasePointerCapture(pointerId)
  }
}
</script>

<style src="@/assets/styles/framework/SaplingImageViewer.css"></style>
