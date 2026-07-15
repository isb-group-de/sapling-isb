import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { ChatNavigationLink } from './aiChatNavigation'

export function useSaplingAiChatNavigation(options?: { onNavigated?: () => void }) {
  const { t, te } = useI18n()
  const router = useRouter()

  function getNavigationLinkLabel(link: ChatNavigationLink) {
    if (link.kind === 'record' || link.kind === 'list') {
      return buildEntityNavigationLabel(link)
    }

    if (typeof link.label === 'string' && link.label.trim()) {
      return link.label.trim()
    }

    return link.kind === 'route' ? t('aiChat.openRouteLink') : t('aiChat.openDataLink')
  }

  function buildEntityNavigationLabel(link: ChatNavigationLink) {
    const count =
      typeof link.resultCount === 'number' && Number.isFinite(link.resultCount)
        ? Math.max(1, Math.trunc(link.resultCount))
        : Math.max(1, link.recordHandles?.length ?? 1)
    const entityLabel = getNavigationEntityLabel(link.entityHandle, count)

    if (count === 1) {
      return entityLabel
        ? t('aiChat.openRecordEntity', { entity: entityLabel })
        : t('aiChat.openRecordLink')
    }

    return entityLabel
      ? t('aiChat.openEntityResults', { count, entity: entityLabel })
      : t('aiChat.openRecordLink')
  }

  function getNavigationEntityLabel(entityHandle: string, count: number) {
    const navigationKey = `navigation.${entityHandle}`
    const label = te(navigationKey) ? String(t(navigationKey)).trim() : ''
    return count === 1 ? singularizeEntityLabel(label) : label
  }

  async function openNavigationLink(path: string) {
    await router.push(path)
    options?.onNavigated?.()
  }

  return {
    getNavigationEntityLabel,
    getNavigationLinkLabel,
    openNavigationLink,
  }
}

function singularizeEntityLabel(label: string) {
  const trimmedLabel = label.trim()
  return trimmedLabel.length > 3 && trimmedLabel.endsWith('s')
    ? trimmedLabel.slice(0, -1)
    : trimmedLabel
}
