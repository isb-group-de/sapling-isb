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
        :show-image-upload="showImageUpload"
        :can-upload-image="canUploadImage"
        :is-uploading-image="isUploadingImage"
        :image-upload-title="imageUploadTitle"
        :existing-image-title="existingImageTitle"
        @focus="emit('focus')"
        @prepare-with-ai="prepareWithAi"
        @toggle-voice-input="toggleVoiceInput"
        @upload-image="openImagePicker"
        @select-existing-image="openExistingImagePicker"
        @paste-images="uploadImages"
        @update:draft-value="updateDraftValue"
      />

      <input
        v-if="showImageUpload"
        ref="imageInput"
        data-test="markdown-image-input"
        type="file"
        accept="image/*"
        multiple
        hidden
        @change="handleImageSelection"
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

    <SaplingMarkdownImagePicker
      v-if="showImageUpload && itemHandle != null"
      v-model="isExistingImagePickerOpen"
      :entity-handle="entityHandle || ''"
      :item-handle="itemHandle"
      @insert="insertReferencedImages"
    />
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingMarkdownEditorPane from '@/components/dialog/fields/markdown/SaplingMarkdownEditorPane.vue'
import SaplingMarkdownImagePicker from '@/components/dialog/fields/markdown/SaplingMarkdownImagePicker.vue'
import SaplingMarkdownPreviewPane from '@/components/dialog/fields/markdown/SaplingMarkdownPreviewPane.vue'
import { useSaplingMarkdownField } from '@/composables/fields/useSaplingMarkdownField'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
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
    entityHandle?: string
    itemHandle?: string | number
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

const { t } = useI18n()
useTranslationLoader('markdownToolbar', 'markdownImagePicker')
const imageInput = ref<HTMLInputElement | null>(null)
const isExistingImagePickerOpen = ref(false)

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
  isUploadingImage,
  canPrepareWithAi,
  showImageUpload,
  canUploadImage,
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
  uploadImages,
  insertReferencedImages,
} = useSaplingMarkdownField({
  modelValue: () => props.modelValue,
  rows: () => props.rows,
  label: () => props.label,
  maxLength: () => props.maxlength,
  entityHandle: () => props.entityHandle,
  itemHandle: () => props.itemHandle,
  emit: emitMarkdownEvent,
})

const imageUploadTitle = computed(() =>
  props.itemHandle == null
    ? t('global.inlineImageAvailableAfterSave')
    : t('global.uploadInlineImage'),
)
const existingImageTitle = computed(() =>
  props.itemHandle == null
    ? t('global.inlineImageAvailableAfterSave')
    : t('markdownImagePicker.selectReferencedImages'),
)

function openImagePicker() {
  if (canUploadImage.value) {
    imageInput.value?.click()
  }
}

function openExistingImagePicker() {
  if (canUploadImage.value) {
    isExistingImagePickerOpen.value = true
  }
}

async function handleImageSelection(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  await uploadImages(files)
}

defineExpose({
  insertTextAtCursor,
})
</script>
