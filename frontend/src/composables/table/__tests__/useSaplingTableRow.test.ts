import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplate, SaplingTableHeaderItem } from '@/entity/structure'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  update: vi.fn(),
  loadGeneric: vi.fn(),
  referenceState: {
    isLoading: false,
    entity: { handle: 'country' },
    entityPermission: { allowUpdate: true },
    entityTemplates: [] as EntityTemplate[],
  },
}))

vi.mock('@/services/api.generic.service', () => ({
  default: { find: mocks.find, update: mocks.update },
}))

vi.mock('@/stores/genericStore', () => ({
  useGenericStore: () => ({
    loadGeneric: mocks.loadGeneric,
    getState: () => mocks.referenceState,
  }),
}))

vi.mock('@/stores/currentPermissionStore', () => ({
  useCurrentPermissionStore: () => ({ accumulatedPermission: [] }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/composables/dialog/useSaplingMailDialog', () => ({
  useSaplingMailDialog: () => ({ openMailDialog: vi.fn() }),
}))

import { useSaplingTableRow, type UseSaplingTableRowProps } from '../useSaplingTableRow'

function createRow(column: SaplingTableHeaderItem, referenceValue: SaplingGenericItem) {
  const emit = vi.fn()
  const props: UseSaplingTableRowProps = {
    item: { handle: 1, [String(column.key)]: referenceValue },
    columns: [column],
    index: 0,
    entityHandle: 'address',
    entity: null,
    entityPermission: null,
    entityTemplates: [],
    canNavigate: false,
    canShowInformation: false,
    showActions: false,
  }

  return { emit, row: useSaplingTableRow(props, emit) }
}

describe('useSaplingTableRow relation dialogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.referenceState.entityTemplates = [
      { key: 'name', name: 'name', type: 'string' } as EntityTemplate,
      {
        key: 'localizedNames',
        name: 'localizedNames',
        type: 'Collection',
        inlineCollection: { renderer: 'conditionBuilder' },
      } as EntityTemplate,
      {
        key: 'profile',
        name: 'profile',
        type: 'OneToOne',
        kind: '1:1',
        isReference: true,
        referenceName: 'countryProfile',
      } as EntityTemplate,
    ]
  })

  it('loads the complete referenced record before opening the edit dialog', async () => {
    const fullCountry = {
      handle: 'DE',
      name: 'Deutschland',
      dialingCode: '+49',
      localizedNames: [{ handle: 1, name: 'Germany' }],
    }
    mocks.find.mockResolvedValue({ data: [fullCountry], meta: { total: 1 } })
    const { row } = createRow(
      {
        key: 'country',
        name: 'country',
        kind: 'm:1',
        referenceName: 'country',
        referencedPks: ['handle'],
      } as SaplingTableHeaderItem,
      { handle: 'DE', name: 'Deutschland' },
    )

    await row.openDialogForCol('country')

    expect(mocks.loadGeneric).toHaveBeenCalledWith('country', 'global')
    expect(mocks.find).toHaveBeenCalledWith('country', {
      filter: { handle: 'DE' },
      limit: 1,
      relations: ['m:1', 'profile', 'localizedNames'],
    })
    expect(row.getDialogItemForCol('country')).toEqual(fullCountry)
    expect(row.isDialogOpenForCol('country')).toBe(true)
    expect(row.isDialogLoadingForCol('country')).toBe(false)
    expect(row.getReferenceDialogMode('country')).toBe('edit')
  })

  it('uses the declared referenced primary key and keeps the dialog closed for missing records', async () => {
    mocks.find.mockResolvedValue({ data: [], meta: { total: 0 } })
    const { row } = createRow(
      {
        key: 'country',
        name: 'country',
        kind: 'm:1',
        referenceName: 'country',
        referencedPks: ['code'],
      } as SaplingTableHeaderItem,
      { code: 'DE', name: 'Deutschland' },
    )

    await row.openDialogForCol('country')

    expect(mocks.find).toHaveBeenCalledWith(
      'country',
      expect.objectContaining({ filter: { code: 'DE' } }),
    )
    expect(row.getDialogItemForCol('country')).toBeNull()
    expect(row.isDialogOpenForCol('country')).toBe(false)
    expect(row.isDialogLoadingForCol('country')).toBe(false)
  })

  it('updates and fully reloads a referenced record through the edit dialog', async () => {
    const originalCountry = {
      handle: 'DE',
      name: 'Deutschland',
      updatedAt: '2026-07-17T08:00:00.000Z',
    }
    const updatedCountry = {
      ...originalCountry,
      name: 'Bundesrepublik Deutschland',
      updatedAt: '2026-07-17T09:00:00.000Z',
    }
    mocks.find
      .mockResolvedValueOnce({ data: [originalCountry], meta: { total: 1 } })
      .mockResolvedValueOnce({ data: [updatedCountry], meta: { total: 1 } })
    mocks.update.mockResolvedValue(updatedCountry)
    const { emit, row } = createRow(
      {
        key: 'country',
        name: 'country',
        kind: 'm:1',
        referenceName: 'country',
        referencedPks: ['handle'],
      } as SaplingTableHeaderItem,
      { handle: 'DE', name: 'Deutschland' },
    )
    const complete = vi.fn()

    await row.openDialogForCol('country')
    await row.saveDialogForCol('country', { name: 'Bundesrepublik Deutschland' }, 'save', {
      complete,
    })

    expect(mocks.update).toHaveBeenCalledWith(
      'country',
      'DE',
      { name: 'Bundesrepublik Deutschland' },
      expect.objectContaining({
        relations: ['m:1', 'profile', 'localizedNames'],
      }),
    )
    expect(row.getDialogItemForCol('country')).toEqual(updatedCountry)
    expect(complete).toHaveBeenCalledWith(true)
    expect(emit).toHaveBeenCalledWith('reload')
    expect(row.isDialogOpenForCol('country')).toBe(true)
  })
})
