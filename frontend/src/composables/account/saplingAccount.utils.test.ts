import { describe, expect, it } from 'vitest'
import type { AiProviderModelItem, AiProviderTypeItem } from '@/entity/entity'
import {
  appendMissingOutlookCategoryMappings,
  buildAccountTabs,
  calculateAge,
  getCurrentWeekday,
  isSaplingAccountType,
  mapModelOptions,
  mapProviderOptions,
  normalizeHandle,
} from './saplingAccount.utils'

describe('saplingAccount utils', () => {
  it.each(['sapling', { handle: 'sapling' }])(
    'offers local account security for %j',
    (personType) => {
      expect(isSaplingAccountType(personType)).toBe(true)
      expect(buildAccountTabs(personType).map((tab) => tab.key)).toContain('security')
    },
  )

  it.each(['azure', 'google', { handle: 'azure' }, { handle: 'google' }, null, undefined])(
    'omits local security but keeps sessions for %j',
    (personType) => {
      expect(isSaplingAccountType(personType)).toBe(false)
      expect(buildAccountTabs(personType).map((tab) => tab.key)).toEqual([
        'profile',
        'notifications',
        'sync',
        'sessions',
        'preferences',
        'songbird',
      ])
    },
  )

  it('maps provider and model catalogs into select options', () => {
    expect(
      mapProviderOptions([{ handle: 'openai', title: 'OpenAI' } as AiProviderTypeItem]),
    ).toEqual([{ title: 'OpenAI', value: 'openai' }])

    expect(
      mapModelOptions([
        {
          handle: 'gpt',
          title: 'GPT',
          providerModel: 'gpt-5',
        } as AiProviderModelItem,
      ]),
    ).toEqual([{ title: 'GPT (gpt-5)', value: 'gpt' }])
  })

  it('normalizes optional handles', () => {
    expect(normalizeHandle('  model-1 ')).toBe('model-1')
    expect(normalizeHandle('   ')).toBeNull()
    expect(normalizeHandle(42)).toBeNull()
  })

  it('adds missing Outlook categories as unassigned mapping rows', () => {
    const mappings = [
      {
        externalValue: 'Support',
        eventTypeHandle: 'review',
        eventCategoryHandle: 'support',
      },
    ]

    expect(
      appendMissingOutlookCategoryMappings(mappings, [
        { displayName: ' support ' },
        { displayName: 'Projekt' },
        { displayName: ' Vertrieb ' },
        { displayName: '' },
      ]),
    ).toBe(2)
    expect(mappings).toEqual([
      {
        externalValue: 'Support',
        eventTypeHandle: 'review',
        eventCategoryHandle: 'support',
      },
      {
        externalValue: 'Projekt',
        eventTypeHandle: null,
        eventCategoryHandle: null,
      },
      {
        externalValue: 'Vertrieb',
        eventTypeHandle: null,
        eventCategoryHandle: null,
      },
    ])
  })

  it('returns bounded weekday and age projections', () => {
    expect(getCurrentWeekday()).toBeGreaterThanOrEqual(0)
    expect(getCurrentWeekday()).toBeLessThanOrEqual(6)
    expect(calculateAge(new Date())).toBe(0)
    expect(calculateAge(null)).toBeNull()
  })
})
