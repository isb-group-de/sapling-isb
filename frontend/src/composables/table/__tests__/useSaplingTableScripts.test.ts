import { reactive, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EntityItem, ScriptButtonItem } from '@/entity/entity'

const mocks = vi.hoisted(() => ({
  apiFind: vi.fn(),
  runClient: vi.fn(),
  fetchCurrentPerson: vi.fn(),
  pushMessage: vi.fn(),
  routerPush: vi.fn(),
  buildExecutionKey: vi.fn(() => 'script:1'),
  alreadyRunning: vi.fn(),
  started: vi.fn(),
  handleResult: vi.fn(),
  reload: vi.fn(),
  person: { handle: 7 },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    te: () => false,
  }),
}))

vi.mock('@/services/api.generic.service', () => ({
  default: { find: mocks.apiFind },
}))

vi.mock('@/services/api.script.service', () => ({
  default: { runClient: mocks.runClient },
}))

vi.mock('@/stores/currentPersonStore', () => ({
  useCurrentPersonStore: () => ({
    person: mocks.person,
    fetchCurrentPerson: mocks.fetchCurrentPerson,
  }),
}))

vi.mock('@/composables/system/useSaplingMessageCenter', () => ({
  useSaplingMessageCenter: () => ({ pushMessage: mocks.pushMessage }),
}))

vi.mock('@/utils/saplingScriptResultUtil', () => ({
  buildScriptButtonExecutionKey: mocks.buildExecutionKey,
  pushScriptButtonAlreadyRunningMessage: mocks.alreadyRunning,
  pushScriptButtonStartedMessage: mocks.started,
  handleScriptResultClient: mocks.handleResult,
}))

import { useSaplingTableScripts } from '../useSaplingTableScripts'

const button = {
  handle: 3,
  title: 'Escalate',
  name: 'escalate',
  parameter: null,
  isMultiSelect: true,
} as ScriptButtonItem

function createSubject(selectedItems = [{ handle: 11 }]) {
  const props = reactive({
    entityHandle: 'ticket',
    entity: {
      handle: 'ticket',
      icon: null,
      canRead: true,
      createdAt: null,
    } as EntityItem,
    scriptButtons: [button],
  })

  return useSaplingTableScripts({
    props,
    selectedItems: ref(selectedItems),
    reload: mocks.reload,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.fetchCurrentPerson.mockResolvedValue(undefined)
  mocks.runClient.mockResolvedValue({ isSuccess: true })
  mocks.handleResult.mockResolvedValue(undefined)
})

describe('useSaplingTableScripts', () => {
  it('uses supplied buttons and reloads after a successful selection script', async () => {
    const subject = createSubject()

    await subject.runSelectionScriptButton(button)

    expect(mocks.apiFind).not.toHaveBeenCalled()
    expect(mocks.runClient).toHaveBeenCalledWith(
      [{ handle: 11 }],
      expect.objectContaining({ handle: 'ticket' }),
      { handle: 7 },
      'escalate',
      null,
    )
    expect(mocks.handleResult).toHaveBeenCalledOnce()
    expect(mocks.reload).toHaveBeenCalledOnce()
  })

  it('does not execute scripts for an empty selection', async () => {
    const subject = createSubject([])

    await subject.runSelectionScriptButton(button)

    expect(mocks.runClient).not.toHaveBeenCalled()
    expect(mocks.reload).not.toHaveBeenCalled()
  })
})
