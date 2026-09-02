<template>
  <section
    class="sapling-section-panel sapling-markdown-pane sapling-markdown-pane--editor glass-panel"
    :class="{ 'sapling-markdown-pane--disabled': disabled }"
  >
    <header class="sapling-section-header sapling-markdown-pane__header">
      <div class="sapling-markdown-pane__copy">
        <span class="sapling-eyebrow sapling-markdown-pane__eyebrow">{{ markdownLabel }}</span>
        <h3 class="sapling-section-title sapling-markdown-pane__title">{{ resolvedLabel }}</h3>
      </div>
      <div class="sapling-markdown-pane__actions">
        <v-btn
          v-if="canTranscribeWithAi"
          data-test="markdown-voice-input"
          variant="tonal"
          :color="isRecordingVoiceInput ? 'error' : 'primary'"
          size="small"
          :prepend-icon="isRecordingVoiceInput ? 'mdi-stop' : 'mdi-microphone-outline'"
          :loading="isTranscribingVoiceInput"
          :disabled="disabled || isPreparingWithAi || isTranscribingVoiceInput"
          @click="emit('toggleVoiceInput')"
        >
          {{ voiceInputLabel }}
        </v-btn>
        <v-btn
          data-test="markdown-prepare-with-ai"
          variant="tonal"
          color="primary"
          size="small"
          prepend-icon="mdi-auto-fix"
          :loading="isPreparingWithAi"
          :disabled="
            disabled || !canPrepareWithAi || isRecordingVoiceInput || isTranscribingVoiceInput
          "
          @click="emit('prepareWithAi')"
        >
          {{ t('global.aiPrepareMarkdown') }}
        </v-btn>
      </div>
    </header>

    <div class="sapling-markdown-input" :class="{ 'sapling-markdown-input--disabled': disabled }">
      <SaplingTextarea
        :model-value="draftValue"
        :rules="rules"
        :disabled="disabled"
        :required="required"
        readonly
        hide-details="auto"
        tabindex="-1"
        class="sapling-markdown-validation-proxy"
      />

      <div
        class="sapling-markdown-editor-shell"
        :class="{ 'sapling-markdown-editor-shell--disabled': disabled }"
        @paste.capture="handlePaste"
      >
        <div
          class="sapling-toolbar-group sapling-markdown-toolbar"
          role="toolbar"
          :aria-label="t('markdownToolbar.ariaLabel')"
        >
          <div
            v-for="group in toolbarGroups"
            :key="group.key"
            class="sapling-markdown-toolbar__group"
            role="group"
            :aria-label="group.label"
          >
            <span class="sapling-markdown-toolbar__group-label">{{ group.label }}</span>
            <div class="sapling-markdown-toolbar__group-actions">
              <v-btn
                v-for="action in group.actions"
                :key="action.key"
                :data-test="action.testId"
                :icon="action.icon"
                :title="action.title"
                :aria-label="action.title"
                size="small"
                density="compact"
                variant="text"
                :loading="action.loading"
                :disabled="toolbarDisabled || action.disabled"
                @mousedown.prevent
                @click.stop="action.run"
              />
            </div>
          </div>
          <span
            v-if="characterCountLabel"
            class="sapling-markdown-character-count"
            aria-live="polite"
          >
            {{ characterCountLabel }}
          </span>
        </div>

        <SaplingCodeMirror
          v-if="isEnhancedEditorReady"
          ref="editor"
          data-dialog-validation-focus
          :model-value="draftValue"
          language="markdown"
          :theme="editorTheme"
          :read-only="disabled || isPreparingWithAi || isTranscribingVoiceInput"
          :line-numbers="false"
          class="sapling-markdown-editor"
          v-css-vars="{ '--sapling-markdown-editor-height': editorHeight }"
          @focus="emit('focus')"
          @update:model-value="emit('update:draftValue', $event)"
        />
        <SaplingTextarea
          v-else
          data-dialog-validation-focus
          :model-value="draftValue"
          :disabled="disabled || isPreparingWithAi || isTranscribingVoiceInput"
          :maxlength="maxLength"
          :rows="Math.max(rows, 6)"
          hide-details
          no-resize
          class="sapling-markdown-editor sapling-markdown-editor--fallback"
          v-css-vars="{ '--sapling-markdown-editor-height': editorHeight }"
          @focus="emit('focus')"
          @update:model-value="emit('update:draftValue', String($event ?? ''))"
        />
      </div>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingCodeMirror from '@/components/common/SaplingCodeMirror.vue'
