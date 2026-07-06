import axios from 'axios'
import type { EntityTemplate } from '@/entity/structure'
import { buildApiUrl } from '@/services/api.client'
import { pushApiErrorMessage } from '@/services/api.error.service'

const entityTemplateCache = new Map<string, Promise<EntityTemplate[]>>()

class ApiTemplateService {
  static async getEntityTemplate(entityHandle: string, force = false): Promise<EntityTemplate[]> {
    const normalizedEntityHandle = entityHandle.trim()

    if (!force) {
      const cachedPromise = entityTemplateCache.get(normalizedEntityHandle)
      if (cachedPromise) {
        return cachedPromise
      }
    }

    const promise = this.fetchEntityTemplate(normalizedEntityHandle)
    entityTemplateCache.set(normalizedEntityHandle, promise)
    return promise
  }

  static invalidate(entityHandle?: string): void {
    if (entityHandle?.trim()) {
      entityTemplateCache.delete(entityHandle.trim())
      return
    }

    entityTemplateCache.clear()
  }

  private static async fetchEntityTemplate(entityHandle: string): Promise<EntityTemplate[]> {
    try {
      const response = await axios.get<EntityTemplate[]>(buildApiUrl(`template/${entityHandle}`))
      return response.data
    } catch (error: unknown) {
      entityTemplateCache.delete(entityHandle)
      pushApiErrorMessage(error, 'exception.unknownError', entityHandle)
      throw error
    }
  }
}

export default ApiTemplateService
