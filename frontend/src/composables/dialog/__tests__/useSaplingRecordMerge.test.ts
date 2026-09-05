import { effectScope, nextTick, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SaplingGenericItem } from '@/entity/entity'
import type { RecordMergePreview } from '@/services/api.merge.service'
import ApiMergeService from '@/services/api.merge.service'
import { useSaplingRecordMerge } from '../useSaplingRecordMerge'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/composables/system/useSaplingMessageCenter', () => ({
  useSaplingMessageCenter: () => ({ pushMessage: vi.fn() }),
}))
vi.mock('@/services/api.merge.service', () => ({ default: { preview: vi.fn(), merge: vi.fn() } }))

const scopes: ReturnType<typeof effectScope>[] = []
function setup() {
  const scope = effectScope()
  scopes.push(scope)
  const props = reactive({
    modelValue: true,
    entityHandle: 'company',
    item: { handle: 1 } as SaplingGenericItem | null,
  })
  const merged = vi.fn()
  const state = scope.run(() => useSaplingRecordMerge(props, merged))!
  return { props, merged, state }
}
function preview(): RecordMergePreview {
  return {
    loser: { handle: 1 },
    winner: { handle: 2 },
    previewToken: 'server-token',
    fields: [
      {
        property: 'name',
        selectable: true,
        selectedSource: 'winner',
        loserValue: 'Source',
        winnerValue: 'Winner',
        template: { key: 'company.name', name: 'name', type: 'string' },
      },
      {
        property: 'description',
        selectable: true,
        selectedSource: 'loser',
        loserValue: 'Filled',
        winnerValue: null,
        template: { key: 'company.description', name: 'description', type: 'string' },
      },
      {
        property: 'system',
        selectable: false,
        selectedSource: 'winner',
        loserValue: 5,
        winnerValue: 6,
        template: { key: 'company.system', name: 'system', type: 'number' },
      },
    ],
  }
}

describe('generic record merge dialog state', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(ApiMergeService.preview).mockResolvedValue(preview())
    vi.mocked(ApiMergeService.merge).mockResolvedValue({ winner: { handle: 2 }, deletedHandle: 1 })
  })
  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop())
  })

  it('requires two different persisted records', async () => {
    const { state } = setup()
    await state.loadPreview()
    state.winner.value = { handle: '1' }
    await state.loadPreview()
    expect(ApiMergeService.preview).not.toHaveBeenCalled()
    expect(state.pair.value).toBeNull()
  })

  it('adopts server defaults and sends only selectable field sources and the preview token', async () => {
    const { state, merged } = setup()
    state.winner.value = { handle: 2 }
    await state.loadPreview()
    expect(state.selections.value).toEqual({ name: 'winner', description: 'loser' })
    state.selections.value.name = 'loser'
    await state.merge()
    expect(ApiMergeService.merge).toHaveBeenCalledWith('company', {
      loserHandle: 1,
      winnerHandle: 2,
      previewToken: 'server-token',
      selections: { name: 'loser', description: 'loser' },
    })
    expect(merged).toHaveBeenCalledWith({ winner: { handle: 2 }, deletedHandle: 1 })
  })

  it('invalidates the comparison when swapping winner and loser', async () => {
    const { state } = setup()
    state.winner.value = { handle: 2 }
    await state.loadPreview()
    state.swap()
    expect(state.pair.value).toEqual({ loserHandle: 2, winnerHandle: 1 })
    expect(state.preview.value).toBeNull()
    await state.merge()
    expect(ApiMergeService.merge).not.toHaveBeenCalled()
  })

  it('ignores late preview responses after the selected pair changes', async () => {
    let resolve!: (value: RecordMergePreview) => void
    vi.mocked(ApiMergeService.preview).mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const { state } = setup()
    state.winner.value = { handle: 2 }
    const request = state.loadPreview()
    state.winner.value = { handle: 3 }
    resolve(preview())
    await request
    expect(state.preview.value).toBeNull()
    expect(state.loading.value).toBe(false)
  })

  it('clears the previous pair and choices when the dialog reopens for another record', async () => {
    const { state, props } = setup()
    state.winner.value = { handle: 2 }
    await state.loadPreview()
    props.modelValue = false
    await nextTick()
    props.item = { handle: 9 }
    props.modelValue = true
    await nextTick()
    expect(state.loser.value).toEqual({ handle: 9 })
    expect(state.winner.value).toBeNull()
    expect(state.preview.value).toBeNull()
  })

  it('blocks double submission and swapping while a merge is in flight', async () => {
    let resolve!: (value: { winner: SaplingGenericItem; deletedHandle: number }) => void
    vi.mocked(ApiMergeService.merge).mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const { state } = setup()
    state.winner.value = { handle: 2 }
    await state.loadPreview()
    const first = state.merge()
    state.swap()
    await state.merge()
    expect(ApiMergeService.merge).toHaveBeenCalledTimes(1)
    expect(state.pair.value).toEqual({ loserHandle: 1, winnerHandle: 2 })
    resolve({ winner: { handle: 2 }, deletedHandle: 1 })
    await first
    expect(state.saving.value).toBe(false)
  })

  it('requires a new comparison after any failed merge and keeps the dialog open', async () => {
    vi.mocked(ApiMergeService.merge).mockRejectedValue(new Error('stale preview'))
    const { state, props, merged } = setup()
    state.winner.value = { handle: 2 }
    await state.loadPreview()
    await state.merge()
    expect(state.preview.value).toBeNull()
    expect(props.modelValue).toBe(true)
    expect(merged).not.toHaveBeenCalled()
    await state.merge()
    expect(ApiMergeService.merge).toHaveBeenCalledTimes(1)
  })
})
