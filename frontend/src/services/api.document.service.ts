import axios from 'axios'
import { buildApiUrl } from '@/services/api.client'
import { pushApiErrorMessage } from '@/services/api.error.service'

export interface DvelopDocumentActionResponse {
  isActive: boolean
  mode: 'dvelopCloud' | 'local'
  url?: string
  connectionHandle?: number
  mappingHandle?: number
  reason?: string
}

class ApiDocumentService {
  static async upload(
    entityHandle: string,
    reference: string,
    formData: FormData,
  ): Promise<unknown> {
    try {
      const response = await axios.post(
        buildApiUrl(`document/upload/${entityHandle}/${reference}`),
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        },
      )
      return response.data
    } catch (error: unknown) {
      pushApiErrorMessage(error, 'exception.unknownError', entityHandle)
      throw error
    }
  }

  static async getDvelopDocumentsUrl(
    entityHandle: string,
    reference: string,
  ): Promise<DvelopDocumentActionResponse> {
    try {
      const response = await axios.get<DvelopDocumentActionResponse>(
        buildApiUrl(
          `document/dvelop/open/${encodeURIComponent(entityHandle)}/${encodeURIComponent(reference)}`,
        ),
      )
      return response.data
    } catch (error: unknown) {
      pushApiErrorMessage(error, 'exception.unknownError', entityHandle)
      throw error
    }
  }

  static async getDvelopUploadDialogUrl(
    entityHandle: string,
    reference: string,
  ): Promise<DvelopDocumentActionResponse> {
    try {
      const response = await axios.get<DvelopDocumentActionResponse>(
        buildApiUrl(
          `document/dvelop/upload-dialog/${encodeURIComponent(entityHandle)}/${encodeURIComponent(reference)}`,
        ),
      )
      return response.data
    } catch (error: unknown) {
      pushApiErrorMessage(error, 'exception.unknownError', entityHandle)
      throw error
    }
  }
}

export default ApiDocumentService
