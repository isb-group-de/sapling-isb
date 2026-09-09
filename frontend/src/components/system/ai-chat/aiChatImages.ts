export function clipboardImageFiles(event: ClipboardEvent): File[] {
  return Array.from(event.clipboardData?.items ?? [])
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => !!file)
}

export function messageImages(
  context: object | null | undefined,
): Array<{ handle: number; filename: string }> {
  const attachments = (context as Record<string, unknown> | null | undefined)?.importAttachments
  if (!Array.isArray(attachments)) return []
  return attachments
    .filter(
      (item) => item && item.purpose === 'vision' && typeof item.attachmentHandle === 'number',
    )
    .map((item) => ({ handle: item.attachmentHandle, filename: String(item.filename ?? '') }))
}
