import axios from 'axios'
import { buildApiUrl } from './api.client'
import type { ReferencedImageDocument } from './api.document.service'

const endpoint = 'current/profile-pictures'

export default class ApiProfilePictureService {
  static async list(): Promise<ReferencedImageDocument[]> {
    return (await axios.get<ReferencedImageDocument[]>(buildApiUrl(endpoint))).data
  }

  static async upload(file: File): Promise<ReferencedImageDocument> {
    const data = new FormData()
    data.append('file', file)
    return (await axios.post<ReferencedImageDocument>(buildApiUrl(endpoint), data)).data
  }

  static async remove(handle: number): Promise<void> {
    await axios.delete(this.getImageUrl(handle))
  }

  static async getImage(handle: number, signal: AbortSignal): Promise<Blob> {
    return (await axios.get<Blob>(this.getImageUrl(handle), { responseType: 'blob', signal })).data
  }

  static getImageUrl(handle: number): string {
    return buildApiUrl(`${endpoint}/${encodeURIComponent(handle)}`)
  }
}
