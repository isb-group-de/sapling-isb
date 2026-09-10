import { describe, expect, it } from 'vitest'
import type { AiAgentItem, AiProviderModelItem, AiProviderTypeItem } from '@/entity/entity'
import {
  isSongbirdWidgetRuntimeAvailable,
  resolveSongbirdWidgetRuntime,
} from './songbirdWidgetRuntime'
const providers = [{ handle: 'a' }, { handle: 'b' }] as AiProviderTypeItem[]
const models = [
  { handle: 'a1', provider: 'a', isDefault: true },
  { handle: 'b1', provider: 'b', isDefault: false },
] as AiProviderModelItem[]
const agent = { handle: 'agent', provider: 'a', model: 'a1' } as AiAgentItem
describe('AI widget runtime', () => {
  it('uses explicit widget settings ahead of agent defaults', () => {
    expect(resolveSongbirdWidgetRuntime({ modelHandle: 'b1' }, agent, providers, models)).toEqual({
      providerHandle: 'b',
      modelHandle: 'b1',
    })
    expect(resolveSongbirdWidgetRuntime({ providerHandle: 'b' }, agent, providers, models)).toEqual(
      { providerHandle: 'b', modelHandle: 'b1' },
    )
    expect(resolveSongbirdWidgetRuntime({}, agent, providers, models)).toEqual({
      providerHandle: 'a',
      modelHandle: 'a1',
    })
  })
  it('rejects missing or mismatched runtime references instead of silently replacing them', () => {
    const available = (config: Parameters<typeof isSongbirdWidgetRuntimeAvailable>[0]) =>
      isSongbirdWidgetRuntimeAvailable(config, [{ value: 'agent' }], providers, models)
    expect(available({ agentHandle: 'gone' })).toBe(false)
    expect(available({ modelHandle: 'gone' })).toBe(false)
    expect(available({ providerHandle: 'a', modelHandle: 'b1' })).toBe(false)
    expect(available({ agentHandle: 'agent', modelHandle: 'b1' })).toBe(true)
  })
})
