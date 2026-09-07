import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
const mocks = vi.hoisted(() => ({
  findAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  saveSettings: vi.fn(),
  impersonating: false,
}))
vi.mock('@/services/api.generic.service', () => ({ default: mocks }))
vi.mock('@/services/api.mail-signature.service', () => ({
  loadMailSignatureSettings: async () => ({ signatureRotation: true, defaultSignatureHandle: 12 }),
  saveMailSignatureSettings: mocks.saveSettings,
}))
vi.mock('@/stores/currentPermissionStore', () => ({
  useCurrentPermissionStore: () => ({
    accumulatedPermission: [
      {
        entityHandle: 'emailSignature',
        allowRead: true,
        allowInsert: true,
        allowUpdate: true,
        allowDelete: true,
      },
    ],
    fetchCurrentPermission: async () => {},
  }),
}))
vi.mock('@/stores/currentPersonStore', () => ({
  useCurrentPersonStore: () => ({ isImpersonating: mocks.impersonating }),
}))
vi.mock('@/composables/generic/useTranslationLoader', () => ({ useTranslationLoader: () => ({}) }))
vi.mock('@/composables/system/useSaplingMessageCenter', () => ({
  useSaplingMessageCenter: () => ({ pushMessage: vi.fn() }),
}))
import SaplingAccountEmailSignatures from '../SaplingAccountEmailSignatures.vue'
import SaplingTextField from '@/components/common/SaplingTextField.vue'
import SaplingFieldMarkdown from '@/components/dialog/fields/SaplingFieldMarkdown.vue'
import SaplingMailSignatureSelection from '@/components/dialog/mail/SaplingMailSignatureSelection.vue'

function mountPanel() {
  return shallowMount(SaplingAccountEmailSignatures, {
    global: {
      mocks: { $t: (key: string) => key },
      renderStubDefaultSlot: true,
      stubs: {
        VBtn: { template: '<button><slot /></button>' },
        VForm: { template: '<form><slot /></form>' },
        VTable: { template: '<table><slot /></table>' },
        VProgressLinear: true,
      },
    },
  })
}

describe('profile email signatures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.impersonating = false
    mocks.findAll.mockResolvedValue([
      {
        handle: 12,
        name: 'Bonn',
        bodyMarkdown: 'Grüße aus Bonn',
        isActive: true,
        useInRotation: true,
      },
    ])
    mocks.create.mockResolvedValue({ handle: 13 })
    mocks.saveSettings.mockImplementation(async (settings) => settings)
  })

  it('creates a personal signature through generic CRUD without sending an owner or system fields', async () => {
    const wrapper = mountPanel()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'mail.addSignature')!
      .trigger('click')
    ;(wrapper.findComponent(SaplingTextField) as any).vm.$emit('update:modelValue', 'Persönlich')
    ;(wrapper.findComponent(SaplingFieldMarkdown) as any).vm.$emit(
      'update:modelValue',
      'Beste Grüße',
    )
    await flushPromises()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.create).toHaveBeenCalledWith('emailSignature', {
      name: 'Persönlich',
      bodyMarkdown: 'Beste Grüße',
      isActive: true,
      useInRotation: true,
    })
    expect(wrapper.find('form').exists()).toBe(false)
    wrapper.unmount()
  })

  it('saves fixed mode and its default independently of editing signatures', async () => {
    const wrapper = mountPanel()
    await flushPromises()
    wrapper.findComponent(SaplingMailSignatureSelection).vm.$emit('update:rotation', false)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'mail.saveSignatureSettings')!
      .trigger('click')
    await flushPromises()
    expect(mocks.saveSettings).toHaveBeenCalledWith({
      signatureRotation: false,
      defaultSignatureHandle: 12,
    })
    wrapper.unmount()
  })

  it('hides mutation actions while impersonating another user', async () => {
    mocks.impersonating = true
    const wrapper = mountPanel()
    await flushPromises()
    expect(wrapper.text()).not.toContain('mail.addSignature')
    expect(wrapper.text()).not.toContain('mail.editSignature')
    wrapper.unmount()
  })
})
