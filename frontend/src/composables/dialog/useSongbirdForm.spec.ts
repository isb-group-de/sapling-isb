import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import type { EntityItem, SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'
import type { UseSaplingDialogEditProps } from './saplingDialogEdit.types'
import type { SongbirdFormProposal } from '@/composables/system/songbirdForm.types'
import ApiGenericService from '@/services/api.generic.service'
import { useSongbirdForm } from './useSongbirdForm'
import {
  captureSongbirdForm,
  songbirdForms,
  songbirdFormProposals,
  registerSongbirdFormProposal,
  applySongbirdFormProposal,
} from '@/composables/system/songbirdFormRegistry'
import { describeSongbirdFormField, normalizeSongbirdFormValue } from './songbirdFormFields'
vi.mock('@/services/api.generic.service', () => ({
  default: { findByHandles: vi.fn(async () => []) },
}))
const cleanups: (() => void)[] = []
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup())
  vi.clearAllMocks()
  songbirdForms.clear()
  songbirdFormProposals.clear()
})
function setup() {
  const props = reactive<UseSaplingDialogEditProps>({
    modelValue: true,
    mode: 'create',
    entity: { handle: 'company' } as EntityItem,
    item: {},
    templates: [],
  })
  const form = ref<SaplingGenericItem>({ name: '', phone: '' })
  const templates = ref<EntityTemplate[]>([
    { key: 'name', name: 'name', type: 'string', nullable: false },
    { key: 'phone', name: 'phone', type: 'string' },
  ])
  const validate = vi.fn(async () => ({ valid: false }))
  const updateFormField = vi.fn((name: string, value: unknown) => {
    form.value[name] = value
  })
  let adapter!: ReturnType<typeof useSongbirdForm>
  const wrapper = mount(
    defineComponent({
      setup() {
        adapter = useSongbirdForm({
          props,
          form,
          templates,
          permissions: ref([{ entityHandle: 'company', allowInsert: true, allowUpdate: true }]),
          isLoading: ref(false),
          isSaving: ref(false),
          formRef: ref({ validate }),
          isFieldDisabled: (template) => template.formConfig?.readonly === true,
          updateFormField,
          focus: vi.fn(),
          translate: (key) => key,
        })
        return () => h('div')
      },
    }),
  )
  cleanups.push(() => wrapper.unmount())
  function proposal(): SongbirdFormProposal {
    const context = captureSongbirdForm(adapter.formId.value)!
    expect(context).not.toHaveProperty('values')
    return {
      id: crypto.randomUUID(),
      ...context,
      fields: [
        { name: 'name', label: 'Name', value: 'Example' },
        { name: 'phone', label: 'Phone', value: '123' },
      ],
    }
  }
  return { props, form, templates, validate, updateFormField, adapter, proposal, wrapper }
}
describe('Songbird form integration', () => {
  it('applies only selected fields through the existing update path and runs form validation once', async () => {
    const test = setup(),
      state = registerSongbirdFormProposal(test.proposal())
    state.selected = ['name']
    await Promise.all([applySongbirdFormProposal(state), applySongbirdFormProposal(state)])
    expect(test.form.value).toEqual({ name: 'Example', phone: '' })
    expect(test.updateFormField).toHaveBeenCalledTimes(1)
    expect(test.validate).toHaveBeenCalledTimes(1)
    expect(state.status).toBe('applied')
    expect(state.validationFailed).toBe(true)
  })
  it('preserves edits made after submission and rejects stale or closed form targets', async () => {
    const test = setup(),
      state = registerSongbirdFormProposal(test.proposal())
    test.form.value.name = 'Manual edit'
    await applySongbirdFormProposal(state)
    expect(state.error).toBe('aiChat.formChanged')
    expect(test.updateFormField).not.toHaveBeenCalled()
    test.props.modelValue = false
    await nextTick()
    test.props.modelValue = true
    await nextTick()
    await applySongbirdFormProposal(state)
    expect(state.error).toBe('aiChat.formUnavailable')
  })
  it('rechecks field permissions before applying any values', async () => {
    const test = setup(),
      state = registerSongbirdFormProposal(test.proposal())
    test.templates.value[0]!.formConfig = { readonly: true }
    await applySongbirdFormProposal(state)
    expect(state.error).toBe('aiChat.formFieldUnavailable')
    expect(test.updateFormField).not.toHaveBeenCalled()
  })
  it('keeps multiple forms isolated and never applies a dismissed proposal', async () => {
    const first = setup(),
      second = setup(),
      state = registerSongbirdFormProposal(first.proposal())
    state.status = 'rejected'
    await applySongbirdFormProposal(state)
    expect(first.updateFormField).not.toHaveBeenCalled()
    expect(second.updateFormField).not.toHaveBeenCalled()
  })
  it('excludes sensitive and derived fields and validates typed values', () => {
    expect(
      describeSongbirdFormField(
        { key: 'password', name: 'password', type: 'string', options: ['isSecurity'] },
        'Password',
      ),
    ).toBeNull()
    expect(
      describeSongbirdFormField(
        { key: 'children', name: 'children', type: 'object', kind: '1:m' },
        'Children',
      ),
    ).toBeNull()
    expect(() =>
      normalizeSongbirdFormValue(
        { name: 'date', label: 'Date', type: 'date', nullable: false },
        '2026-02-30',
      ),
    ).toThrow()
    expect(() =>
      normalizeSongbirdFormValue(
        { name: 'count', label: 'Count', type: 'number', integer: true, nullable: true },
        1.5,
      ),
    ).toThrow()
    expect(
      normalizeSongbirdFormValue(
        { name: 'flag', label: 'Flag', type: 'boolean', nullable: false },
        false,
      ),
    ).toBe(false)
  })
  it('supports saved records and normal datetime fields', async () => {
    const test = setup()
    test.props.mode = 'edit'
    test.props.item = { handle: 16 }
    test.templates.value.push({ key: 'appointment', name: 'appointment', type: 'datetime' })
    await nextTick()
    const proposal = test.proposal()
    proposal.fields = [{ name: 'appointment', label: 'Appointment', value: '2026-09-12T09:30' }]
    const state = registerSongbirdFormProposal(proposal)
    await applySongbirdFormProposal(state)
    expect(proposal.recordHandle).toBe('16')
    expect(test.form.value.appointment_date).toBe('2026-09-12')
    expect(test.form.value.appointment_time).toBe('09:30')
  })
  it('hydrates readable references and checks parent-child consistency before any update', async () => {
    const test = setup()
    test.form.value.company = { handle: 7 }
    test.templates.value.push({
      key: 'contract',
      name: 'contract',
      type: 'number',
      isReference: true,
      referenceName: 'contract',
      referenceDependency: { parentField: 'company', targetField: 'company', requireParent: true },
    })
    const proposal = test.proposal()
    proposal.fields.push({ name: 'contract', label: 'Contract', value: 22 })
    vi.mocked(ApiGenericService.findByHandles).mockResolvedValueOnce([
      { handle: 22, company: { handle: 8 } },
    ])
    const state = registerSongbirdFormProposal(proposal)
    await applySongbirdFormProposal(state)
    expect(state.error).toBe('aiChat.formReferenceUnavailable')
    expect(test.updateFormField).not.toHaveBeenCalled()
    vi.mocked(ApiGenericService.findByHandles).mockResolvedValueOnce([
      { handle: 22, company: { handle: 7 } },
    ])
    await applySongbirdFormProposal(state)
    expect(state.status).toBe('applied')
    expect(test.form.value.contract).toEqual({ handle: 22, company: { handle: 7 } })
  })
  it('does not overwrite edits made while references are loading', async () => {
    const test = setup()
    test.templates.value.push({
      key: 'country',
      name: 'country',
      type: 'string',
      isReference: true,
      referenceName: 'country',
    })
    const proposal = test.proposal()
    proposal.fields.push({ name: 'country', label: 'Country', value: 'DE' })
    let resolve!: (records: unknown[]) => void
    vi.mocked(ApiGenericService.findByHandles).mockReturnValueOnce(
      new Promise((complete) => {
        resolve = complete
      }),
    )
    const state = registerSongbirdFormProposal(proposal)
    const applying = applySongbirdFormProposal(state)
    test.form.value.phone = 'Manual'
    resolve([{ handle: 'DE' }])
    await applying
    expect(state.error).toBe('aiChat.formChanged')
    expect(test.updateFormField).not.toHaveBeenCalled()
  })
})
