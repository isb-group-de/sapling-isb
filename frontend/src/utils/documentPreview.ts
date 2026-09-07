export function getPreviewType(mimetype: string, filename: string) {
  const mime = (mimetype || '').split(';')[0]!.trim().toLowerCase()
  const name = (filename || '').trim().toLowerCase()

  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpeg'
  if (mime === 'image/svg+xml') return 'svg'
  if (mime === 'image/x-icon' || mime === 'image/vnd.microsoft.icon') return 'ico'
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
  return 'none'
}
