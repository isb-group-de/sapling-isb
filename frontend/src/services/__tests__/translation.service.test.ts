import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import type { TranslationItem } from '@/entity/entity'
import { i18n } from '@/i18n'
import { useTranslationStore } from '@/stores/translationStore'

const { findAllMock } = vi.hoisted(() => ({
  findAllMock: vi.fn(),
}))

vi.mock('../api.generic.service', () => ({
  default: {
    findAll: findAllMock,
  },
}))

import TranslationService from '../translation.service'

describe('TranslationService', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    findAllMock.mockReset()
    i18n.global.locale.value = 'de'
    i18n.global.setLocaleMessage('de', {})
    i18n.global.setLocaleMessage('en', {})
  })

  it('returns early when all requested entities are already loaded', async () => {
    const store = useTranslationStore()
    store.add('ticket')

    const service = new TranslationService()
    const result = await service.prepare('ticket')

    expect(result).toEqual([])
    expect(findAllMock).not.toHaveBeenCalled()
  })

  it('loads missing translations, filters blank names, and merges locale messages', async () => {
    const response: TranslationItem[] = [
      { entity: 'ticket', property: 'title', value: 'Ticket' },
      { entity: 'company', property: 'name', value: 'Firma' },
    ] as TranslationItem[]
    findAllMock.mockResolvedValue(response)
    i18n.global.setLocaleMessage('de', { existing: 'Vorhanden' })

    const service = new TranslationService()
    const result = await service.prepare('ticket', ' ', 'company')

    expect(findAllMock).toHaveBeenCalledWith('translation', {
      filter: {
        entity: { $in: ['ticket', 'company'] },
        language: 'de',
      },
      suppressErrorMessage: true,
      pageSize: 100,
    })
    expect(result).toEqual(response)
    expect(i18n.global.getLocaleMessage('de')).toEqual({
      existing: 'Vorhanden',
      'ticket.title': 'Ticket',
      'company.name': 'Firma',
    })
    expect(useTranslationStore().has('ticket')).toBe(true)
    expect(useTranslationStore().has('company')).toBe(true)
  })

  it('loads the complete translation set through the stable generic paginator', async () => {
    const translations: TranslationItem[] = [
      { entity: 'ticket', property: 'title', value: 'Ticket' },
      { entity: 'ticket', property: 'description', value: 'Beschreibung' },
    ] as TranslationItem[]

    findAllMock.mockResolvedValue(translations)

    const service = new TranslationService()
    const result = await service.prepare('ticket')

    expect(findAllMock).toHaveBeenCalledExactlyOnceWith('translation', {
      filter: {
        entity: { $in: ['ticket'] },
        language: 'de',
      },
      suppressErrorMessage: true,
      pageSize: 100,
    })
    expect(result).toEqual(translations)
    expect(i18n.global.getLocaleMessage('de')).toEqual({
      'ticket.title': 'Ticket',
      'ticket.description': 'Beschreibung',
    })
  })

  it('converts backend entries into locale message keys', () => {
    const service = new TranslationService()

    expect(
      service.convertTranslations([
        { entity: 'ticket', property: 'title', value: 'Ticket' },
      ] as TranslationItem[]),
    ).toEqual({ 'ticket.title': 'Ticket' })
  })

  it('batches overlapping namespaces across instances and returns only each callers entries', async () => {
    const ticket = { entity: 'ticket', property: 'title', value: 'Ticket' } as TranslationItem
    const company = { entity: 'company', property: 'name', value: 'Firma' } as TranslationItem
    findAllMock.mockResolvedValue([ticket, company])
    const first = new TranslationService().prepare(' ticket ', 'ticket', '')
    const second = new TranslationService().prepare('ticket', 'company')
    expect(findAllMock).not.toHaveBeenCalled()
    await expect(first).resolves.toEqual([ticket])
    await expect(second).resolves.toEqual([ticket, company])
    expect(findAllMock).toHaveBeenCalledTimes(1)
    expect(findAllMock.mock.calls[0][1].filter.entity.$in).toEqual(['ticket', 'company'])
    await expect(new TranslationService().prepare('ticket')).resolves.toEqual([])
  })

  it('shares in-flight namespaces while loading additional namespaces', async () => {
    const pending = deferredTranslations()
    const ticket = { entity: 'ticket', property: 'title', value: 'Ticket' } as TranslationItem
    const company = { entity: 'company', property: 'name', value: 'Firma' } as TranslationItem
    findAllMock.mockReturnValueOnce(pending.promise).mockResolvedValueOnce([company])
    const first = new TranslationService().prepare('ticket')
    await Promise.resolve()
    const second = new TranslationService().prepare('ticket', 'company')
    await Promise.resolve()
    expect(findAllMock).toHaveBeenCalledTimes(2)
    expect(findAllMock.mock.calls[1][1].filter.entity.$in).toEqual(['company'])
    expect(useTranslationStore().has('ticket')).toBe(false)
    pending.resolve([ticket])
    await expect(first).resolves.toEqual([ticket])
    await expect(second).resolves.toEqual([ticket, company])
  })

  it('releases failed namespaces for all waiting callers and permits a retry', async () => {
    findAllMock.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([])
    const results = await Promise.allSettled([
      new TranslationService().prepare('ticket'),
      new TranslationService().prepare('ticket'),
    ])
    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected'])
    expect(useTranslationStore().has('ticket')).toBe(false)
    await expect(new TranslationService().prepare('ticket')).resolves.toEqual([])
    expect(findAllMock).toHaveBeenCalledTimes(2)
    expect(useTranslationStore().has('ticket')).toBe(true)
  })

  it.each(['clear', '$reset', 'language'] as const)(
    'ignores a late response after %s and allows a fresh request',
    async (reset) => {
      const pending = deferredTranslations()
      const old = { entity: 'ticket', property: 'title', value: 'Old' } as TranslationItem
      const fresh = { ...old, value: 'New' }
      findAllMock.mockReturnValueOnce(pending.promise).mockResolvedValueOnce([fresh])
      const first = new TranslationService().prepare('ticket')
      await Promise.resolve()
      const store = useTranslationStore()
      if (reset === 'language') {
        i18n.global.locale.value = 'en'
        store.setLanguage('en')
        i18n.global.locale.value = 'de'
        store.setLanguage('de')
      } else store[reset]()
      await expect(new TranslationService().prepare('ticket')).resolves.toEqual([fresh])
      pending.resolve([old])
      await expect(first).resolves.toEqual([])
      expect(i18n.global.getLocaleMessage('de')).toEqual({ 'ticket.title': 'New' })
      expect(store.has('ticket')).toBe(true)
    },
  )

  it('isolates different Pinia stores', async () => {
    findAllMock.mockResolvedValue([])
    const first = new TranslationService().prepare('ticket')
    setActivePinia(createPinia())
    await Promise.all([first, new TranslationService().prepare('ticket')])
    expect(findAllMock).toHaveBeenCalledTimes(2)
  })
})

function deferredTranslations() {
  let resolve!: (items: TranslationItem[]) => void
  const promise = new Promise<TranslationItem[]>((accept) => {
    resolve = accept
  })
  return { promise, resolve }
}
