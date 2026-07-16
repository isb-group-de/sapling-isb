import { describe, expect, it } from 'vitest'
import type { AiProviderModelItem, AiProviderTypeItem } from '@/entity/entity'
import {
  calculateAge,
  getCurrentWeekday,
  mapModelOptions,
  mapProviderOptions,
  normalizeHandle,
} from './saplingAccount.utils'

describe('saplingAccount utils', () => {
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

  it('returns bounded weekday and age projections', () => {
    expect(getCurrentWeekday()).toBeGreaterThanOrEqual(0)
    expect(getCurrentWeekday()).toBeLessThanOrEqual(6)
    expect(calculateAge(new Date())).toBe(0)
    expect(calculateAge(null)).toBeNull()
  })
})
