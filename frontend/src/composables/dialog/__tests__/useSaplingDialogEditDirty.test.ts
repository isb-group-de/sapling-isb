import { computed, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import type { EntityTemplate } from '@/entity/structure'
import type { SaplingGenericItem } from '@/entity/entity'
import { useSaplingDialogEditDirty } from '../useSaplingDialogEditDirty'

function setup(value: unknown, overrides: Partial<EntityTemplate> = {}) {
  const template: EntityTemplate = {
    key: 'conditions',
    name: 'conditions',
    type: 'JsonType',
    isPersistent: true,
    ...overrides,
  }
  const form = ref<SaplingGenericItem>({ conditions: value })
  const dirty = useSaplingDialogEditDirty({
    form,
    templates: computed(() => [template]),
    initialFormSnapshot: ref({}),
    extractDependencyIdentifier: (entry) => (entry as SaplingGenericItem)?.handle ?? null,
    formatLocalDate: () => '',
    formatLocalTime: () => '',
    isValidDate: () => true,
  })
  dirty.syncInitialFormSnapshot()
  return { form, template, ...dirty }
}

describe('dialog configuration dirty tracking', () => {
  it('tracks edits to existing inline conditions without changing their handles', () => {
    const state = setup([{ handle: 4, observedField: 'status', newValue: 'open', groupOrder: 0 }], {
      type: 'EmailSubscriptionConditionItem',
      kind: '1:m',
      isReference: true,
      inlineCollection: { renderer: 'conditionBuilder', sourceEntityField: 'entity' },
    })
    const conditions = state.form.value.conditions as Array<Record<string, unknown>>
    conditions[0].newValue = 'closed'
    expect(state.isDirty.value).toBe(true)
    expect(state.isTemplateDirty(state.template)).toBe(true)
    conditions[0].newValue = 'open'
    expect(state.isDirty.value).toBe(false)
    conditions[0].groupOrder = 1
    expect(state.isDirty.value).toBe(true)
  })

  it('detects JSON text changes and treats formatting as unchanged', () => {
    const state = setup('[{"field":"status","operator":"changed"}]')
    state.form.value.conditions = [{ operator: 'changed', field: 'status' }]
    expect(state.isDirty.value).toBe(false)
    state.form.value.conditions = '[{"field":"title","operator":"changed"}]'
    expect(state.isDirty.value).toBe(true)
  })

  it('preserves the order of JSON reference paths and nested lists', () => {
    const state = setup([{ field: 'parent' }, { field: 'company' }])
    state.form.value.conditions = [{ field: 'company' }, { field: 'parent' }]
    expect(state.isDirty.value).toBe(true)
    state.syncInitialFormSnapshot()
    expect(state.isDirty.value).toBe(false)
    state.form.value.conditions = { values: [1, 2] }
    state.syncInitialFormSnapshot()
    state.form.value.conditions = { values: [2, 1] }
    expect(state.isDirty.value).toBe(true)
  })

  it('still compares ordinary reference selections by unordered handles', () => {
    const state = setup([{ handle: 1, title: 'One' }, { handle: 2 }], {
      type: 'PersonItem',
      kind: 'm:n',
      isReference: true,
    })
    state.form.value.conditions = [{ handle: 2 }, { handle: 1, title: 'Hydrated label' }]
    expect(state.isDirty.value).toBe(false)
  })
})
