export function createJsonDownloadFilename(label: string, fallback = 'data'): string {
  const safeLabel = Array.from(label.trim(), (character) =>
    character.charCodeAt(0) < 32 ? '-' : character,
  ).join('')
  const filename = safeLabel
    .replace(/\*+$/, '')
    .trim()
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/[.\s-]+$/, '')

  return `${filename || fallback}.json`
}
