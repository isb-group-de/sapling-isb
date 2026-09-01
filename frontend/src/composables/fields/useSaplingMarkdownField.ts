import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CookieService from '@/services/cookie.service'
import ApiAiService from '@/services/api.ai.service'
import ApiDocumentService from '@/services/api.document.service'
import type { ReferencedImageDocument } from '@/services/api.document.service'
import type { AiProviderModelItem, AiProviderTypeItem } from '@/entity/entity'
import { resolveRuntimeTarget } from '@/components/system/ai-chat/aiChatRuntimeTargets'
import {
  loadSaplingAiPreferences,
  SAPLING_AI_PREFERENCES_UPDATED_EVENT,
} from '@/services/ai-preferences.service'
import { useSaplingMarkdownVoiceInput } from '@/composables/fields/useSaplingMarkdownVoiceInput'
import type {
  MarkdownEditorHandle,
  MarkdownToolbarAction,
  MarkdownTransformResult,
} from '@/components/dialog/fields/markdown/markdownField.types'

const MARKDOWN_SYNC_DEBOUNCE_MS = 120

let activeMarkdownPreparationCatalogRequest: Promise<{
  providerConfigs: AiProviderTypeItem[]
  modelConfigs: AiProviderModelItem[]
}> | null = null

export function useSaplingMarkdownField(options: {
  modelValue: () => string | undefined
  rows: () => number
  label: () => string | undefined
  maxLength?: () => number | undefined
  entityHandle?: () => string | undefined
  itemHandle?: () => string | number | undefined
  emit: (event: 'update:modelValue' | 'focus', value?: string) => void
}) {
  const { locale, t } = useI18n()

  const initialMaxLength = normalizeMarkdownMaxLength(options.maxLength?.())
  const initialValue = truncateMarkdownValue(options.modelValue() ?? '', initialMaxLength)
  const draftValue = ref(initialValue)
  const previewValue = ref(initialValue)
  const editor = ref<MarkdownEditorHandle | null>(null)
  const isEnhancedEditorReady = ref(false)
  const isPreparingWithAi = ref(false)
  const isUploadingImage = ref(false)
  const selectedMarkdownProviderHandle = ref<string | null>(null)
  const selectedMarkdownModelHandle = ref<string | null>(null)
  const hasConfiguredAiTarget = computed(() => Boolean(selectedMarkdownModelHandle.value))
  const canPrepareWithAi = computed(
    () => hasConfiguredAiTarget.value && Boolean(draftValue.value.trim()),
  )
  const showImageUpload = computed(() => Boolean(options.entityHandle?.()))
  const canUploadImage = computed(
    () => showImageUpload.value && options.itemHandle?.() != null && !isUploadingImage.value,
  )
  const resolvedLabel = computed(() => options.label() || t('global.markdown'))
  const editorTheme = computed(() => (CookieService.get('theme') === 'dark' ? 'dark' : 'light'))
  const editorHeight = computed(() => `${Math.max(options.rows(), 6) * 24 + 56}px`)
  const maxLength = computed(() => normalizeMarkdownMaxLength(options.maxLength?.()))
  const remainingCharacters = computed(() => {
    if (maxLength.value == null) {
      return null
    }

    return Math.max(0, maxLength.value - draftValue.value.length)
  })
  const refreshPreviewLabel = computed(() => (locale.value === 'de' ? 'Aktualisieren' : 'Refresh'))

  let isApplyingExternalValue = false
  let syncTimeout: ReturnType<typeof setTimeout> | null = null
  let enhanceTimeout: ReturnType<typeof setTimeout> | null = null

  function flushSync(value = draftValue.value) {
    options.emit('update:modelValue', value)
  }

  function scheduleSync(value = draftValue.value) {
    if (syncTimeout) {
      clearTimeout(syncTimeout)
    }

    syncTimeout = setTimeout(() => {
      syncTimeout = null
      flushSync(value)
    }, MARKDOWN_SYNC_DEBOUNCE_MS)
  }

  function refreshPreview() {
    previewValue.value = draftValue.value
  }

  function updateDraftValue(value: string) {
    const nextValue = truncateMarkdownValue(value, maxLength.value)
    draftValue.value = nextValue
    return nextValue
  }

  async function prepareWithAi(content = draftValue.value) {
    const sourceContent = truncateMarkdownValue(content, maxLength.value)
    if (!hasConfiguredAiTarget.value || !sourceContent.trim() || isPreparingWithAi.value) {
      return false
    }

    isPreparingWithAi.value = true

    try {
      const result = await ApiAiService.prepareMarkdown({
        content: sourceContent,
        providerHandle: selectedMarkdownProviderHandle.value ?? undefined,
        modelHandle: selectedMarkdownModelHandle.value ?? undefined,
      })

      const preparedContent = updateDraftValue(result.content)
      previewValue.value = preparedContent
      editor.value?.focus()
      return true
    } catch {
      // ApiAiService already forwards a localized error to the message center.
      return false
    } finally {
      isPreparingWithAi.value = false
    }
  }

  const markdownVoiceInput = useSaplingMarkdownVoiceInput({
    draftValue,
    previewValue,
    editor,
    isPreparingWithAi,
    prepareWithAi,
    updateDraftValue,
  })

  watch(draftValue, (value) => {
    if (isApplyingExternalValue) {
      return
    }

    scheduleSync(value)
  })

  watch(options.modelValue, (value) => {
    const nextValue = truncateMarkdownValue(value ?? '', maxLength.value)

    if (nextValue === draftValue.value) {
      return
    }

    isApplyingExternalValue = true
    draftValue.value = nextValue
    previewValue.value = nextValue
    isApplyingExternalValue = false
  })

  watch(maxLength, () => {
    const nextDraftValue = truncateMarkdownValue(draftValue.value, maxLength.value)
    const nextPreviewValue = truncateMarkdownValue(previewValue.value, maxLength.value)

    if (nextDraftValue !== draftValue.value) {
      updateDraftValue(nextDraftValue)
    }
    if (nextPreviewValue !== previewValue.value) {
      previewValue.value = nextPreviewValue
    }
  })

  async function loadMarkdownPreparationTarget() {
    try {
      const { providerConfigs, modelConfigs } = await loadMarkdownPreparationCatalog()
      const preferences = loadSaplingAiPreferences()
      const target = resolveRuntimeTarget({
        providerConfigs,
        modelConfigs,
        requestedProviderHandle: preferences.chatProviderHandle,
        requestedModelHandle: preferences.chatModelHandle,
        preferredModelHandle: preferences.chatModelHandle,
      })

      selectedMarkdownProviderHandle.value = target.providerHandle
      selectedMarkdownModelHandle.value = target.modelHandle
    } catch {
      selectedMarkdownProviderHandle.value = null
      selectedMarkdownModelHandle.value = null
    }
  }

  function handlePreferencesUpdated() {
    void loadMarkdownPreparationTarget()
  }

  onMounted(() => {
    void loadMarkdownPreparationTarget()
    window.addEventListener(SAPLING_AI_PREFERENCES_UPDATED_EVENT, handlePreferencesUpdated)

    enhanceTimeout = setTimeout(() => {
      enhanceTimeout = null
      isEnhancedEditorReady.value = true
    }, 20)
  })

  onBeforeUnmount(() => {
    window.removeEventListener(SAPLING_AI_PREFERENCES_UPDATED_EVENT, handlePreferencesUpdated)

    if (syncTimeout) {
      clearTimeout(syncTimeout)
      syncTimeout = null
      flushSync()
    }

    if (enhanceTimeout) {
      clearTimeout(enhanceTimeout)
      enhanceTimeout = null
    }
  })

  function insertTextAtCursor(text: string) {
    applySelection(() => ({
      text,
      selectionStart: text.length,
      selectionEnd: text.length,
    }))
  }

  async function uploadImages(files: File[]): Promise<number> {
    const entityHandle = options.entityHandle?.()
    const itemHandle = options.itemHandle?.()
    const images = files.filter((file) => file.type.startsWith('image/'))

    if (!entityHandle || itemHandle == null || images.length === 0 || isUploadingImage.value) {
      return 0
    }

    isUploadingImage.value = true
    const embeds: string[] = []

    try {
      for (const file of images) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('typeHandle', 'document')
        formData.append('description', file.name)

        const document = await ApiDocumentService.upload(entityHandle, String(itemHandle), formData)
        embeds.push(buildSaplingImageEmbed(document.handle, file.name, t('global.image')))
      }
    } catch {
      // ApiDocumentService already forwards a localized error to the message center.
    } finally {
      if (embeds.length > 0) {
        insertTextAtCursor(embeds.join('\n\n'))
        refreshPreview()
      }
      isUploadingImage.value = false
    }

    return embeds.length
  }

  function insertReferencedImages(images: ReferencedImageDocument[]): number {
    if (images.length === 0) {
      return 0
    }

    const embeds = images.map((image) =>
      buildSaplingImageEmbed(image.handle, image.filename, t('global.image')),
    )
    insertTextAtCursor(embeds.join('\n\n'))
    refreshPreview()
    return embeds.length
  }

  function wrapSelection(prefix: string, suffix = prefix, placeholder?: string) {
    applySelection((selectedText) => {
      const content = selectedText || placeholder || t('global.text')

      return {
        text: `${prefix}${content}${suffix}`,
        selectionStart: prefix.length,
        selectionEnd: prefix.length + content.length,
      }
    })
  }

  function applyOrderedList() {
    applySelection((selectedText) => {
      const content = selectedText || t('global.listItem')
      const lines = content.split('\n')
      const shouldUnwrap = lines.every((line, index) => line.startsWith(`${index + 1}. `))
      const transformed = lines
        .map((line, index) => {
          const prefix = `${index + 1}. `

          if (!line.trim()) {
            return shouldUnwrap ? line : prefix
          }

          return shouldUnwrap && line.startsWith(prefix)
            ? line.slice(prefix.length)
            : `${prefix}${line}`
        })
        .join('\n')

      return {
        text: transformed,
        selectionStart: 0,
        selectionEnd: transformed.length,
      }
    })
  }

  function applyChecklist() {
    applySelection((selectedText) => {
      const content = selectedText || t('global.task')
      const lines = content.split('\n')
      const uncheckedPrefix = '- [ ] '
      const checkedPrefix = '- [x] '
      const shouldUnwrap = lines.every(
        (line) => line.startsWith(uncheckedPrefix) || line.startsWith(checkedPrefix),
      )
      const transformed = lines
        .map((line) => {
          if (!line.trim()) {
            return shouldUnwrap ? line : uncheckedPrefix
          }

          if (shouldUnwrap) {
            if (line.startsWith(uncheckedPrefix)) {
              return line.slice(uncheckedPrefix.length)
            }

            if (line.startsWith(checkedPrefix)) {
              return line.slice(checkedPrefix.length)
            }
          }

          return `${uncheckedPrefix}${line}`
        })
        .join('\n')

      return {
        text: transformed,
        selectionStart: 0,
        selectionEnd: transformed.length,
      }
    })
  }

  function applyHeading(level = 2) {
    const headingPrefix = `${'#'.repeat(level)} `

    applySelection((selectedText) => {
      const content = selectedText || t('global.heading')
      const transformed = content
        .split('\n')
        .map((line) => `${headingPrefix}${line.replace(/^\s{0,3}#{1,6}\s+/, '')}`)
        .join('\n')

      return {
        text: transformed,
        selectionStart: headingPrefix.length,
        selectionEnd: transformed.length,
      }
    })
  }

  function toggleLinePrefix(prefix: string, placeholder: string) {
    applySelection((selectedText) => {
      const content = selectedText || placeholder
      const lines = content.split('\n')
      const shouldUnwrap = lines.every((line) => line.startsWith(prefix))
      const transformed = lines
        .map((line) => {
          if (!line.trim()) {
            return shouldUnwrap ? line : prefix
          }

          return shouldUnwrap && line.startsWith(prefix)
            ? line.slice(prefix.length)
            : `${prefix}${line}`
        })
        .join('\n')

      return {
        text: transformed,
        selectionStart: 0,
        selectionEnd: transformed.length,
      }
    })
  }

  function applyInlineCode() {
    applySelection((selectedText) => {
      const content = selectedText || t('global.code')

      if (content.includes('\n')) {
        const fenced = `\`\`\`\n${content}\n\`\`\``

        return {
          text: fenced,
          selectionStart: 4,
          selectionEnd: 4 + content.length,
        }
      }

      return {
        text: `\`${content}\``,
        selectionStart: 1,
        selectionEnd: 1 + content.length,
      }
    })
  }

  function applyCodeBlock() {
    applySelection((selectedText) => {
      const content = selectedText || t('global.code')
      const fenced = `\`\`\`\n${content}\n\`\`\``

      return {
        text: fenced,
        selectionStart: 4,
        selectionEnd: 4 + content.length,
      }
    })
  }

  function applyLink() {
    applySelection((selectedText) => {
      const content = selectedText || t('global.linkText')
      const markdown = `[${content}](https://example.com)`

      return {
        text: markdown,
        selectionStart: 1,
        selectionEnd: 1 + content.length,
      }
    })
  }

  function applyImage() {
    applySelection((selectedText) => {
      const content = selectedText || t('global.altText')
      const markdown = `![${content}](https://example.com/image.png)`

      return {
        text: markdown,
        selectionStart: 2,
        selectionEnd: 2 + content.length,
      }
    })
  }

  function applyTable() {
    applySelection(() => {
      const table = `| ${t('global.column')} 1 | ${t('global.column')} 2 |\n| --- | --- |\n| ${t('global.value')} 1 | ${t('global.value')} 2 |`

      return {
        text: table,
        selectionStart: 2,
        selectionEnd: 10,
      }
    })
  }

  function applyHorizontalRule() {
    applySelection(() => ({
      text: '---',
      selectionStart: 3,
      selectionEnd: 3,
    }))
  }

  function applySelection(transform: (selectedText: string) => MarkdownTransformResult) {
    const instance = editor.value

    if (!instance) {
      const result = transform('')
      const separator = draftValue.value && !draftValue.value.endsWith('\n') ? '\n' : ''
      updateDraftValue(`${draftValue.value}${separator}${result.text}`)
      return
    }

    const nextValue = instance.applySelection(transform)
    if (nextValue !== draftValue.value) {
      updateDraftValue(nextValue ?? draftValue.value)
    }

    instance.focus()
  }

  const toolbarActions = computed<MarkdownToolbarAction[]>(() => [
    {
      key: 'heading1',
      group: 'structure',
      icon: 'mdi-format-header-1',
      title: t('global.heading1'),
      run: () => applyHeading(1),
    },
    {
      key: 'heading',
      group: 'structure',
      icon: 'mdi-format-header-2',
      title: t('global.heading2'),
      run: () => applyHeading(2),
    },
    {
      key: 'heading3',
      group: 'structure',
      icon: 'mdi-format-header-3',
      title: t('global.heading3'),
      run: () => applyHeading(3),
    },
    {
      key: 'bold',
      group: 'text',
      icon: 'mdi-format-bold',
      title: t('global.bold'),
      run: () => wrapSelection('**'),
    },
    {
      key: 'italic',
      group: 'text',
      icon: 'mdi-format-italic',
      title: t('global.italic'),
      run: () => wrapSelection('_'),
    },
    {
      key: 'strike',
      group: 'text',
      icon: 'mdi-format-strikethrough',
      title: t('global.strikethrough'),
      run: () => wrapSelection('~~'),
    },
    {
      key: 'link',
      group: 'text',
      icon: 'mdi-link-variant',
      title: t('global.link'),
      run: applyLink,
    },
    {
      key: 'image',
      group: 'media',
      icon: 'mdi-image-outline',
      title: t('global.image'),
      run: applyImage,
    },
    {
      key: 'list',
      group: 'lists',
      icon: 'mdi-format-list-bulleted',
      title: t('global.bulletList'),
      run: () => toggleLinePrefix('- ', t('global.listItem')),
    },
    {
      key: 'ordered-list',
      group: 'lists',
      icon: 'mdi-format-list-numbered',
      title: t('global.numberedList'),
      run: applyOrderedList,
    },
    {
      key: 'checklist',
      group: 'lists',
      icon: 'mdi-format-list-checks',
      title: t('global.checklist'),
      run: applyChecklist,
    },
    {
      key: 'quote',
      group: 'structure',
      icon: 'mdi-format-quote-close',
      title: t('global.quote'),
      run: () => toggleLinePrefix('> ', t('global.quote')),
    },
    {
      key: 'inline-code',
      group: 'code',
      icon: 'mdi-code-tags',
      title: t('global.inlineCode'),
      run: applyInlineCode,
    },
    {
      key: 'code-block',
      group: 'code',
      icon: 'mdi-code-braces-box',
      title: t('global.codeBlock'),
      run: applyCodeBlock,
    },
    {
      key: 'table',
      group: 'media',
      icon: 'mdi-table-large',
      title: t('global.table'),
      run: applyTable,
    },
    {
      key: 'divider',
      group: 'structure',
      icon: 'mdi-minus',
      title: t('global.horizontalRule'),
      run: applyHorizontalRule,
    },
  ])

  return {
    draftValue,
    previewValue,
    editor,
    isEnhancedEditorReady,
    isPreparingWithAi,
    isUploadingImage,
    canPrepareWithAi,
    showImageUpload,
    canUploadImage,
    canTranscribeWithAi: markdownVoiceInput.canTranscribeWithAi,
    isRecordingVoiceInput: markdownVoiceInput.isRecordingVoiceInput,
    isTranscribingVoiceInput: markdownVoiceInput.isTranscribingVoiceInput,
    resolvedLabel,
    editorTheme,
    editorHeight,
    remainingCharacters,
    refreshPreviewLabel,
    refreshPreview,
    prepareWithAi,
    toggleVoiceInput: markdownVoiceInput.toggleVoiceInput,
    toolbarActions,
    updateDraftValue,
    insertTextAtCursor,
    uploadImages,
    insertReferencedImages,
  }
}

