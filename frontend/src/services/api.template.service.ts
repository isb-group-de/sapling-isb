import axios from 'axios'
import type { EntityTemplate } from '@/entity/structure'
import { buildApiUrl } from '@/services/api.client'
import { pushApiErrorMessage } from '@/services/api.error.service'

const entityTemplateCache = new Map<string, Promise<EntityTemplate[]>>()

interface EntityTemplateRequestOptions {
  suppressErrorMessage?: boolean
}

class ApiTemplateService {
  static async getEntityTemplate(
    entityHandle: string,
    force = false,
    options: EntityTemplateRequestOptions = {},
  ): Promise<EntityTemplate[]> {
    const normalizedEntityHandle = entityHandle.trim()

    if (!force) {
      const cachedPromise = entityTemplateCache.get(normalizedEntityHandle)
      if (cachedPromise) {
        return cachedPromise
      }
    }

    const promise = this.fetchEntityTemplate(normalizedEntityHandle, options)
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

  private static async fetchEntityTemplate(
    entityHandle: string,
    options: EntityTemplateRequestOptions,
  ): Promise<EntityTemplate[]> {
    try {
      const response = await axios.get<EntityTemplate[]>(buildApiUrl(`template/${entityHandle}`))
      return response.data
    } catch (error: unknown) {
      entityTemplateCache.delete(entityHandle)
      if (!options.suppressErrorMessage) {
        pushApiErrorMessage(error, 'exception.unknownError', entityHandle)
      }
      throw error
    }
  }
}

export default ApiTemplateService
