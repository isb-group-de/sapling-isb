import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplate, SaplingTableHeaderItem } from '@/entity/structure'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  update: vi.fn(),
  loadGeneric: vi.fn(),
  permissions: [] as Array<{ entityHandle: string; allowRead: boolean }>,
  referenceStates: {} as Record<string, Record<string, unknown>>,
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
    getState: (key: string) => mocks.referenceStates[key] ?? mocks.referenceState,
  }),
}))

vi.mock('@/stores/currentPermissionStore', () => ({
  useCurrentPermissionStore: () => ({ accumulatedPermission: mocks.permissions }),
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
    mocks.permissions = []
    mocks.referenceStates = {}
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

  it('resolves a circular value reference from the current table record', () => {
    mocks.permissions = [
      { entityHandle: 'person', allowRead: true },
      { entityHandle: 'company', allowRead: true },
    ]
    mocks.referenceStates.person = {
      isLoading: false,
      entity: { handle: 'person' },
      entityPermission: { allowUpdate: true },
      entityTemplates: [
        {
          key: 'firstName',
          name: 'firstName',
          type: 'string',
          options: ['isValue'],
        },
        {
          key: 'lastName',
          name: 'lastName',
          type: 'string',
          options: ['isValue'],
        },
        {
          key: 'company',
          name: 'company',
          type: 'CompanyItem',
          kind: 'm:1',
          isReference: true,
          referenceName: 'company',
          options: ['isValue'],
        },
      ],
    }
    mocks.referenceStates.company = {
      isLoading: false,
      entity: { handle: 'company' },
      entityPermission: { allowUpdate: true },
      entityTemplates: [
        {
          key: 'name',
          name: 'name',
          type: 'string',
          options: ['isValue'],
        },
      ],
    }
    const emit = vi.fn()
    const props: UseSaplingTableRowProps = {
      item: {
        handle: 4,
        name: 'Bauer IT Solutions',
        accountManager: {
          handle: 7,
          firstName: 'Tom',
          lastName: 'Schneider',
          company: { handle: 4 },
        },
      },
      columns: [
        {
          key: 'accountManager',
          name: 'accountManager',
          kind: 'm:1',
          referenceName: 'person',
        } as SaplingTableHeaderItem,
      ],
      index: 0,
      entityHandle: 'company',
      entity: null,
      entityPermission: null,
      entityTemplates: [],
      canNavigate: false,
      canShowInformation: false,
      showActions: false,
    }

    const row = useSaplingTableRow(props, emit)

    expect(row.getCompactPanelTitleLines('accountManager')).toEqual([
      { value: 'Tom Schneider', isReference: false },
      { value: 'Bauer IT Solutions', isReference: true },
    ])
  })

  it('limits compact reference buttons to the first two value lines', () => {
    mocks.permissions = [
      { entityHandle: 'effortEstimate', allowRead: true },
      { entityHandle: 'effortEstimateStatus', allowRead: true },
      { entityHandle: 'company', allowRead: true },
    ]
    mocks.referenceStates.effortEstimate = {
      isLoading: false,
      entity: { handle: 'effortEstimate' },
      entityPermission: { allowUpdate: true },
      entityTemplates: [
        { name: 'title', type: 'string', options: ['isValue'] },
        {
          name: 'status',
          type: 'EffortEstimateStatusItem',
          kind: 'm:1',
          isReference: true,
          referenceName: 'effortEstimateStatus',
          options: ['isValue'],
        },
        {
          name: 'assigneeCompany',
          type: 'CompanyItem',
          kind: 'm:1',
          isReference: true,
          referenceName: 'company',
          options: ['isValue'],
        },
      ] as EntityTemplate[],
    }
    mocks.referenceStates.effortEstimateStatus = {
      entityTemplates: [
        { name: 'description', type: 'string', options: ['isValue'] },
      ] as EntityTemplate[],
    }
    mocks.referenceStates.company = {
      entityTemplates: [{ name: 'name', type: 'string', options: ['isValue'] }] as EntityTemplate[],
    }

    const { row } = createRow(
      {
        key: 'estimate',
        name: 'estimate',
        kind: 'm:1',
        referenceName: 'effortEstimate',
      } as SaplingTableHeaderItem,
      {
        handle: 5,
        title: 'Rollenbasierte Formularansichten',
        status: { handle: 'in-progress', description: 'In Bearbeitung' },
        assigneeCompany: { handle: 4, name: 'Wolf Technik AG' },
      },
    )

    expect(row.getCompactPanelTitleLines('estimate')).toEqual([
      { value: 'Rollenbasierte Formularansichten', isReference: false },
      { value: 'In Bearbeitung', isReference: true },
    ])
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
