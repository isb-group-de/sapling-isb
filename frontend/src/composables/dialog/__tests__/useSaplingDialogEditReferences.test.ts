import { computed, reactive, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AccumulatedPermission, EntityState, EntityTemplate } from '@/entity/structure'
import type { EntityItem, SaplingGenericItem } from '@/entity/entity'

const { findMock, loadGenericManyMock, loadGenericMock } = vi.hoisted(() => ({
  findMock: vi.fn(),
  loadGenericManyMock: vi.fn(),
  loadGenericMock: vi.fn(),
}))

vi.mock('@/services/api.generic.service', () => ({
  default: {
    find: findMock,
  },
}))

vi.mock('@/stores/genericStore', () => ({
  useGenericStore: () => ({
    getState: (key: string) => getMockedEntityState(key),
    loadGeneric: loadGenericMock,
    loadGenericMany: loadGenericManyMock,
  }),
}))

import { useSaplingDialogEditReferences } from '../useSaplingDialogEditReferences'

const entityStates = reactive<Record<string, EntityState>>({
  company: createEntityState('company', [
    createTemplate({
      name: 'name',
      type: 'string',
      options: ['isValue'],
    }),
    createTemplate({
      name: 'secret',
      type: 'string',
      options: ['isSecurity'],
    }),
  ]),
  person: createEntityState('person', [
    createTemplate({
      name: 'firstName',
      type: 'string',
    }),
    createTemplate({
      name: 'createdAt',
      type: 'datetime',
      options: ['isSystem'],
    }),
  ]),
})

describe('useSaplingDialogEditReferences', () => {
  beforeEach(() => {
    findMock.mockReset()
    loadGenericManyMock.mockReset()
    loadGenericMock.mockReset()
    loadGenericManyMock.mockResolvedValue(undefined)
    loadGenericMock.mockResolvedValue(undefined)
  })

  it('loads readable reference metadata as one batch and exposes visible columns', async () => {
    const references = createReferences([
      { entityHandle: 'company', allowRead: true } as AccumulatedPermission,
      { entityHandle: 'person', allowRead: true } as AccumulatedPermission,
    ])
    const templates = [
      createTemplate({
        name: 'creatorCompany',
        type: 'CompanyItem',
        isReference: true,
        referenceName: 'company',
      }),
      createTemplate({
        name: 'assigneeCompany',
        type: 'CompanyItem',
        isReference: true,
        referenceName: 'company',
      }),
      createTemplate({
        name: 'creatorPerson',
        type: 'PersonItem',
        isReference: true,
        referenceName: 'person',
      }),
    ]

    await references.ensureReferenceColumnsForTemplates(templates)

    expect(loadGenericManyMock).toHaveBeenCalledTimes(1)
    expect(loadGenericManyMock).toHaveBeenCalledWith([
      { entityHandle: 'company', namespaces: ['global'] },
      { entityHandle: 'person', namespaces: ['global'] },
    ])
    expect(
      references.getReferenceColumnsSync(templates[0]).map((template) => template.name),
    ).toEqual(['name'])
    expect(
      references.getReferenceColumnsSync(templates[2]).map((template) => template.name),
    ).toEqual(['firstName'])
  })

  it('does not load unreadable reference metadata', async () => {
    const references = createReferences([
      { entityHandle: 'company', allowRead: false } as AccumulatedPermission,
    ])
    const template = createTemplate({
      name: 'company',
      type: 'CompanyItem',
      isReference: true,
      referenceName: 'company',
    })

    await references.ensureReferenceColumnsForTemplates([template])

    expect(loadGenericManyMock).not.toHaveBeenCalled()
    expect(references.getReferenceColumnsSync(template)).toEqual([])
  })

  it('keeps optional dependent references available without a parent and derives the parent', () => {
    const references = createReferences([
      { entityHandle: 'company', allowRead: true } as AccumulatedPermission,
      { entityHandle: 'person', allowRead: true } as AccumulatedPermission,
    ])
    references.templates.value = [
      createTemplate({
        name: 'creatorCompany',
        type: 'CompanyItem',
        isReference: true,
        referenceName: 'company',
      }),
      createTemplate({
        name: 'creatorPerson',
        type: 'PersonItem',
        isReference: true,
        referenceName: 'person',
        referenceDependency: {
          parentField: 'creatorCompany',
          targetField: 'company',
          clearOnParentChange: true,
        },
      }),
    ]
    const personTemplate = references.templates.value[1]
    const company = { handle: 17, name: 'Example GmbH' }
    const person = { handle: 23, firstName: 'Ada', company }

    expect(references.isReferenceDependencyBlocked(personTemplate)).toBe(false)
    expect(references.getReferenceParentFilter(personTemplate)).toEqual({})

    references.form.value.creatorPerson = person
    references.applyReferenceDependencyParent('creatorPerson', person)

    expect(references.form.value.creatorCompany).toEqual(company)

    references.form.value.creatorCompany = null
    expect(references.isReferenceValueValidForDependency(personTemplate)).toBe(false)
  })

  it('returns the only filtered child and leaves ambiguous child catalogs unselected', async () => {
    const references = createReferences([
      { entityHandle: 'company', allowRead: true } as AccumulatedPermission,
      { entityHandle: 'person', allowRead: true } as AccumulatedPermission,
    ])
    references.templates.value = [
      createTemplate({
        name: 'creatorCompany',
        type: 'CompanyItem',
        isReference: true,
        referenceName: 'company',
      }),
      createTemplate({
        name: 'creatorPerson',
        type: 'PersonItem',
        isReference: true,
        referenceName: 'person',
        referenceDependency: {
          parentField: 'creatorCompany',
          targetField: 'company',
        },
      }),
    ]
    references.form.value.creatorCompany = { handle: 17, name: 'Example GmbH' }
    const personTemplate = references.templates.value[1]
    const onlyPerson = {
      handle: 23,
      firstName: 'Ada',
      company: references.form.value.creatorCompany,
    }
    findMock.mockResolvedValueOnce({ data: [onlyPerson], meta: { total: 1 } })

    await expect(references.findSingleReferenceForDependency(personTemplate)).resolves.toEqual(
      onlyPerson,
    )
    expect(findMock).toHaveBeenCalledWith('person', {
      filter: { company: { $eq: 17 } },
      page: 1,
      limit: 2,
      relations: ['m:1'],
    })

    findMock.mockResolvedValueOnce({ data: [onlyPerson, { handle: 24 }], meta: { total: 2 } })
    await expect(references.findSingleReferenceForDependency(personTemplate)).resolves.toBeNull()
  })

  it('ignores a unique-child response when the parent changed while it was loading', async () => {
    const references = createReferences([
      { entityHandle: 'company', allowRead: true } as AccumulatedPermission,
      { entityHandle: 'person', allowRead: true } as AccumulatedPermission,
    ])
    references.templates.value = [
      createTemplate({
        name: 'creatorCompany',
        type: 'CompanyItem',
        isReference: true,
        referenceName: 'company',
      }),
      createTemplate({
        name: 'creatorPerson',
        type: 'PersonItem',
        isReference: true,
        referenceName: 'person',
        referenceDependency: {
          parentField: 'creatorCompany',
          targetField: 'company',
        },
      }),
    ]
    const firstCompany = { handle: 17, name: 'First GmbH' }
    references.form.value.creatorCompany = firstCompany
    let resolveRequest!: (value: { data: SaplingGenericItem[]; meta: { total: number } }) => void
    findMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )

    const pendingSelection = references.findSingleReferenceForDependency(
      references.templates.value[1],
    )
    await Promise.resolve()
    references.form.value.creatorCompany = { handle: 18, name: 'Second GmbH' }
    resolveRequest({
      data: [{ handle: 23, firstName: 'Ada', company: firstCompany }],
      meta: { total: 1 },
    })

    await expect(pendingSelection).resolves.toBeNull()
  })
})

