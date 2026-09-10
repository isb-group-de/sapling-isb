import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import type { AccountTab, AccountTabItem } from '@/composables/account/saplingAccount.utils'
import SaplingAccount from '../SaplingAccount.vue'

const account = vi.hoisted(() => ({ state: {} as Record<string, unknown> }))

vi.mock('@/composables/account/useSaplingAccount', () => ({
  useSaplingAccount: () => account.state,
}))
vi.mock('vue-router', () => ({ useRouter: () => ({}) }))

describe('account tab selection', () => {
  const activeAccountTab = ref<AccountTab>('profile')
  const accountTabs = ref<AccountTabItem[]>([])
  let wrapper: ReturnType<typeof shallowMount> | undefined

  beforeEach(() => {
    activeAccountTab.value = 'profile'
    accountTabs.value = ['profile', 'emailSignatures', 'security'].map((key) => ({
      key: key as AccountTab,
      icon: '',
      label: key,
    }))
    account.state = { dialog: false, activeAccountTab, accountTabs }
  })

  afterEach(() => wrapper?.unmount())

  it('preserves the selected signature tab when late translations refresh the tab list', async () => {
    wrapper = shallowMount(SaplingAccount)
    activeAccountTab.value = 'emailSignatures'
    await nextTick()

    accountTabs.value = accountTabs.value.map((tab) => ({ ...tab, label: `translated ${tab.key}` }))
    await nextTick()

    expect(activeAccountTab.value).toBe('emailSignatures')
  })

  it('applies explicit initial-tab changes', async () => {
    wrapper = shallowMount(SaplingAccount, { props: { initialTab: 'emailSignatures' } })
    expect(activeAccountTab.value).toBe('emailSignatures')

    await wrapper.setProps({ initialTab: 'security' })
    expect(activeAccountTab.value).toBe('security')
  })

  it('falls back to profile when the selected tab becomes unavailable', async () => {
    wrapper = shallowMount(SaplingAccount, { props: { initialTab: 'security' } })
    accountTabs.value = accountTabs.value.filter((tab) => tab.key !== 'security')
    await nextTick()

    expect(activeAccountTab.value).toBe('profile')
  })

  it('falls back to profile for an unavailable initial tab', () => {
    accountTabs.value = accountTabs.value.filter((tab) => tab.key !== 'security')
    wrapper = shallowMount(SaplingAccount, { props: { initialTab: 'security' } })

    expect(activeAccountTab.value).toBe('profile')
  })
})
