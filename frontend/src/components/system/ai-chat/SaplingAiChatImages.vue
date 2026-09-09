<template>
  <div class="sapling-chip-row sapling-ai-chat__image-chips">
    <v-chip
      v-for="item in images"
      :key="item.handle"
      size="small"
      variant="tonal"
      prepend-icon="mdi-image-outline"
      :closable="closable"
      :disabled="loadingHandle === item.handle"
      :title="item.filename"
      aria-haspopup="dialog"
      @click="openPreview(item)"
      @click:close.stop="emit('remove', item.handle)"
    >
      <span class="sapling-ai-chat__image-chip-label">{{ item.filename }}</span>
    </v-chip>
    <slot />
  </div>
  <SaplingImagePreviewDialog
    v-if="preview"
    :src="preview.url"
    :alt="preview.filename"
    :z-index="SAPLING_AI_CHAT_OVERLAY_Z_INDEX + 10"
    @close="clearPreview"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import ApiAiService from '@/services/api.ai.service'
import { pushApiErrorMessage } from '@/services/api.error.service'
import SaplingImagePreviewDialog from '@/components/common/SaplingImagePreviewDialog.vue'
import { SAPLING_AI_CHAT_OVERLAY_Z_INDEX } from './saplingAiChat.utils'

type ImageAttachment = { handle: number; filename: string }
const props = defineProps<{ images: ImageAttachment[]; closable?: boolean }>()
const emit = defineEmits<{ remove: [handle: number] }>()
const preview = ref<(ImageAttachment & { url: string }) | null>(null)
const loadingHandle = ref<number | null>(null)
let generation = 0

function clearPreview() {
  generation++
  loadingHandle.value = null
  if (preview.value) URL.revokeObjectURL(preview.value.url)
  preview.value = null
}

async function openPreview(item: ImageAttachment) {
  clearPreview()
  const current = generation
  loadingHandle.value = item.handle
  try {
    const blob = await ApiAiService.getChatImage(item.handle)
    if (generation === current) preview.value = { ...item, url: URL.createObjectURL(blob) }
  } catch (error) {
    if (generation === current) pushApiErrorMessage(error, 'document.noPreviewAvailable', 'aiChat')
  } finally {
    if (generation === current) loadingHandle.value = null
  }
}

watch(
  () => props.images.map((item) => item.handle).join(','),
  () => {
    const activeHandle = preview.value?.handle ?? loadingHandle.value
    if (activeHandle != null && !props.images.some((item) => item.handle === activeHandle))
      clearPreview()
  },
)
onBeforeUnmount(clearPreview)
</script>
