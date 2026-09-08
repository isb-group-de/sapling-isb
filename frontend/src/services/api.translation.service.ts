import axios from 'axios'
import { buildApiUrl } from './api.client'
import type { TranslationItem } from '@/entity/entity'

export default class ApiTranslationService {
  static async load(entities: string[], language: string): Promise<TranslationItem[]> {
    const names = [...new Set(entities)].sort()
    const responses = await Promise.all(
      Array.from({ length: Math.ceil(names.length / 100) }, async (_, index) => {
        const batch = names.slice(index * 100, (index + 1) * 100)
        const { data } = await axios.get<{ messages: Record<string, Record<string, string>> }>(
          buildApiUrl('translation/bundle'),
          {
            params: { language, entities: batch.join(',') },
          },
        )
        return Object.entries(data.messages).flatMap(([entity, entries]) =>
          Object.entries(entries).map(
            ([property, value]) => ({ entity, property, value }) as TranslationItem,
          ),
        )
      }),
    )
    return responses.flat()
  }
}
