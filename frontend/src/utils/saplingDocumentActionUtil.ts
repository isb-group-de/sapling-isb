import ApiDocumentService from '@/services/api.document.service'

export function buildLocalDocumentUrl(entityHandle: string, reference: string): string {
  const filter = encodeURIComponent(JSON.stringify({ reference, entity: entityHandle }))
  return `/file/document?filter=${filter}`
}

function openUrlInNewTab(url: string): void {
  const targetWindow = window.open(url, '_blank')
  if (!targetWindow) {
    window.location.assign(url)
    return
  }

  targetWindow.opener = null
}

export async function openDocumentView(entityHandle: string, reference: string): Promise<void> {
  const targetWindow = window.open('', '_blank')
  if (targetWindow) {
    targetWindow.opener = null
  }

  try {
    const response = await ApiDocumentService.getDvelopDocumentsUrl(entityHandle, reference)
    const targetUrl =
      response.isActive && response.url
        ? response.url
        : buildLocalDocumentUrl(entityHandle, reference)

    if (targetWindow) {
      targetWindow.location.href = targetUrl
      return
    }

    openUrlInNewTab(targetUrl)
  } catch (error) {
    targetWindow?.close()
    throw error
  }
}

export async function openDvelopUploadDialog(
  entityHandle: string,
  reference: string,
): Promise<boolean> {
  const response = await ApiDocumentService.getDvelopUploadDialogUrl(entityHandle, reference)

  if (!response.isActive || !response.url) {
    return false
  }

  openUrlInNewTab(response.url)
  return true
}
