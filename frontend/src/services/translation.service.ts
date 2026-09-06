import ApiGenericService from './api.generic.service'
import type { TranslationItem } from '@/entity/entity'
import { i18n } from '@/i18n'
import { useTranslationStore } from '@/stores/translationStore'
import { GENERIC_API_MAX_PAGE_SIZE } from '@/constants/project.constants'

type TranslationStore = ReturnType<typeof useTranslationStore>
type PendingNamespace = {
  promise: Promise<TranslationItem[]>
  resolve: (items: TranslationItem[]) => void
  reject: (error: unknown) => void
}
type TranslationBatch = {
  entities: Set<string>
  language: string
  pending: Map<string, PendingNamespace>
  queued: Set<string>
}

// Shared by service instances, but isolated between Pinia stores and resets.
const batches = new WeakMap<TranslationStore, TranslationBatch>()

class TranslationService {
  async loadAllTranslations(
    entityHandle: string[],
    currentLanguage: string,
  ): Promise<TranslationItem[]> {
    return ApiGenericService.findAll<TranslationItem>('translation', {
      filter: {
        entity: { $in: entityHandle },
        language: currentLanguage,
      },
      pageSize: GENERIC_API_MAX_PAGE_SIZE,
      // Translation loading is part of the application bootstrap. A temporarily
      // unavailable backend is represented by the surrounding skeleton/retry flow.
      suppressErrorMessage: true,
    })
  }

  /**
   * Prepares translations for the specified entity handles.
   * Loads translations from the backend if they are not already loaded.
   * @param entityHandle Array of entity handles to load translations for.
   * @returns Promise resolving to an array of TranslationItem objects.
   */
  async prepare(...entityHandle: string[]): Promise<TranslationItem[]> {
    const translationStore = useTranslationStore()
    const currentLanguage = i18n.global.locale.value as string
    translationStore.setLanguage(currentLanguage)

    const filteredEntityNames = [
      ...new Set(entityHandle.map((name) => name.trim()).filter(Boolean)),
    ]
    const toLoad = filteredEntityNames.filter((name) => !translationStore.has(name))
    if (toLoad.length === 0) {
      return []
    }
    let batch = batches.get(translationStore)
    if (batch?.entities !== translationStore.entities || batch.language !== currentLanguage) {
      batch = {
        entities: translationStore.entities,
        language: currentLanguage,
        pending: new Map(),
        queued: new Set(),
      }
      batches.set(translationStore, batch)
    }
    const currentBatch = batch
    const promises = toLoad.map((name) => {
      let pending = currentBatch.pending.get(name)
      if (!pending) {
        const { promise, resolve, reject } = deferredTranslations()
        pending = { promise, resolve, reject }
        currentBatch.pending.set(name, pending)
        const schedule = currentBatch.queued.size === 0
        currentBatch.queued.add(name)
        if (schedule) queueMicrotask(() => void flushBatch(this, translationStore, currentBatch))
      }
      return pending.promise
    })
    return (await Promise.all(promises)).flat()
  }

  /**
   * Converts an array of TranslationItem objects to a key-value map.
   * @param translations Array of TranslationItem objects.
   * @returns Object mapping 'entity.property' to translation value.
   */
  convertTranslations(translations: TranslationItem[]): Record<string, string> {
    const result: Record<string, string> = {}
    for (const entry of translations) {
      result[`${entry.entity}.${entry.property}`] = entry.value
    }
    return result
  }

  /**
   * Adds new translation messages to the i18n locale messages.
   * @param newMessages Object containing new translation key-value pairs.
   */
  addLocaleMessages(newMessages: Record<string, string>, language: string) {
    const existing = i18n.global.getLocaleMessage(language) as Record<string, string>
    const merged = { ...existing, ...newMessages }
    i18n.global.setLocaleMessage(language, merged)
  }
}

async function flushBatch(
  service: TranslationService,
  store: TranslationStore,
  batch: TranslationBatch,
): Promise<void> {
  const names = [...batch.queued]
  batch.queued.clear()
  const isCurrent = () =>
    store.entities === batch.entities &&
    store.language === batch.language &&
    i18n.global.locale.value === batch.language
  try {
    const translations = isCurrent() ? await service.loadAllTranslations(names, batch.language) : []
    const accepted = isCurrent() ? translations : []
    if (isCurrent()) {
      service.addLocaleMessages(service.convertTranslations(accepted), batch.language)
      store.addMany(names)
    }
    for (const name of names) {
      batch.pending.get(name)?.resolve(accepted.filter((entry) => entry.entity === name))
    }
  } catch (error) {
    for (const name of names) batch.pending.get(name)?.reject(error)
  } finally {
    for (const name of names) batch.pending.delete(name)
  }
}

function deferredTranslations(): PendingNamespace {
  let resolve!: PendingNamespace['resolve']
  let reject!: PendingNamespace['reject']
  const promise = new Promise<TranslationItem[]>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}

export default TranslationService
