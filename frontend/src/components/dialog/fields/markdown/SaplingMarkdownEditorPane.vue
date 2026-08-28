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
      >
        <div class="sapling-toolbar-group sapling-markdown-toolbar">
          <v-btn
            v-for="action in toolbarActions"
            :key="action.key"
            :icon="action.icon"
            :title="action.title"
            size="small"
            density="compact"
            variant="text"
            :disabled="disabled || isPreparingWithAi || isTranscribingVoiceInput"
            @mousedown.prevent
            @click.stop="action.run"
          />
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
          :style="{ height: editorHeight }"
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
          :style="{ height: editorHeight }"
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
import type {
  MarkdownEditorHandle,
  MarkdownRule,
  MarkdownToolbarAction,
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
}>()

const emit = defineEmits<{
  focus: []
  'update:draftValue': [value: string]
  prepareWithAi: []
  toggleVoiceInput: []
}>()

const { locale, t } = useI18n()
const editor = defineModel<MarkdownEditorHandle | null>('editor', { default: null })
const markdownLabel = computed(() => t('global.markdown'))
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
</script>