export function buildSaplingImageEmbed(
  handle: number,
  filename: string,
  fallbackLabel: string,
): string {
  const label = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[}\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return `{{sapling-image:${handle}|${label || fallbackLabel}}}`
}

export function normalizeMarkdownMaxLength(value: number | undefined): number | undefined {
  if (!Number.isFinite(value) || !Number.isInteger(value) || (value ?? 0) <= 0) {
    return undefined
  }

  return value
}

export function truncateMarkdownValue(value: string, maxLength?: number): string {
  if (maxLength == null || value.length <= maxLength) {
    return value
  }

  return value.slice(0, maxLength)
}

function loadMarkdownPreparationCatalog() {
  if (activeMarkdownPreparationCatalogRequest) {
    return activeMarkdownPreparationCatalogRequest
  }

  const request = Promise.all([
    ApiAiService.listProviders({ suppressErrorMessage: true }),
    ApiAiService.listModels(undefined, { suppressErrorMessage: true }),
  ]).then(([providerConfigs, modelConfigs]) => ({ providerConfigs, modelConfigs }))

  activeMarkdownPreparationCatalogRequest = request
  const clearRequest = () => {
    if (activeMarkdownPreparationCatalogRequest === request) {
      activeMarkdownPreparationCatalogRequest = null
    }
  }
  void request.then(clearRequest, clearRequest)

  return request
}
