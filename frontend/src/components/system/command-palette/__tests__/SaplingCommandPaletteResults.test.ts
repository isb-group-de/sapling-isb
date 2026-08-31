import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import SaplingCommandPaletteResults from '../SaplingCommandPaletteResults.vue'
import type { CommandPaletteItem } from '../commandPalette.types'

function createItem(overrides: Partial<CommandPaletteItem> = {}): CommandPaletteItem {
  return {
    id: 'target',
    group: 'entity',
    label: 'Ziel',
    icon: 'mdi-link',
    haystack: 'ziel',
    path: '/target',
    flatIndex: 0,
    ...overrides,
  }
}

async function mountResults(items: CommandPaletteItem[]) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/target', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  await router.isReady()

  const wrapper = mount(SaplingCommandPaletteResults, {
    props: {
      isLoading: false,
      groupedResults: [{ key: 'entity', label: 'Entitäten', items }],
      activeIndex: 0,
      emptyLabel: 'Keine Ergebnisse',
    },
    global: {
      plugins: [router],
      stubs: {
        VIcon: true,
        VDivider: true,
      },
    },
  })

  return { wrapper, router }
}

describe('SaplingCommandPaletteResults', () => {
  it('renders route results as native router links', async () => {
    const { wrapper } = await mountResults([createItem()])
    const link = wrapper.get('a.sapling-command-palette__item')

    expect(link.attributes('href')).toBe('/target')
    expect(link.attributes('target')).toBeUndefined()
  })

  it('leaves modified clicks to the browser instead of routing the current tab', async () => {
    const { wrapper, router } = await mountResults([createItem()])

    await wrapper.get('a.sapling-command-palette__item').trigger('click', { ctrlKey: true })

    expect(router.currentRoute.value.path).toBe('/')
    expect(wrapper.emitted('routeItemSelected')).toHaveLength(1)
  })

  it('keeps command actions as buttons', async () => {
    const action = createItem({ id: 'action', group: 'action', path: '', run: () => undefined })
    const { wrapper } = await mountResults([action])

    expect(wrapper.find('a.sapling-command-palette__item').exists()).toBe(false)
    await wrapper.get('button.sapling-command-palette__item').trigger('click')
    expect(wrapper.emitted('selectItem')).toHaveLength(1)
  })
})
