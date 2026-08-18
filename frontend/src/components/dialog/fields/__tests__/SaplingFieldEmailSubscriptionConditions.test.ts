import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EntityTemplate } from '@/entity/structure'

const { loadGenericMock } = vi.hoisted(() => ({
  loadGenericMock: vi.fn(),
}))

const entityTemplatesByHandle: Record<string, EntityTemplate[]> = {
  ticket: [
    createTemplate({ name: 'title', type: 'string' }),
    createTemplate({ name: 'solutionDescription', type: 'string' }),
    createTemplate({
      name: 'customFields.serviceLevel',
      type: 'string',
      formConfig: { label: 'Service level' },
      customField: {
        key: 'serviceLevel',
        type: 'select',
        options: [
          { label: 'Silver', value: 'silver' },
          { label: 'Gold', value: 'gold' },
        ],
      },
    }),
    createTemplate({
      name: 'status',
      type: 'TicketStatusItem',
      kind: 'm:1',
      isReference: true,
      referenceName: 'ticketStatus',
    }),
    createTemplate({
      name: 'updatedAt',
      type: 'datetime',
      options: ['isSystem'],
    }),
    createTemplate({
      name: 'attachments',
      type: 'DocumentItem',
      kind: 'm:n',
      isReference: true,
      referenceName: 'document',
    }),
  ],
  ticketStatus: [
    createTemplate({ name: 'handle', type: 'string', options: ['isValue'] }),
    createTemplate({ name: 'title', type: 'string', options: ['isValue'] }),
  ],
}

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          'emailSubscriptionCondition.observedField': 'Observed field',
          'emailSubscriptionCondition.oldValue': 'Old value',
          'emailSubscriptionCondition.newValue': 'New value',
          'emailSubscriptionCondition.addCondition': 'Add condition',
          'emailSubscriptionCondition.removeCondition': 'Remove condition',
          'ticket.title': 'Title',
          'ticket.solutionDescription': 'Solution',
          'ticket.status': 'Status',
        }) as Record<string, string>
      )[key] ?? key,
    te: (key: string) =>
      [
        'ticket.title',
        'ticket.solutionDescription',
        'ticket.status',
        'emailSubscriptionCondition.observedField',
        'emailSubscriptionCondition.oldValue',
        'emailSubscriptionCondition.newValue',
      ].includes(key),
  }),
}))

vi.mock('@/stores/genericStore', () => ({
  useGenericStore: () => ({
    getState: (entityHandle: string) => ({
      entityTemplates: entityTemplatesByHandle[entityHandle] ?? [],
    }),
    loadGeneric: loadGenericMock,
  }),
}))

vi.mock('@/services/api.generic.service', () => ({
  default: {
    findAll: vi.fn().mockResolvedValue([
      { handle: 'open', title: 'Open' },
      { handle: 'closed', title: 'Closed' },
    ]),
  },
}))

import SaplingFieldEmailSubscriptionConditions from '../SaplingFieldEmailSubscriptionConditions.vue'

const VSelectStub = defineComponent({
  name: 'v-select',
  props: {
    items: {
      type: Array,
      default: () => [],
    },
    modelValue: {
      type: String,
      default: '',
    },
  },
  emits: ['update:modelValue'],
  template: '<select />',
})

const VTextFieldStub = defineComponent({
  name: 'v-text-field',
  props: {
    modelValue: {
      type: String,
      default: '',
    },
  },
  emits: ['update:modelValue'],
  template: '<input />',
})

const VBtnStub = defineComponent({
  name: 'v-btn',
  emits: ['click'],
  template: '<button @click="$emit(\'click\')"><slot /></button>',
})

describe('SaplingFieldEmailSubscriptionConditions', () => {
  beforeEach(() => {
    loadGenericMock.mockReset()
    loadGenericMock.mockResolvedValue(undefined)
  })

  it('offers editable non-system fields from the selected entity', async () => {
    const wrapper = mount(SaplingFieldEmailSubscriptionConditions, {
      props: {
        sourceEntityReference: { handle: 'ticket' },
        modelValue: [{ observedField: 'status', newValue: 'closed' }],
      },
      global: {
        stubs: {
          'v-select': VSelectStub,
          'v-text-field': VTextFieldStub,
          'v-btn': VBtnStub,
        },
      },
    })

    await flushPromises()

    expect(loadGenericMock).toHaveBeenCalledWith('ticket', 'global')
    expect(wrapper.findAllComponents(VSelectStub)[0].props('items')).toEqual([
      { label: 'Service level', value: 'customFields.serviceLevel' },
      { label: 'Solution', value: 'solutionDescription' },
      { label: 'Status', value: 'status' },
      { label: 'Title', value: 'title' },
    ])
  })

  it('uses configured options for custom select fields', async () => {
    const wrapper = mount(SaplingFieldEmailSubscriptionConditions, {
      props: {
        sourceEntityReference: { handle: 'ticket' },
        modelValue: [{ observedField: 'customFields.serviceLevel', newValue: 'gold' }],
      },
      global: {
        stubs: {
          'v-select': VSelectStub,
          'v-text-field': VTextFieldStub,
          'v-btn': VBtnStub,
        },
      },
    })

    await flushPromises()

    const selects = wrapper.findAllComponents(VSelectStub)
    expect(selects[1].props('items')).toEqual([
      { label: 'Silver', value: 'silver' },
      { label: 'Gold', value: 'gold' },
    ])
    expect(selects[2].props('items')).toEqual(selects[1].props('items'))
  })

  it('emits multiple configured conditions', async () => {
    const wrapper = mount(SaplingFieldEmailSubscriptionConditions, {
      props: {
        sourceEntityReference: { handle: 'ticket' },
        modelValue: [{ observedField: 'status', newValue: 'closed' }],
      },
      global: {
        stubs: {
          'v-select': VSelectStub,
          'v-text-field': VTextFieldStub,
          'v-btn': VBtnStub,
        },
      },
    })

    await flushPromises()

    const buttons = wrapper.findAllComponents(VBtnStub)
    await buttons[buttons.length - 1].trigger('click')
    const selects = wrapper.findAllComponents(VSelectStub)
    await selects[3].vm.$emit('update:modelValue', 'solutionDescription')

    const emittedUpdates = wrapper.emitted('update:modelValue') ?? []
    expect(emittedUpdates[emittedUpdates.length - 1]?.[0]).toEqual([
      { observedField: 'status', oldValue: null, newValue: 'closed', sortOrder: 0 },
      { observedField: 'solutionDescription', oldValue: null, newValue: null, sortOrder: 1 },
    ])
  })
})

function createTemplate(
  overrides: Partial<EntityTemplate> & Pick<EntityTemplate, 'name' | 'type'>,
): EntityTemplate {
  return {
    ...overrides,
    key: overrides.name,
    name: overrides.name,
    type: overrides.type,
    kind: overrides.kind ?? null,
    referenceName: overrides.referenceName,
    isReference: overrides.isReference ?? false,
    isPersistent: true,
    isAutoIncrement: false,
    isPrimaryKey: false,
    isRequired: false,
    isUnique: false,
    nullable: true,
    referencedPks: ['handle'],
    options: overrides.options ?? [],
  } as EntityTemplate
}
