<template>
  <v-card flat class="sapling-markdown-field">
    <div
      class="sapling-markdown-workspace"
      :class="{ 'sapling-markdown-workspace--single': !showPreview }"
    >
      <SaplingMarkdownEditorPane
        v-model:editor="editor"
        :draft-value="draftValue"
        :resolved-label="resolvedLabel"
        :rows="rows"
        :disabled="disabled"
        :required="required"
        :max-length="maxlength"
        :remaining-characters="remainingCharacters"
        :rules="rules"
        :toolbar-actions="toolbarActions"
        :is-enhanced-editor-ready="isEnhancedEditorReady"
        :editor-theme="editorTheme"
        :editor-height="editorHeight"
        :is-preparing-with-ai="isPreparingWithAi"
        :can-transcribe-with-ai="canTranscribeWithAi"
        :is-recording-voice-input="isRecordingVoiceInput"
        :is-transcribing-voice-input="isTranscribingVoiceInput"
        :can-prepare-with-ai="canPrepareWithAi"
        @focus="emit('focus')"
        @prepare-with-ai="prepareWithAi"
        @toggle-voice-input="toggleVoiceInput"
        @update:draft-value="updateDraftValue"
      />

      <SaplingMarkdownPreviewPane
        :show-preview="showPreview"
        :disabled="disabled"
        :preview-value="previewValue"
        :is-enhanced-editor-ready="isEnhancedEditorReady"
        :refresh-preview-label="refreshPreviewLabel"
        @refresh="refreshPreview"
      />
    </div>
  </v-card>
</template>

<script setup lang="ts">
import SaplingMarkdownEditorPane from '@/components/dialog/fields/markdown/SaplingMarkdownEditorPane.vue'
import SaplingMarkdownPreviewPane from '@/components/dialog/fields/markdown/SaplingMarkdownPreviewPane.vue'
import { useSaplingMarkdownField } from '@/composables/fields/useSaplingMarkdownField'
import type { MarkdownRule } from '@/components/dialog/fields/markdown/markdownField.types'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    label?: string
    rows?: number
    showPreview?: boolean
    disabled?: boolean
    required?: boolean
    maxlength?: number
    rules?: MarkdownRule[]
  }>(),
  {
    modelValue: '',
    label: '',
    rows: 6,
    showPreview: true,
    disabled: false,
    required: false,
    rules: () => [],
  },
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
  (event: 'focus'): void
}>()

function emitMarkdownEvent(event: 'update:modelValue' | 'focus', value?: string) {
  if (event === 'focus') {
    emit('focus')
    return
  }

  emit('update:modelValue', value ?? '')
}

const {
  draftValue,
  previewValue,
  editor,
  isEnhancedEditorReady,
  isPreparingWithAi,
  canPrepareWithAi,
  canTranscribeWithAi,
  isRecordingVoiceInput,
  isTranscribingVoiceInput,
  resolvedLabel,
  editorTheme,
  editorHeight,
  remainingCharacters,
  refreshPreviewLabel,
  refreshPreview,
  prepareWithAi,
  toggleVoiceInput,
  toolbarActions,
  updateDraftValue,
  insertTextAtCursor,
} = useSaplingMarkdownField({
  modelValue: () => props.modelValue,
  rows: () => props.rows,
  label: () => props.label,
  maxLength: () => props.maxlength,
  emit: emitMarkdownEvent,
})

defineExpose({
  insertTextAtCursor,
})
</script>
