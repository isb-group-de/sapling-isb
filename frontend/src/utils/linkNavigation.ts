let removeGlobalLinkNavigation: (() => void) | null = null

function getModifiedLink(event: MouseEvent): HTMLAnchorElement | null {
  const isModifiedPrimaryClick = event.button === 0 && (event.ctrlKey || event.metaKey)
  const isMiddleClick = event.button === 1
  if (!isModifiedPrimaryClick && !isMiddleClick) {
    return null
  }

  const target = event.target
  if (!(target instanceof Element)) {
    return null
  }

  const anchor = target.closest<HTMLAnchorElement>('a[href]')
  if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) {
    return null
  }

  const url = new URL(anchor.href, window.location.href)
  return url.protocol === 'http:' || url.protocol === 'https:' ? anchor : null
}

export function prepareModifiedLinkForNewTab(event: MouseEvent): boolean {
  const anchor = getModifiedLink(event)
  if (!anchor) {
    return false
  }

  const previousTarget = anchor.getAttribute('target')
  anchor.target = '_blank'
  anchor.rel = anchor.rel || 'noopener noreferrer'

  window.setTimeout(() => {
    if (previousTarget === null) {
      anchor.removeAttribute('target')
      return
    }

    anchor.setAttribute('target', previousTarget)
  }, 0)

  return true
}

export function installGlobalModifiedLinkNavigation(): () => void {
  if (removeGlobalLinkNavigation) {
    return removeGlobalLinkNavigation
  }

  const handleLinkActivation = (event: MouseEvent) => {
    prepareModifiedLinkForNewTab(event)
  }

  document.addEventListener('click', handleLinkActivation, true)
  document.addEventListener('auxclick', handleLinkActivation, true)

  removeGlobalLinkNavigation = () => {
    document.removeEventListener('click', handleLinkActivation, true)
    document.removeEventListener('auxclick', handleLinkActivation, true)
    removeGlobalLinkNavigation = null
  }

  return removeGlobalLinkNavigation
}