import SaplingTextarea from '@/components/common/SaplingTextarea.vue'
import { extractClipboardImageFiles } from '@/components/dialog/fields/markdown/markdownClipboard'
import type {
  MarkdownEditorHandle,
  MarkdownRule,
  MarkdownToolbarAction,
  MarkdownToolbarGroupKey,
} from '@/components/dialog/fields/markdown/markdownField.types'

const props = defineProps<{
  draftValue: string
  resolvedLabel: string
  rows: number
  disabled: boolean
  required: boolean
  maxLength?: number
  remainingCharacters?: number | null
  rules: MarkdownRule[]
  toolbarActions: MarkdownToolbarAction[]
  isEnhancedEditorReady: boolean
  editorTheme: 'dark' | 'light'
  editorHeight: string
  isPreparingWithAi: boolean
  canPrepareWithAi: boolean
  canTranscribeWithAi: boolean
  isRecordingVoiceInput: boolean
  isTranscribingVoiceInput: boolean
  showImageUpload: boolean
  canUploadImage: boolean
  isUploadingImage: boolean
  imageUploadTitle: string
  existingImageTitle: string
}>()

const emit = defineEmits<{
  focus: []
  'update:draftValue': [value: string]
  prepareWithAi: []
  toggleVoiceInput: []
  uploadImage: []
  selectExistingImage: []
  pasteImages: [files: File[]]
}>()

const { locale, t } = useI18n()
const editor = defineModel<MarkdownEditorHandle | null>('editor', { default: null })
const markdownLabel = computed(() => t('global.markdown'))
const toolbarGroupOrder: MarkdownToolbarGroupKey[] = ['structure', 'text', 'lists', 'media', 'code']
interface MarkdownPaletteAction extends MarkdownToolbarAction {
  testId?: string
  loading?: boolean
  disabled?: boolean
}

const toolbarDisabled = computed(
  () => props.disabled || props.isPreparingWithAi || props.isTranscribingVoiceInput,
)
const toolbarGroups = computed(() =>
  toolbarGroupOrder
    .map((key) => {
      const actions: MarkdownPaletteAction[] = props.toolbarActions.filter(
        (action) => action.group === key,
      )

      if (key === 'media' && props.showImageUpload) {
        actions.push(
          {
            key: 'upload-image',
            group: 'media',
            icon: 'mdi-image-plus-outline',
            title: props.imageUploadTitle,
            testId: 'markdown-upload-image',
            loading: props.isUploadingImage,
            disabled: !props.canUploadImage,
            run: () => emit('uploadImage'),
          },
          {
            key: 'select-existing-image',
            group: 'media',
            icon: 'mdi-image-multiple-outline',
            title: props.existingImageTitle,
            testId: 'markdown-select-existing-image',
            disabled: !props.canUploadImage,
            run: () => emit('selectExistingImage'),
          },
        )
      }

      return {
        key,
        label: t(`markdownToolbar.${key}`),
        actions,
      }
    })
    .filter((group) => group.actions.length > 0),
)
const characterCountLabel = computed(() => {
  if (!props.maxLength || props.remainingCharacters == null) {
    return ''
  }

  const numberFormatter = new Intl.NumberFormat(locale.value)
  return t('global.charactersRemaining', {
    remaining: numberFormatter.format(props.remainingCharacters),
    maxLength: numberFormatter.format(props.maxLength),
  })
})
const voiceInputLabel = computed(() => {
  if (props.isTranscribingVoiceInput) {
    return t('aiChat.transcribingAudio')
  }

  if (props.isRecordingVoiceInput) {
    return t('aiChat.stopVoiceInput')
  }

  return t('global.aiTranscribeAndPrepareMarkdown')
})

function handlePaste(event: ClipboardEvent) {
  if (toolbarDisabled.value || !props.canUploadImage) {
    return
  }

  const images = extractClipboardImageFiles(event.clipboardData)
  if (images.length === 0) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  emit('pasteImages', images)
}
</script>
