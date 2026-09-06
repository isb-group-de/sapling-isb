import axios from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import TranslationService from '../translation.service'
import { useTranslationStore } from '@/stores/translationStore'
import { i18n } from '@/i18n'

vi.mock('axios', () => ({ default: { get: vi.fn(), isCancel: vi.fn(() => false) } }))
vi.mock('@/services/api.client', () => ({ buildApiUrl: (path: string) => `/api/${path}` }))
vi.mock('@/services/api.error.service', () => ({ pushApiErrorMessage: vi.fn() }))

describe('batched translations with the real generic paginator', () => {
  it('loads all pages once for concurrent callers before marking a namespace loaded', async () => {
    setActivePinia(createPinia())
    i18n.global.locale.value = 'de'
    const rows = Array.from({ length: 101 }, (_, index) => ({
      handle: index + 1,
      entity: 'ticket',
      property: `property${index}`,
      value: `Value ${index}`,
    }))
    vi.mocked(axios.get).mockImplementation(async (_url, config) => {
      expect(useTranslationStore().has('ticket')).toBe(false)
      const params = config?.params as { page: number; limit: number }
      const page = params.page
      expect(params.limit).toBe(100)
      return { data: { data: rows.slice((page - 1) * 100, page * 100), meta: { totalPages: 2 } } }
    })
    const results = await Promise.all([
      new TranslationService().prepare('ticket'),
      new TranslationService().prepare('ticket'),
    ])
    expect(results).toEqual([rows, rows])
    expect(axios.get).toHaveBeenCalledTimes(2)
    expect(useTranslationStore().has('ticket')).toBe(true)
    expect(i18n.global.getLocaleMessage('de')).toHaveProperty('ticket.property100', 'Value 100')
  })
})