function createReferences(permissionsValue: AccumulatedPermission[]) {
  const form = ref<SaplingGenericItem>({})
  const templates = ref<EntityTemplate[]>([])
  const permissions = ref<AccumulatedPermission[] | null>(permissionsValue)

  return {
    ...useSaplingDialogEditReferences({
      form,
      templates: computed(() => templates.value),
      permissions,
      hasFormValue: (value: unknown) => value !== null && value !== undefined && value !== '',
    }),
    form,
    templates,
  }
}

function createEntityState(entityHandle: string, entityTemplates: EntityTemplate[]): EntityState {
  return {
    entity: { handle: entityHandle } as EntityItem,
    entityPermission: null,
    entityTranslation: {} as never,
    entityTemplates,
    isLoading: false,
    currentEntityName: entityHandle,
    currentNamespaces: [],
  }
}

function getMockedEntityState(key: string): EntityState {
  return entityStates[key] ?? createEntityState(key, [])
}

function createTemplate(
  overrides: Partial<EntityTemplate> & Pick<EntityTemplate, 'name' | 'type'>,
): EntityTemplate {
  return {
    name: overrides.name,
    key: overrides.name,
    title: overrides.name,
    type: overrides.type,
    kind: overrides.kind,
    referenceName: overrides.referenceName,
    referenceDependency: overrides.referenceDependency,
    options: overrides.options ?? [],
    isAutoIncrement: false,
    isPersistent: true,
    isReference: overrides.isReference ?? false,
    referencedPks: [],
    length: undefined,
  } as EntityTemplate
}
