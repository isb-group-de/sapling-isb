import { flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listTableViews: vi.fn(),
  deletePersonalTableView: vi.fn(),
  getEntityTemplate: vi.fn(),
  pushMessage: vi.fn(),
}))

vi.mock('@/services/api.form-config.service', () => ({
  default: {
    listTableViews: mocks.listTableViews,
    deletePersonalTableView: mocks.deletePersonalTableView,
  },
}))

vi.mock('@/services/api.template.service', () => ({
  default: { getEntityTemplate: mocks.getEntityTemplate },
}))

vi.mock('@/composables/system/useSaplingMessageCenter', () => ({
  useSaplingMessageCenter: () => ({ pushMessage: mocks.pushMessage }),
}))

vi.mock('@/i18n', () => ({
  i18n: { global: { t: (key: string) => key } },
}))

import { useSaplingTableFormConfig } from '../useSaplingTableFormConfig'

const personalView = {
  handle: 12,
  name: 'My view',
  entity: 'ticket',
  scope: 'person' as const,
  scopeHandle: '7',
  isActive: true,
  isDefault: false,
  version: 1,
  config: { schema: 'sapling.form-config.v1' as const, entityHandle: 'ticket' },
}

const globalView = {
  ...personalView,
  handle: 13,
  name: 'Shared view',
  scope: 'global' as const,
  scopeHandle: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getEntityTemplate.mockResolvedValue([])
  mocks.listTableViews.mockResolvedValue([personalView, globalView])
  mocks.deletePersonalTableView.mockResolvedValue(personalView)
})

describe('useSaplingTableFormConfig', () => {
  it('marks only personal views as deletable', async () => {
    const subject = useSaplingTableFormConfig(ref('ticket'), () => [])

    await subject.scheduleLoad('ticket', () => true)
    await new Promise((resolve) => setTimeout(resolve, 110))
    await flushPromises()

    expect(subject.menuItems.value).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ handle: null, canDelete: false }),
        expect.objectContaining({ handle: 12, canDelete: true }),
        expect.objectContaining({ handle: 13, canDelete: false }),
      ]),
    )
  })

  it('deletes a personal view and reloads the available views', async () => {
    const subject = useSaplingTableFormConfig(ref('ticket'), () => [])
    mocks.listTableViews.mockResolvedValueOnce([])
    await subject.deletePersonalTableView(12)

    expect(mocks.deletePersonalTableView).toHaveBeenCalledWith('ticket', 12)
    expect(subject.menuItems.value).toEqual([
      expect.objectContaining({ handle: null, canDelete: false }),
    ])
    expect(mocks.pushMessage).toHaveBeenCalledWith(
      'success',
      'formConfig.tableViewDeleted',
      'formConfig.tableViewDeletedDescription',
      'ticket',
    )
  })
})
