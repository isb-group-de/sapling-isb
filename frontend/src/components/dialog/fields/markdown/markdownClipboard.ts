const clipboardImageExtensions: Record<string, string> = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
}

export function extractClipboardImageFiles(clipboardData: DataTransfer | null): File[] {
  if (!clipboardData) {
    return []
  }

  const itemFiles = Array.from(clipboardData.items ?? []).flatMap((item) => {
    if (item.kind !== 'file') {
      return []
    }

    const file = item.getAsFile()
    return file ? [file] : []
  })
  const files = itemFiles.length > 0 ? itemFiles : Array.from(clipboardData.files ?? [])

  return files
    .filter((file) => file.type.startsWith('image/'))
    .map((file, index) => ensureClipboardImageFilename(file, index))
}

function ensureClipboardImageFilename(file: File, index: number): File {
  if (file.name.trim()) {
    return file
  }

  const extension = clipboardImageExtensions[file.type] ?? 'png'
  return new File([file], `clipboard-image-${index + 1}.${extension}`, {
    type: file.type,
    lastModified: file.lastModified,
  })
}
