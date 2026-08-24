import { shallowMount } from '@vue/test-utils'
import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import SaplingHeader from '../SaplingHeader.vue'

const harness = vi.hoisted(() => ({
  goHome: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ name: 'home', path: '/' }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/i18n', () => ({
  i18n: { global: { t: (key: string) => key } },
}))

vi.mock('@/composables/system/useSaplingHeader', () => ({
  useSaplingHeader: () => ({
    showInbox: ref(false),
    showAccount: ref(false),
    inboxCount: ref(0),
    inboxBadgeColor: ref('primary'),
    incomingInboxPreview: ref(null),
    currentPersonStore: {
      person: null,
      isImpersonating: false,
      impersonator: null,
      stopImpersonation: vi.fn(),
    },
    openInbox: vi.fn(),
    closeInbox: vi.fn(),
    openAccount: vi.fn(),
    closeAccount: vi.fn(),
    goHome: harness.goHome,
  }),
}))

vi.mock('@/composables/system/useSaplingHeaderInboxPreview', () => ({
  useSaplingHeaderInboxPreview: () => ({
    visibleIncomingInboxPreview: ref(null),
    openIncomingInboxPreview: vi.fn(),
  }),
}))

vi.mock('@/composables/system/useSaplingMessageCenter', () => ({
  useSaplingMessageCenter: () => ({
    messages: ref([]),
    getMessageColor: vi.fn(() => 'primary'),
    openDialog: vi.fn(),
  }),
}))

vi.mock('@/composables/system/useSaplingPreferences', () => ({
  useSaplingPreferences: () => ({
    currentLanguage: ref('de'),
    languageOptions: ref([]),
    issueAction: ref(null),
    appearanceActions: ref([]),
    setLanguage: vi.fn(),
  }),
}))

vi.mock('@/composables/system/useSaplingHelp', () => ({
  useSaplingHelp: () => ({ openSaplingHelp: vi.fn() }),
}))

vi.mock('@/composables/system/useSaplingVectorization', () => ({
  useSaplingVectorization: () => ({ toggleSaplingVectorization: vi.fn() }),
}))

vi.mock('@/composables/system/useSaplingSearchIndexRebuild', () => ({
  useSaplingSearchIndexRebuild: () => ({ openSaplingSearchIndexRebuild: vi.fn() }),
}))

vi.mock('@/composables/knowledge/useSaplingContextHelp', () => ({
  openContextHelpArticle: vi.fn(),
  resolveRouteContextHelpKey: vi.fn(),
}))

vi.mock('@/services/command-palette.service', () => ({
  openSaplingCommandPalette: vi.fn(),
}))

describe('SaplingHeader home navigation', () => {
  it('renders an explicit accessible home action and navigates home', async () => {
    const wrapper = shallowMount(SaplingHeader, {
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: {
          VAppBar: {
            template: '<header><slot name="prepend" /><slot /><slot name="append" /></header>',
          },
          VAppBarTitle: { template: '<div><slot /></div>' },
          VAppBarNavIcon: { template: '<button />' },
          SaplingHeaderPrimaryActions: {
            props: ['homeLabel'],
            emits: ['openHome'],
            template:
              '<button data-tutorial="header-home" :aria-label="homeLabel" :title="homeLabel" @click="$emit(\'openHome\')">Sapling</button>',
          },
        },
      },
    })

    const home = wrapper.get('[data-tutorial="header-home"]')
    expect(home.text()).toContain('Sapling')
    expect(home.attributes('aria-label')).toBe('global.backToHome')
    expect(home.attributes('title')).toBe('global.backToHome')

    await home.trigger('click')
    expect(harness.goHome).toHaveBeenCalledOnce()
  })
})
