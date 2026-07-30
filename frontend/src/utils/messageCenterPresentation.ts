import type { Message } from '@/composables/system/useSaplingMessageCenter'

export type MessageTranslator = (key: string, params?: Record<string, unknown>) => string
export type TranslationExists = (key: string) => boolean

const TRANSLATION_KEY_PATTERN = /^[a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_-]+)+$/
const LEGACY_TABLE_REFERENCE_PATTERN = /(["“”„])([a-z][a-z0-9_]*_item)(["“”„])/g
export const MESSAGE_CENTER_TRANSLATION_NAMESPACES = [
  'account',
  'ai',
  'aiChat',
  'aiEntityGeneration',
  'aiVectorization',
  'calendar',
  'calendarSyncSubscription',
  'exception',
  'global',
  'issue',
  'login',
  'mail',
  'messageCenter',
  'navigation',
  'providerUserImport',
] as const
const MESSAGE_TRANSLATION_NAMESPACES = new Set<string>(MESSAGE_CENTER_TRANSLATION_NAMESPACES)

export function formatMessageTitle(
  value: string,
  translate: MessageTranslator,
  translationExists: TranslationExists,
): string {
  if (translationExists(value)) {
    return translate(value)
  }

  if (isTranslationKey(value)) {
    return translationExists('exception.unknownError')
      ? translate('exception.unknownError')
      : 'Unknown error'
  }

  return value
}

export function formatMessageDescription(
  message: Pick<Message, 'description' | 'descriptionParams'>,
  translate: MessageTranslator,
  translationExists: TranslationExists,
): string {
  const { description } = message

  if (translationExists(description)) {
    return translate(
      description,
      resolveDescriptionParams(message.descriptionParams, translate, translationExists),
    )
  }

  if (isTranslationKey(description)) {
    return translationExists('messageCenter.detailsUnavailable')
      ? translate('messageCenter.detailsUnavailable')
      : 'Additional information is currently unavailable.'
  }

  return replaceLegacyTableReferences(description, translate, translationExists)
}

export function getMessageEntityLabel(
  entity: string,
  translate: MessageTranslator,
  translationExists: TranslationExists,
): string {
  const entityHandle = normalizeEntityHandle(entity)
  const translationKeys = [
    `navigation.${entityHandle}`,
    `${entityHandle}.title`,
    `global.${entityHandle}`,
  ]

  const translationKey = translationKeys.find(translationExists)
  if (translationKey) {
    return translate(translationKey)
  }

  return humanizeEntityHandle(entityHandle)
}

export function normalizeEntityHandle(entityOrTable: string): string {
  const normalized = entityOrTable
    .replace(/^.*\./, '')
    .replace(/"/g, '')
    .replace(/_item$/i, '')

  return normalized.replace(/_([a-z0-9])/g, (_match: string, letter: string) =>
    letter.toUpperCase(),
  )
}

function resolveDescriptionParams(
  params: Record<string, unknown> | undefined,
  translate: MessageTranslator,
  translationExists: TranslationExists,
): Record<string, unknown> | undefined {
  if (!params) {
    return undefined
  }

  const { entityHandle, ...resolvedParams } = params
  if (typeof entityHandle === 'string' && entityHandle.trim()) {
    resolvedParams.entity = getMessageEntityLabel(entityHandle, translate, translationExists)
  }

  return resolvedParams
}

function replaceLegacyTableReferences(
  description: string,
  translate: MessageTranslator,
  translationExists: TranslationExists,
): string {
  return description.replace(
    LEGACY_TABLE_REFERENCE_PATTERN,
    (_match, openingQuote: string, tableName: string, closingQuote: string) =>
      `${openingQuote}${getMessageEntityLabel(tableName, translate, translationExists)}${closingQuote}`,
  )
}

function humanizeEntityHandle(entity: string): string {
  return entity
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isTranslationKey(value: string): boolean {
  if (!TRANSLATION_KEY_PATTERN.test(value)) {
    return false
  }

  return MESSAGE_TRANSLATION_NAMESPACES.has(value.slice(0, value.indexOf('.')))
}
