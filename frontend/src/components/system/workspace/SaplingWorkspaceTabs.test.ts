import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView, useRoute, useRouter } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { createPinia } from 'pinia'
import SaplingWorkspaceTabs from './SaplingWorkspaceTabs.vue'
import {
  useWorkspaceDirty,
  useWorkspaceLabel,
  useWorkspaceTab,
} from '@/composables/system/workspaceTabContext'
import {
  hasSongbirdGlobalRecordDialog,
  useSongbirdPageContext,
  useSongbirdRecordContext,
} from '@/composables/system/songbirdPageContext'
import { replaceSaplingTableUrlState } from '@/composables/table/saplingTableRouteState'
import { useTablePreferences } from '@/composables/table/saplingTablePreferences'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import {
  writeSaplingDialogDraft,
  readSaplingDialogDraft,
} from '@/composables/dialog/saplingDialogDraftStorage'

const states = new Map<string, ReturnType<typeof setupPage>>()
function setupPage() {
  const route = useRoute()
  const router = useRouter()
  const tab = useWorkspaceTab()!
  const draft = ref('')
  const pageLabel = ref('')
  useWorkspaceLabel(() => pageLabel.value)
  const preferences = useTablePreferences(computed(() => String(route.params.entity)))
  useWorkspaceDirty(() => Boolean(draft.value))
  useSongbirdRecordContext(() => ({
    entityHandle: String(route.params.entity),
    recordHandle: String(route.query.open ?? tab.id),
    label: route.query.open ? 'Bauer IT Solutions' : tab.id,
  }))
  function filter(search: string) {
    replaceSaplingTableUrlState(
      { search, page: 1, itemsPerPage: 20, defaultItemsPerPage: 20, sortBy: [], filter: null },
      true,
      tab,
    )
  }
  return { route, router, tab, draft, filter, preferences, pageLabel }
}
const Page = defineComponent({
  setup() {
    const state = setupPage()
    states.set(state.tab.id, state)
    return () =>
      h('div', { class: 'test-page' }, [
        h('span', { class: 'entity' }, String(state.route.params.entity ?? 'home')),
        h('input', {
          value: state.draft.value,
          onInput: (event: Event) => {
            state.draft.value = (event.target as HTMLInputElement).value
          },
        }),
      ])
  },
})

let wrapper: VueWrapper | undefined
async function start(path = '/table/company') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/',
        component: SaplingWorkspaceTabs,
        children: [
          { path: '', name: 'home', component: Page },
          { path: 'event', name: 'calendar', component: Page },
          { path: 'table/:entity', name: 'table', component: Page },
        ],
      },
    ],
  })
  const pinia = createPinia()
  useCurrentPersonStore(pinia).person = { handle: 9 } as never
  await router.push(path)
  await router.isReady()
  wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
    global: {
      plugins: [
        router,
        pinia,
        createI18n({
          legacy: false,
          locale: 'de',
          messages: { de: { navigation: { company: 'Kunden', ticket: 'Tickets' } } },
        }),
      ],
      stubs: {
        VIcon: true,
        VBtn: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
        VSkeletonLoader: true,
      },
    },
  })
  await flushPromises()
  return router
}
beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  states.clear()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
})

