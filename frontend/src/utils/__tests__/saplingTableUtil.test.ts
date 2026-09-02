import { describe, expect, it } from 'vitest'

import type { EntityState, EntityTemplate } from '@/entity/structure'

import {
  canReadReferenceTemplate,
  filterTableHeadersByReferencePermission,
  getListProjectionFieldNames,
  getListProjectionReferenceDependencyNames,
  getMobileTableHeaders,
  getReadableReferenceRelationNames,
  getRelationTableHeaders,
  getSupportedTableHeaders,
  getTableHeaders,
  isVisibleTableTemplate,
} from '../saplingTableUtil'

function createTemplate(overrides: Partial<EntityTemplate> = {}): EntityTemplate {
  const name = overrides.name ?? overrides.key ?? 'title'

  return {
    key: overrides.key ?? name,
    name,
    type: overrides.type ?? 'StringType',
    formVisible: overrides.formVisible ?? true,
    tableVisible: overrides.tableVisible ?? true,
    mobileVisible: overrides.mobileVisible ?? false,
    ...overrides,
  }
}

function createRelationState(entityHandle: string, templates: EntityTemplate[]): EntityState {
  return {
    entity: { handle: entityHandle } as EntityState['entity'],
    entityPermission: null,
    entityTranslation: null as never,
    entityTemplates: templates,
    isLoading: false,
    currentEntityName: entityHandle,
    currentNamespaces: [],
  }
}

