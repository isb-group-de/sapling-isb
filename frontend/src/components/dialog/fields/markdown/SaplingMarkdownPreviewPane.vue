<template>
  <section
    v-if="showPreview"
    class="sapling-section-panel sapling-markdown-pane sapling-markdown-pane--preview glass-panel"
  >
    <header class="sapling-section-header sapling-markdown-pane__header">
      <div class="sapling-markdown-pane__copy">
        <span class="sapling-eyebrow sapling-markdown-pane__eyebrow">{{ liveLabel }}</span>
        <h3 class="sapling-section-title sapling-markdown-pane__title">{{ previewTitle }}</h3>
      </div>
      <div class="sapling-markdown-pane__actions">
        <v-btn
          color="primary"
          variant="tonal"
          size="small"
          prepend-icon="mdi-refresh"
          :disabled="disabled"
          @click="emit('refresh')"
        >
          {{ refreshPreviewLabel }}
        </v-btn>
        <v-btn
          data-test="markdown-copy-preview"
          class="sapling-markdown-pane__copy-action"
          color="primary"
          variant="tonal"
          size="small"
          icon="mdi-content-copy"
          :title="copyLabel"
          :aria-label="copyLabel"
          :disabled="!canCopyPreview"
          @click="copyPreview"
        />
      </div>
    </header>

    <div ref="previewElement" class="sapling-markdown-preview">
      <SaplingMarkdownContent v-if="isEnhancedEditorReady" :source="previewValue" />
      <pre v-else class="sapling-markdown-preview__plain">{{ previewValue }}</pre>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingMarkdownContent from '@/components/common/SaplingMarkdownContent.vue'

const props = defineProps<{
  showPreview: boolean
  disabled: boolean
  previewValue: string
  isEnhancedEditorReady: boolean
  refreshPreviewLabel: string
}>()

const emit = defineEmits<{
  refresh: []
}>()

const { t } = useI18n()
const previewElement = ref<HTMLElement | null>(null)
const liveLabel = computed(() => t('global.live'))
const previewTitle = computed(() => t('document.preview'))
const copyLabel = computed(() => t('global.copy'))
const canCopyPreview = computed(
  () => props.isEnhancedEditorReady && Boolean(props.previewValue.trim()) && !!navigator.clipboard,
)

async function copyPreview() {
  const renderedText = previewElement.value?.innerText || previewElement.value?.textContent || ''
  if (!renderedText.trim() || !navigator.clipboard) return

  try {
    await navigator.clipboard.writeText(renderedText.trim())
  } catch {
    // Clipboard permissions remain controlled by the browser.
  }
}
</script>
