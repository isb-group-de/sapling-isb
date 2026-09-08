import { beforeEach, describe, expect, it, vi } from 'vitest'
import ApiTranslationService from '../api.translation.service'
const get = vi.hoisted(() => vi.fn())
vi.mock('axios', () => ({ default: { get } }))
vi.mock('../api.client', () => ({ buildApiUrl: (value: string) => value }))
describe('Translation transport bundles', () => {
  beforeEach(() => {
    get.mockReset()
  })
  it('loads a complete 224-namespace cold start in three bounded requests', async () => {
    get.mockImplementation(async (_url, { params }) => ({
      data: {
        messages: Object.fromEntries(
          params.entities.split(',').map((name: string) => [name, { title: name }]),
        ),
      },
    }))
    const rows = await ApiTranslationService.load(
      Array.from({ length: 224 }, (_, i) => `n${i}`),
      'de',
    )
    expect(get).toHaveBeenCalledTimes(3)
    expect(rows).toHaveLength(224)
    for (const [, options] of get.mock.calls)
      expect(options.params.entities.split(',').length).toBeLessThanOrEqual(100)
  })
})
