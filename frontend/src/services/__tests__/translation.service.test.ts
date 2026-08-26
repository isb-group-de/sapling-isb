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
})