describe('application workspace tabs', () => {
  it('confirms discarding stored drafts even before a restored pane has mounted', async () => {
    const router = await start('/table/company?open=42')
    const context = {
      route: router.currentRoute.value.fullPath,
      personHandle: '9',
      entityHandle: 'company',
      mode: 'edit',
      recordHandle: '42',
      recordVersion: 'v1',
      parentEntityHandle: '',
      parentRecordHandle: '',
      detailHandle: '',
      detailVersion: '',
    }
    writeSaplingDialogDraft('edit', context, { title: 'Recovered draft' })
    await router.push('/table/ticket')
    await flushPromises()
    const path = router.currentRoute.value.fullPath
    wrapper!.unmount()
    states.clear()
    await start(path)
    expect(states.size).toBe(1)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await wrapper!.get('[aria-label="Tab schließen: Kunden"]').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledOnce()
    expect(readSaplingDialogDraft('edit', context)).toEqual({ title: 'Recovered draft' })
    confirm.mockReturnValue(true)
    await wrapper!.get('[aria-label="Tab schließen: Kunden"]').trigger('click')
    await flushPromises()
    expect(wrapper!.findAll('[role="tab"]')).toHaveLength(1)
    expect(readSaplingDialogDraft('edit', context)).toBeNull()
  })
  it('follows dashboard selection and retains its title while a calendar tab changes its range', async () => {
    const router = await start('/')
    const home = states.get(String(router.currentRoute.value.query.workspaceTab))!
    home.pageLabel.value = 'Support Operations'
    await flushPromises()
    expect(wrapper!.get('[role="tab"][aria-selected="true"]').text()).toBe('Support Operations')
    home.pageLabel.value = 'Sales Pipeline'
    await router.push('/event')
    await flushPromises()
    const calendar = states.get(String(router.currentRoute.value.query.workspaceTab))!
    calendar.pageLabel.value = '13.07.2026 – 19.07.2026'
    await flushPromises()
    expect(wrapper!.findAll('[role="tab"]')[0]!.text()).toBe('Sales Pipeline')
    expect(wrapper!.get('[role="tab"][aria-selected="true"]').text()).toBe(
      'Calendar · 13.07.2026 – 19.07.2026',
    )
    calendar.pageLabel.value = '15.07.2026'
    await flushPromises()
    expect(wrapper!.get('[role="tab"][aria-selected="true"]').text()).toBe('Calendar · 15.07.2026')
  })
  it('retains the saved record label in inactive tabs and ignores unrelated nested records', async () => {
    const router = await start('/table/company?open=4')
    const first = states.get(String(router.currentRoute.value.query.workspaceTab))!
    expect(wrapper!.get('[role="tab"][aria-selected="true"]').text()).toBe(
      'Kunden · Bauer IT Solutions',
    )
    first.tab.setRecordLabel(Symbol('nested'), {
      entityHandle: 'person',
      recordHandle: '4',
      label: 'Other record',
    })
    await router.push('/table/ticket')
    await flushPromises()
    expect(wrapper!.findAll('[role="tab"]')[0]!.text()).toBe('Kunden · Bauer IT Solutions')
    await first.router.replace({ query: { ...first.route.query, open: undefined } })
    await flushPromises()
    expect(wrapper!.findAll('[role="tab"]')[0]!.text()).toBe('Kunden')
  })
  it('retains drafts and isolates route params, filters and grouping across duplicate entity panes', async () => {
    const router = await start()
    const firstId = String(router.currentRoute.value.query.workspaceTab)
    const first = states.get(firstId)!
    first.draft.value = 'Unsaved customer'
    first.filter('Berlin')
    await flushPromises()
    await router.push('/table/ticket')
    await flushPromises()
    expect(states.size).toBe(2)
    expect(first.route.params.entity).toBe('company')
    expect(first.route.query.search).toBe('Berlin')
    expect(first.tab.active).toBe(false)
    await wrapper!.findAll('[role="tab"]')[0]!.trigger('click')
    await flushPromises()
    expect(first.draft.value).toBe('Unsaved customer')
    expect(router.currentRoute.value.query.search).toBe('Berlin')
    await wrapper!.get('[aria-label="Ansicht in neuem Tab öffnen"]').trigger('click')
    await flushPromises()
    const second = states.get(String(router.currentRoute.value.query.workspaceTab))!
    expect(second.tab.id).not.toBe(firstId)
    expect(second.draft.value).toBe('')
    second.filter('Hamburg')
    second.preferences.value = { rowDeadlineFields: [], showGrouping: true, groupField: 'status' }
    await flushPromises()
    expect(first.route.query.search).toBe('Berlin')
    expect(second.route.query.search).toBe('Hamburg')
    expect(first.preferences.value.showGrouping).toBe(false)
  })

  it('does not let an inactive pane overwrite the address bar or Songbird context', async () => {
    const router = await start()
    const first = states.get(String(router.currentRoute.value.query.workspaceTab))!
    const pageContext = useSongbirdPageContext(router.currentRoute.value)
    await router.push('/table/ticket')
    await flushPromises()
    const activeId = String(router.currentRoute.value.query.workspaceTab)
    first.filter('Background filter')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/table/ticket')
    expect(router.currentRoute.value.query.search).toBeUndefined()
    expect(pageContext.value.recordHandle).toBe(activeId)
    expect(hasSongbirdGlobalRecordDialog.value).toBe(false)
    expect(first.route.query.search).toBe('Background filter')
  })

  it('keeps dirty tabs when closing is declined and removes them after confirmation', async () => {
    const router = await start()
    const first = states.get(String(router.currentRoute.value.query.workspaceTab))!
    first.draft.value = 'Draft'
    await flushPromises()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const discardDraft = vi.fn()
    first.tab.setDraftCleanup(Symbol('test-draft'), discardDraft)
    await wrapper!.get('[aria-label="Tab schließen: Kunden"]').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledOnce()
    expect(discardDraft).not.toHaveBeenCalled()
    expect(wrapper!.findAll('[role="tab"]')).toHaveLength(1)
    expect(first.tab.active).toBe(true)
    confirm.mockReturnValue(true)
    await wrapper!.get('[aria-label="Tab schließen: Kunden"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
    expect(discardDraft).toHaveBeenCalledOnce()
    expect(wrapper!.findAll('[role="tab"]')).toHaveLength(1)
    expect(wrapper!.findAll('.entity').map((item) => item.text())).toEqual(['home'])
  })

  it('uses back navigation to select an existing tab without creating a duplicate', async () => {
    const router = await start()
    const firstId = router.currentRoute.value.query.workspaceTab
    await router.push('/table/ticket')
    await flushPromises()
    router.back()
    await flushPromises()
    expect(router.currentRoute.value.query.workspaceTab).toBe(firstId)
    expect(wrapper!.findAll('[role="tab"]')).toHaveLength(2)
  })

  it('restores tab URLs lazily and resets mounted workspaces on a person change', async () => {
    const router = await start()
    const first = states.get(String(router.currentRoute.value.query.workspaceTab))!
    first.filter('Berlin')
    await flushPromises()
    await router.push('/table/ticket')
    await flushPromises()
    const path = router.currentRoute.value.fullPath
    wrapper!.unmount()
    states.clear()
    const restoredRouter = await start(path)
    expect(wrapper!.findAll('[role="tab"]')).toHaveLength(2)
    expect(states.size).toBe(1)
    await wrapper!.findAll('[role="tab"]')[0]!.trigger('click')
    await flushPromises()
    expect(restoredRouter.currentRoute.value.query.search).toBe('Berlin')
    const previousId = String(restoredRouter.currentRoute.value.query.workspaceTab)
    states.get(previousId)!.draft.value = 'Previous person draft'
    useCurrentPersonStore().person = { handle: 10 } as never
    await flushPromises()
    expect(wrapper!.findAll('[role="tab"]')).toHaveLength(1)
    const nextId = String(restoredRouter.currentRoute.value.query.workspaceTab)
    expect(nextId).not.toBe(previousId)
    expect(states.get(nextId)!.draft.value).toBe('')
  })
})
