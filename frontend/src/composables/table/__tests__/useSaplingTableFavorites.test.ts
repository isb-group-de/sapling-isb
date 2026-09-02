import { flushPromises } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EntityItem, FavoriteItem } from '@/entity/entity'

const mocks = vi.hoisted(() => ({
  apiFind: vi.fn(),
  apiCreate: vi.fn(),
  apiDelete: vi.fn(),
  fetchCurrentPerson: vi.fn(),
  routerPush: vi.fn(),
  pushMessage: vi.fn(),
  route: { path: '/table/ticket', fullPath: '/table/ticket' },
  person: { handle: 7 } as { handle: number } | null,
}))

vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ push: mocks.routerPush }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => (key === 'navigation.ticket' ? 'Tickets' : key),
  }),
}))

vi.mock('@/services/api.generic.service', () => ({
  default: {
    findAll: mocks.apiFind,
    create: mocks.apiCreate,
    delete: mocks.apiDelete,
  },
}))

vi.mock('@/stores/currentPersonStore', () => ({
  useCurrentPersonStore: () => ({
    get person() {
      return mocks.person
    },
    fetchCurrentPerson: mocks.fetchCurrentPerson,
  }),
}))

vi.mock('@/composables/system/useSaplingMessageCenter', () => ({
  useSaplingMessageCenter: () => ({ pushMessage: mocks.pushMessage }),
}))

import { useSaplingTableFavorites } from '../useSaplingTableFavorites'

const favorite: FavoriteItem = {
  handle: 12,
  title: 'Open tickets',
  person: 7,
  entity: 'ticket',
  createdAt: null,
}

function createEntity(): EntityItem {
  return {
    handle: 'ticket',
    title: 'Ticket',
    icon: null,
    canRead: true,
    createdAt: null,
    routes: [
      {
        handle: 17,
        route: 'table/ticket',
        navigation: null,
        createdAt: null,
      },
      {
        handle: 18,
        route: 'partner/ticket',
        navigation: null,
        createdAt: null,
      },
    ],
  }
}

function createSubject() {
  const props = reactive({
    search: ' open ',
    sortBy: [{ key: 'title', order: 'asc' as const }],
    entityHandle: 'ticket',
    entity: createEntity(),
    entityTemplates: [],
    parentFilter: undefined,
  })

  return {
    props,
    subject: useSaplingTableFavorites({
      props,
      localColumnFilters: ref({}),
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.person = { handle: 7 }
  mocks.route.path = '/table/ticket'
  mocks.route.fullPath = '/table/ticket'
  mocks.apiFind.mockResolvedValue([favorite])
  mocks.apiCreate.mockResolvedValue(favorite)
  mocks.apiDelete.mockResolvedValue(undefined)
  mocks.fetchCurrentPerson.mockResolvedValue(undefined)
  mocks.routerPush.mockResolvedValue(undefined)
})

describe('useSaplingTableFavorites', () => {
  it('loads the current entity favorites and marks the matching route active', async () => {
    const { subject } = createSubject()
    await flushPromises()

    expect(mocks.apiFind).toHaveBeenCalledWith(
      'favorite',
      expect.objectContaining({
        filter: {
          person: { handle: 7 },
          entity: { handle: 'ticket' },
        },
      }),
    )
    expect(subject.currentEntityFavorites.value).toEqual([favorite])
    expect(subject.activeFavoriteHandle.value).toBe(12)

    await subject.selectFavorite(favorite)
    expect(mocks.routerPush).toHaveBeenCalledWith('/table/ticket')
  })

  it('persists the current table search, sorting, and configured route', async () => {
    const { subject } = createSubject()
    await flushPromises()

    subject.openFavoriteDialog()
    expect(subject.favoriteDialog.value.title).toBe('Tickets: open')
    subject.favoriteDialog.value.title = '  My worklist  '

    await subject.saveFavorite()

    expect(mocks.apiCreate).toHaveBeenCalledWith('favorite', {
      title: 'My worklist',
      entity: 'ticket',
      entityRoute: 17,
      person: 7,
      search: 'open',
      sortBy: [{ key: 'title', order: 'asc' }],
      filter: undefined,
    })
    expect(subject.favoriteDialog.value).toEqual({ visible: false, title: '' })
    expect(mocks.pushMessage).toHaveBeenCalledWith(
      'success',
      'global.favoriteSaved',
      'global.favoriteSavedDescription',
      'ticket',
    )
  })

  it('persists the partner route when the worklist is created in the partner view', async () => {
    mocks.route.path = '/partner/ticket'
    mocks.route.fullPath = '/partner/ticket'
    const { subject } = createSubject()
    await flushPromises()

    subject.openFavoriteDialog()
    subject.favoriteDialog.value.title = 'Partner tickets'

    await subject.saveFavorite()

    expect(mocks.apiCreate).toHaveBeenCalledWith(
      'favorite',
      expect.objectContaining({
        title: 'Partner tickets',
        entity: 'ticket',
        entityRoute: 18,
      }),
    )
  })

  it('deletes a personal worklist and refreshes the toolbar list', async () => {
    const { subject } = createSubject()
    await flushPromises()
    mocks.apiFind.mockResolvedValueOnce([])

    await subject.deleteFavorite(favorite)

    expect(mocks.apiDelete).toHaveBeenCalledWith('favorite', 12, { ignoreNotFound: true })
    expect(subject.currentEntityFavorites.value).toEqual([])
    expect(mocks.pushMessage).toHaveBeenCalledWith(
      'success',
      'global.favoriteDeleted',
      'global.favoriteDeletedDescription',
      'ticket',
    )
  })
})
