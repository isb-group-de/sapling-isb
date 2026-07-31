import { nextTick, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import type { EditDialogOptions } from '@/entity/structure'
import { useSaplingTableRouteDialogSync } from '../useSaplingTableRouteDialogSync'

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/table/:entity', name: 'table', component: { template: '<div />' } },
      { path: '/partner/:entity', name: 'partner', component: { template: '<div />' } },
      { path: '/event', name: 'calendar', component: { template: '<div />' } },
    ],
  })
}

async function flushRouteSync(): Promise<void> {
  await nextTick()
  await flushPromises()
}

describe('useSaplingTableRouteDialogSync', () => {
  it.each([
    {
      surface: 'generic table',
      path: '/table/company',
      query: { filter: JSON.stringify({ isActive: true }), open: '17' },
    },
    { surface: 'partner table', path: '/partner/ticket', query: { open: '19' } },
    { surface: 'calendar', path: '/event', query: { open: '958' } },
  ])(
    'keeps the $surface parent route unchanged when an embedded relation table opens a record',
    async ({ path, query }) => {
      const router = createTestRouter()
      await router.push({ path, query })
      const editDialog = ref<EditDialogOptions>({ visible: false, mode: 'edit', item: null })

      useSaplingTableRouteDialogSync({
        enabled: () => false,
        editDialog,
        router,
        getRoute: () => router.currentRoute.value,
      })

      editDialog.value = { visible: true, mode: 'edit', item: { handle: 29 } }
      await flushRouteSync()

      expect(router.currentRoute.value.path).toBe(path)
      expect(router.currentRoute.value.query).toEqual(query)
    },
  )

  it.each([
    { surface: 'generic table', path: '/table/company' },
    { surface: 'partner table', path: '/partner/ticket' },
  ])('writes and clears the open handle for the primary $surface', async ({ path }) => {
    const router = createTestRouter()
    await router.push({ path, query: { filter: JSON.stringify({ isActive: true }) } })
    const editDialog = ref<EditDialogOptions>({ visible: false, mode: 'edit', item: null })

    useSaplingTableRouteDialogSync({
      enabled: () => true,
      editDialog,
      router,
      getRoute: () => router.currentRoute.value,
    })

    editDialog.value = { visible: true, mode: 'edit', item: { handle: 29 } }
    await flushRouteSync()

    expect(router.currentRoute.value.query).toEqual({
      filter: JSON.stringify({ isActive: true }),
      open: '29',
    })

    editDialog.value = { ...editDialog.value, visible: false }
    await flushRouteSync()

    expect(router.currentRoute.value.query).toEqual({
      filter: JSON.stringify({ isActive: true }),
    })
  })
})
