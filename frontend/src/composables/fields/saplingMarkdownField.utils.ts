import ApiAiService from '@/services/api.ai.service'
import type { AiProviderModelItem, AiProviderTypeItem } from '@/entity/entity'
import type { MarkdownToolbarAction } from '@/components/dialog/fields/markdown/markdownField.types'

type MarkdownTranslator = (key: string) => string

interface MarkdownToolbarHandlers {
  applyHeading: (level: number) => void
  wrapSelection: (marker: string) => void
  applyLink: () => void
  applyImage: () => void
  toggleLinePrefix: (prefix: string, fallback: string) => void
  applyOrderedList: () => void
  applyChecklist: () => void
  applyInlineCode: () => void
  applyCodeBlock: () => void
  applyTable: () => void
  applyHorizontalRule: () => void
}

let activeCatalogRequest: Promise<{
  providerConfigs: AiProviderTypeItem[]
  modelConfigs: AiProviderModelItem[]
}> | null = null

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
  return Number.isFinite(value) && Number.isInteger(value) && (value ?? 0) > 0 ? value : undefined
}

export function truncateMarkdownValue(value: string, maxLength?: number): string {
  return maxLength == null || value.length <= maxLength ? value : value.slice(0, maxLength)
}

export function loadMarkdownPreparationCatalog() {
  if (activeCatalogRequest) return activeCatalogRequest

  const request = Promise.all([
    ApiAiService.listProviders({ suppressErrorMessage: true }),
    ApiAiService.listModels(undefined, { suppressErrorMessage: true }),
  ]).then(([providerConfigs, modelConfigs]) => ({ providerConfigs, modelConfigs }))
  activeCatalogRequest = request
  const clearRequest = () => {
    if (activeCatalogRequest === request) activeCatalogRequest = null
  }
  void request.then(clearRequest, clearRequest)
  return request
}

export function buildMarkdownToolbarActions(
  t: MarkdownTranslator,
  handlers: MarkdownToolbarHandlers,
): MarkdownToolbarAction[] {
  return [
    {
      key: 'heading1',
      group: 'structure',
      icon: 'mdi-format-header-1',
      title: t('global.heading1'),
      run: () => handlers.applyHeading(1),
    },
    {
      key: 'heading',
      group: 'structure',
      icon: 'mdi-format-header-2',
      title: t('global.heading2'),
      run: () => handlers.applyHeading(2),
    },
    {
      key: 'heading3',
      group: 'structure',
      icon: 'mdi-format-header-3',
      title: t('global.heading3'),
      run: () => handlers.applyHeading(3),
    },
    {
      key: 'bold',
      group: 'text',
      icon: 'mdi-format-bold',
      title: t('global.bold'),
      run: () => handlers.wrapSelection('**'),
    },
    {
      key: 'italic',
      group: 'text',
      icon: 'mdi-format-italic',
      title: t('global.italic'),
      run: () => handlers.wrapSelection('_'),
    },
    {
      key: 'strike',
      group: 'text',
      icon: 'mdi-format-strikethrough',
      title: t('global.strikethrough'),
      run: () => handlers.wrapSelection('~~'),
    },
    {
      key: 'link',
      group: 'text',
      icon: 'mdi-link-variant',
      title: t('global.link'),
      run: handlers.applyLink,
    },
    {
      key: 'image',
      group: 'media',
      icon: 'mdi-image-outline',
      title: t('global.image'),
      run: handlers.applyImage,
    },
    {
      key: 'list',
      group: 'lists',
      icon: 'mdi-format-list-bulleted',
      title: t('global.bulletList'),
      run: () => handlers.toggleLinePrefix('- ', t('global.listItem')),
    },
    {
      key: 'ordered-list',
      group: 'lists',
      icon: 'mdi-format-list-numbered',
      title: t('global.numberedList'),
      run: handlers.applyOrderedList,
    },
    {
      key: 'checklist',
      group: 'lists',
      icon: 'mdi-format-list-checks',
      title: t('global.checklist'),
      run: handlers.applyChecklist,
    },
    {
      key: 'quote',
      group: 'structure',
      icon: 'mdi-format-quote-close',
      title: t('global.quote'),
      run: () => handlers.toggleLinePrefix('> ', t('global.quote')),
    },
    {
      key: 'inline-code',
      group: 'code',
      icon: 'mdi-code-tags',
      title: t('global.inlineCode'),
      run: handlers.applyInlineCode,
    },
    {
      key: 'code-block',
      group: 'code',
      icon: 'mdi-code-braces-box',
      title: t('global.codeBlock'),
      run: handlers.applyCodeBlock,
    },
    {
      key: 'table',
      group: 'media',
      icon: 'mdi-table-large',
      title: t('global.table'),
      run: handlers.applyTable,
    },
    {
      key: 'divider',
      group: 'structure',
      icon: 'mdi-minus',
      title: t('global.horizontalRule'),
      run: handlers.applyHorizontalRule,
    },
  ]
}
