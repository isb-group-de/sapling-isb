export function getPreviewType(mimetype: string, filename: string) {
  const mime = (mimetype || '').split(';')[0]!.trim().toLowerCase()
  const name = (filename || '').trim().toLowerCase()

  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpeg'
  if (mime === 'image/svg+xml') return 'svg'
  if (mime === 'image/x-icon' || mime === 'image/vnd.microsoft.icon') return 'ico'
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'audio/mpeg' || mime === 'audio/mp3' || name.endsWith('.mp3')) return 'audio'
  if (
    mime === 'video/mp4' ||
    mime === 'video/webm' ||
    name.endsWith('.mp4') ||
    name.endsWith('.webm')
  )
    return 'video'
  if (mime === 'application/json') return 'json'
  if (
    mime === 'message/rfc822' ||
    mime === 'application/vnd.ms-outlook' ||
    mime === 'application/x-msg' ||
    name.endsWith('.eml') ||
    name.endsWith('.msg')
  )
    return 'mail'
  if (name.endsWith('.svg')) return 'svg'
  if (name.endsWith('.ico')) return 'ico'
  if (getImagePreviewMimeType('', name)) return 'image'
  return 'none'
}

/** Preserve image MIME metadata and repair generic metadata from a known extension. */
export function getImagePreviewMimeType(mimetype: string, filename: string): string {
  const mime = (mimetype || '').split(';')[0]!.trim().toLowerCase()
  if (mime === 'image/x-icon') return 'image/vnd.microsoft.icon'
  if (mime === 'image/jpg') return 'image/jpeg'
  if (mime.startsWith('image/')) return mime
  const extension = filename.trim().toLowerCase().split('.').pop() ?? ''
  const types: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    ico: 'image/vnd.microsoft.icon',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    heic: 'image/heic',
    heif: 'image/heif',
    apng: 'image/apng',
    jxl: 'image/jxl',
  }
  return types[extension] ?? ''
}