describe('saplingTableUtil', () => {
  it('builds visible headers for relation and standalone tables', () => {
    const visibleTemplate = createTemplate({ name: 'title' })
    const hiddenTemplate = createTemplate({
      name: 'secret',
      options: ['isSystem'],
      formVisible: false,
      tableVisible: false,
    })
    const unreadableReferenceTemplate = createTemplate({
      name: 'salesOpportunity',
      kind: 'm:1',
      referenceName: 'salesOpportunity',
    })
    const readableReferenceTemplate = createTemplate({
      name: 'company',
      kind: 'm:1',
      referenceName: 'company',
    })
    const unreadableOneToOneTemplate = createTemplate({
      name: 'primaryContact',
      kind: '1:1',
      referenceName: 'person',
    })
    const translate = (key: string) => `translated:${key}`
    const permissions = [
      { entityHandle: 'company', allowRead: true },
      { entityHandle: 'salesOpportunity', allowRead: false },
    ]

    expect(
      getRelationTableHeaders(
        {
          tickets: createRelationState('ticket', [
            visibleTemplate,
            hiddenTemplate,
            unreadableReferenceTemplate,
          ]),
        },
        translate,
        permissions,
      ).tickets,
    ).toEqual([expect.objectContaining({ key: 'title', title: 'translated:ticket.title' })])

    expect(
      getTableHeaders(
        [visibleTemplate, hiddenTemplate, readableReferenceTemplate, unreadableReferenceTemplate],
        { handle: 'ticket' } as never,
        translate,
        permissions,
      ),
    ).toEqual([
      expect.objectContaining({ key: 'title', title: 'translated:ticket.title' }),
      expect.objectContaining({ key: 'company', title: 'translated:ticket.company' }),
    ])

    expect(canReadReferenceTemplate(readableReferenceTemplate, permissions)).toBe(true)
    expect(canReadReferenceTemplate(unreadableReferenceTemplate, permissions)).toBe(false)
    expect(canReadReferenceTemplate(unreadableOneToOneTemplate, permissions)).toBe(false)
    expect(
      filterTableHeadersByReferencePermission(
        [readableReferenceTemplate, unreadableReferenceTemplate, unreadableOneToOneTemplate],
        permissions,
      ),
    ).toEqual([readableReferenceTemplate])
    expect(
      getReadableReferenceRelationNames(
        [readableReferenceTemplate, unreadableReferenceTemplate, unreadableOneToOneTemplate],
        permissions,
      ),
    ).toEqual(['company'])
  })

  it('applies configured table visibility and column order', () => {
    const templates = [
      createTemplate({ name: 'hidden', tableVisible: false }),
      createTemplate({ name: 'longNotes', length: 512, tableVisible: true, tableOrder: 20 }),
      createTemplate({ name: 'title', tableOrder: 10 }),
    ]

    expect(isVisibleTableTemplate(templates[0])).toBe(false)
    expect(isVisibleTableTemplate(templates[1])).toBe(true)
    expect(
      getTableHeaders(templates, { handle: 'ticket' } as never, (key) => key).map(
        (header) => header.key,
      ),
    ).toEqual(['title', 'longNotes'])
  })

  it('applies table order across form groups', () => {
    const templates = [
      createTemplate({
        name: 'title',
        formGroup: 'basics',
        formGroupOrder: 100,
        tableOrder: 1,
        tableOrderMode: 'absolute',
      }),
      createTemplate({
        name: 'deadline',
        formGroup: 'schedule',
        formGroupOrder: 300,
        tableOrder: 0,
        tableOrderMode: 'absolute',
      }),
    ]

    expect(
      getTableHeaders(templates, { handle: 'ticket' } as never, (key) => key).map(
        (header) => header.key,
      ),
    ).toEqual(['deadline', 'title'])
  })

  it('includes readable nested isValue relations for reference labels', () => {
    const accountManager = createTemplate({
      name: 'accountManager',
      kind: 'm:1',
      isReference: true,
      referenceName: 'person',
    })
    const personCompany = createTemplate({
      name: 'company',
      kind: 'm:1',
      isReference: true,
      referenceName: 'company',
      options: ['isValue'],
    })
    const permissions = [
      { entityHandle: 'person', allowRead: true },
      { entityHandle: 'company', allowRead: true },
    ]

    expect(
      getReadableReferenceRelationNames(
        [accountManager],
        permissions,
        ['accountManager'],
        (referenceName) => (referenceName === 'person' ? [personCompany] : []),
      ),
    ).toEqual(['accountManager', 'accountManager.company'])
  })

  it('projects list-visible, mobile, value, mail-action, and primary fields', () => {
    const templates = [
      createTemplate({ name: 'handle', tableVisible: false }),
      createTemplate({ name: 'title', options: ['isValue'], tableVisible: true }),
      createTemplate({ name: 'mobileSummary', tableVisible: false, mobileVisible: true }),
      createTemplate({ name: 'email', options: ['isMail'], tableVisible: false }),
      createTemplate({ name: 'description', tableVisible: false, mobileVisible: false }),
      createTemplate({
        name: 'password',
        options: ['isSecurity'],
        tableVisible: true,
      }),
    ]

    expect(getListProjectionFieldNames(templates)).toEqual([
      'handle',
      'title',
      'mobileSummary',
      'email',
    ])
  })

  it('projects hidden computed company email fields for row mail actions', () => {
    const templates = [
      createTemplate({
        name: 'company',
        kind: 'm:1',
        referenceName: 'company',
        isReference: true,
        isPersistent: true,
        tableVisible: false,
      }),
      createTemplate({
        name: 'companyEmail',
        isPersistent: false,
        tableVisible: false,
        options: ['isMail', 'isReadOnly'],
      }),
    ]
    const permissions = [{ entityHandle: 'company', allowRead: true }]
    const companyTemplates = [
      createTemplate({ name: 'name', isPersistent: true, options: ['isValue'] }),
      createTemplate({ name: 'email', isPersistent: true }),
    ]

    expect(getListProjectionFieldNames(templates, permissions, () => companyTemplates)).toEqual([
      'company.email',
      'company.name',
    ])
    expect(getListProjectionReferenceDependencyNames(templates, permissions)).toEqual(['company'])
  })

  it('projects readable dependencies for visible computed reference fields', () => {
    const templates = [
      createTemplate({
        name: 'creatorPerson',
        kind: 'm:1',
        referenceName: 'person',
        isReference: true,
        isPersistent: true,
        tableVisible: false,
      }),
      createTemplate({
        name: 'creatorPersonEmail',
        isPersistent: false,
        tableVisible: true,
        options: ['isMail', 'isReadOnly'],
      }),
      createTemplate({
        name: 'creatorPersonPhone',
        isPersistent: false,
        tableVisible: true,
        options: ['isPhone', 'isReadOnly'],
      }),
    ]
    const permissions = [{ entityHandle: 'person', allowRead: true }]
    const personTemplates = [
      createTemplate({ name: 'email', isPersistent: true }),
      createTemplate({
        name: 'phone',
        isPersistent: true,
        fieldAccess: { allowRead: false, allowInsert: true, allowUpdate: true },
      }),
    ]
    const projectedFields = getListProjectionFieldNames(templates, permissions, (referenceName) =>
      referenceName === 'person' ? personTemplates : [],
    )

    expect(getListProjectionReferenceDependencyNames(templates, permissions)).toEqual([
      'creatorPerson',
    ])
    expect(projectedFields).toEqual(['creatorPerson.email'])
    expect(getReadableReferenceRelationNames(templates, permissions, projectedFields)).toEqual([
      'creatorPerson',
    ])
    expect(
      getTableHeaders(templates, { handle: 'ticket' } as never, (key) => key, permissions),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'creatorPersonEmail', sortable: false }),
        expect.objectContaining({ key: 'creatorPersonPhone', sortable: false }),
      ]),
    )
  })

  it('keeps early entity groups ahead of later groups when sorting table columns', () => {
    const templates = [
      createTemplate({
        name: 'contract',
        formGroupOrder: 450,
        tableOrder: 50,
      }),
      createTemplate({
        name: 'number',
        formGroupOrder: 100,
        tableOrder: 100,
      }),
      createTemplate({
        name: 'status',
        formGroupOrder: 100,
        tableOrder: 400,
      }),
      createTemplate({
        name: 'slaPolicy',
        formGroupOrder: 500,
        tableOrder: 100,
      }),
    ]

    expect(
      getTableHeaders(templates, { handle: 'ticket' } as never, (key) => key).map(
        (header) => header.key,
      ),
    ).toEqual(['number', 'status', 'contract', 'slaPolicy'])
  })

  it('builds mobile headers from mobile visibility independently of table visibility', () => {
    const templates = [
      createTemplate({ name: 'summary', tableOrder: 20 }),
      createTemplate({
        name: 'title',
        options: ['isValue'],
        tableOrder: 10,
        mobileVisible: true,
      }),
      createTemplate({
        name: 'hiddenValue',
        options: ['isValue'],
        tableVisible: false,
        tableOrder: 30,
        mobileVisible: true,
      }),
      createTemplate({
        name: 'mobileOnly',
        tableVisible: false,
        mobileVisible: true,
        mobileOrder: 5,
      }),
      createTemplate({ name: 'suppressedMobile', mobileVisible: false, tableOrder: 1 }),
    ]
    const translate = (key: string) => key
    const supportedHeaders = getSupportedTableHeaders(
      templates,
      { handle: 'ticket' } as never,
      translate,
    )
    const desktopHeaders = getTableHeaders(templates, { handle: 'ticket' } as never, translate)

    expect(desktopHeaders.map((header) => header.key)).toEqual([
      'suppressedMobile',
      'title',
      'summary',
    ])
    expect(getMobileTableHeaders(supportedHeaders).map((header) => header.key)).toEqual([
      'mobileOnly',
      'title',
      'hiddenValue',
    ])
  })

  it('uses explicit mobile visibility instead of deriving it from isValue', () => {
    const headers = [
      createTemplate({ name: 'title', options: ['isValue'], mobileVisible: true }),
      createTemplate({ name: 'description' }),
    ].map((template) => ({
      ...template,
      key: template.name,
      title: template.name,
    }))

    expect(getMobileTableHeaders(headers).map((header) => header.key)).toEqual(['title'])
  })
})
