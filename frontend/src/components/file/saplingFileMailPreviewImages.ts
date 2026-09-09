export type MailPreviewImageSelection = {
  src: string
  alt: string
}

type OpenMailPreviewImage = (selection: MailPreviewImageSelection, image: HTMLImageElement) => void

/**
 * Makes sanitized images inside the isolated mail iframe behave like the
 * image previews used by Sapling's Markdown renderer.
 */
export function installMailPreviewImageInteractions(
  document: Document,
  previewLabel: string,
  openImage: OpenMailPreviewImage,
): () => void {
  for (const image of document.querySelectorAll<HTMLImageElement>('img[src]')) {
    image.tabIndex = 0
    image.setAttribute('role', 'button')
    image.setAttribute('aria-haspopup', 'dialog')
    image.setAttribute('aria-label', image.alt ? `${previewLabel}: ${image.alt}` : previewLabel)
  }

  const activateImage = (event: MouseEvent | KeyboardEvent) => {
    if (event.type === 'keydown') {
      const key = (event as KeyboardEvent).key
      if (key !== 'Enter' && key !== ' ') return
    }

    const image = getEventImage(event)
    if (!image) return

    event.preventDefault()
    event.stopPropagation()
    openImage(
      {
        src: image.currentSrc || image.src,
        alt: image.alt,
      },
      image,
    )
  }

  document.addEventListener('click', activateImage)
  document.addEventListener('keydown', activateImage)

  return () => {
    document.removeEventListener('click', activateImage)
    document.removeEventListener('keydown', activateImage)
  }
}

function getEventImage(event: Event): HTMLImageElement | null {
  const target = event.target
  if (!target || typeof target !== 'object' || !('tagName' in target)) return null
  const image = target as HTMLImageElement
  return image.tagName === 'IMG' && image.getAttribute('src') ? image : null
}
