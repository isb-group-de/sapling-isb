import axios from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import TranslationService from '../translation.service'
import { useTranslationStore } from '@/stores/translationStore'
import { i18n } from '@/i18n'

vi.mock('axios', () => ({ default: { get: vi.fn(), isCancel: vi.fn(() => false) } }))
vi.mock('@/services/api.client', () => ({ buildApiUrl: (path: string) => `/api/${path}` }))
vi.mock('@/services/api.error.service', () => ({ pushApiErrorMessage: vi.fn() }))

describe('batched translations with the real bundle client', () => {
  it('loads all translations once for concurrent callers before marking a namespace loaded', async () => {
    setActivePinia(createPinia())
    i18n.global.locale.value = 'de'
    const rows = Array.from({ length: 101 }, (_, index) => ({
      entity: 'ticket',
      property: `property${index}`,
      value: `Value ${index}`,
    }))
    vi.mocked(axios.get).mockImplementation(async (_url, config) => {
      expect(useTranslationStore().has('ticket')).toBe(false)
      expect(config?.params).toEqual({ language: 'de', entities: 'ticket' })
      return {
        data: {
          messages: { ticket: Object.fromEntries(rows.map((row) => [row.property, row.value])) },
        },
      }
    })
    const results = await Promise.all([
      new TranslationService().prepare('ticket'),
      new TranslationService().prepare('ticket'),
    ])
    expect(results).toEqual([rows, rows])
    expect(axios.get).toHaveBeenCalledTimes(1)
    expect(useTranslationStore().has('ticket')).toBe(true)
    expect(i18n.global.getLocaleMessage('de')).toHaveProperty('ticket.property100', 'Value 100')
  })
})
