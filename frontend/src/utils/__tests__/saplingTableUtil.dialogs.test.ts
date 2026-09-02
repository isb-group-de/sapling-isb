import { describe, expect, it } from 'vitest'

import type { SaplingGenericItem } from '@/entity/entity'
import type { DialogState, EntityTemplate, SortItem } from '@/entity/structure'

import {
  buildTableFilter,
  buildTableOrderBy,
  getAllowedColumnFilterOperators,
  getEntityValueLabel,
  getEntityValueLabelLines,
  getDefaultColumnFilterOperatorForTemplate,
  getEditDialogHeaders,
  getGenericReferenceEntityHandle,
  getGenericReferenceHandle,
  getTableHeaders,
  isBooleanTemplate,
  isDateTemplate,
  isFilterableTableColumn,
  isGenericReferenceTemplate,
  isManyToOneTemplate,
  isNumericTemplate,
  isRangeTemplate,
  isTextSearchableTemplate,
  isTimeTemplate,
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

describe('saplingTableUtil dialog, filtering, and labels', () => {
  it('filters edit dialog headers by mode, reference visibility, and permissions', () => {
    const templates = [
      createTemplate({
        name: 'handle',
        isAutoIncrement: false,
      }),
      createTemplate({
        name: 'company',
        kind: 'm:1',
        referenceName: 'company',
        isReference: true,
      }),
      createTemplate({
        name: 'internalNote',
        formVisible: false,
      }),
    ]

    expect(getEditDialogHeaders(templates, 'create' as DialogState, false)).toEqual([
      expect.objectContaining({ name: 'handle' }),
    ])
    expect(
      getEditDialogHeaders(templates, 'edit' as DialogState, true, [
        { entityHandle: 'company', allowRead: true },
      ]),
    ).toEqual([
      expect.objectContaining({ name: 'handle' }),
      expect.objectContaining({ name: 'company' }),
    ])
  })

  it('hides fields whose form group is hidden even when the field itself is visible', () => {
    const hiddenGroupField = createTemplate({
      name: 'username',
      formVisible: false,
      formConfig: { visible: true },
      formGroup: 'person.dialogGroup.security',
      formGroupConfig: { visible: false },
    })

    expect(getEditDialogHeaders([hiddenGroupField], 'edit', true)).toEqual([])
  })

  it('shows manual primary keys in create and edit dialogs and hides auto-increment keys', () => {
    const manualHandle = createTemplate({
      name: 'handle',
      isAutoIncrement: false,
      formVisible: false,
    })
    const autoIncrementHandle = createTemplate({
      name: 'handle',
      isAutoIncrement: true,
      formVisible: true,
    })
    const title = createTemplate({ name: 'title', formVisible: true })

    expect(
      getEditDialogHeaders([manualHandle, title], 'create', true).map((template) => template.name),
    ).toEqual(['handle', 'title'])
    expect(
      getEditDialogHeaders([autoIncrementHandle, title], 'create', true).map(
        (template) => template.name,
      ),
    ).toEqual(['title'])
    expect(
      getEditDialogHeaders([manualHandle, title], 'edit', true).map((template) => template.name),
    ).toEqual(['handle', 'title'])
  })

  it('keeps a configured handle visible when it is the only dialog field', () => {
    const handleTemplate = createTemplate({
      name: 'handle',
      options: ['isValue'],
      formVisible: true,
    })

    expect(getEditDialogHeaders([handleTemplate], 'edit', true)).toEqual([handleTemplate])
    expect(getEditDialogHeaders([handleTemplate], 'readonly', true)).toEqual([handleTemplate])
  })

  it('keeps generic reference templates visible despite system metadata', () => {
    const template = createTemplate({
      name: 'reference',
      options: ['isSystem'],
      genericReference: {
        entityField: 'entity',
        handleField: 'reference',
      },
    })

    expect(isGenericReferenceTemplate(template)).toBe(true)
    expect(getTableHeaders([template], { handle: 'document' } as never, (key) => key)).toEqual([
      expect.objectContaining({ key: 'reference', title: 'document.reference' }),
    ])
    expect(getEditDialogHeaders([template], 'edit', true)).toEqual([
      expect.objectContaining({ name: 'reference' }),
    ])
  })

  it('classifies filterable and typed templates correctly', () => {
    const relationTemplate = createTemplate({
      name: 'company',
      kind: 'm:1',
      referenceName: 'company',
    })
    const computedTemplate = createTemplate({ name: 'creatorPersonEmail', isPersistent: false })
    const booleanTemplate = createTemplate({ name: 'isActive', type: 'Boolean' })
    const dateTemplate = createTemplate({ name: 'createdAt', type: 'DateTime' })
    const timeTemplate = createTemplate({ name: 'startTime', type: 'Time' })
    const numericTemplate = createTemplate({ name: 'amount', type: 'Decimal' })
    const iconTemplate = createTemplate({ name: 'icon', options: ['isIcon'] })
    const longTextTemplate = createTemplate({ name: 'value', length: 1024 })

    expect(isFilterableTableColumn(relationTemplate)).toBe(true)
    expect(isFilterableTableColumn(longTextTemplate)).toBe(true)
    expect(isFilterableTableColumn(computedTemplate)).toBe(false)
    expect(isFilterableTableColumn(createTemplate({ key: '__actions' }))).toBe(false)
    expect(isManyToOneTemplate(relationTemplate)).toBe(true)
    expect(isBooleanTemplate(booleanTemplate)).toBe(true)
    expect(isDateTemplate(dateTemplate)).toBe(true)
    expect(isTimeTemplate(timeTemplate)).toBe(true)
    expect(isNumericTemplate(numericTemplate)).toBe(true)
    expect(isRangeTemplate(dateTemplate)).toBe(true)
    expect(isTextSearchableTemplate(createTemplate({ name: 'title' }))).toBe(true)
    expect(
      isTextSearchableTemplate(
        createTemplate({ name: 'externalKeyHash', options: ['isSearchExcluded'] }),
      ),
    ).toBe(false)
    expect(isTextSearchableTemplate(iconTemplate)).toBe(false)
  })

  it('returns operators based on template type', () => {
    expect(getDefaultColumnFilterOperatorForTemplate(createTemplate({ type: 'Boolean' }))).toBe(
      'eq',
    )
    expect(getDefaultColumnFilterOperatorForTemplate(createTemplate({ type: 'StringType' }))).toBe(
      'like',
    )
    expect(getAllowedColumnFilterOperators(createTemplate({ type: 'Decimal' }))).toEqual([
      'eq',
      'between',
      'gt',
      'gte',
      'lt',
      'lte',
      'isSet',
      'isEmpty',
    ])
  })

  it('builds search filters only from text-searchable columns', () => {
    const filter = buildTableFilter({
      search: 'Alice',
      entityTemplates: [
        createTemplate({ name: 'title' }),
        createTemplate({ name: 'value', length: 1024 }),
        createTemplate({ name: 'externalKeyHash', options: ['isSearchExcluded'] }),
        createTemplate({ name: 'creatorPersonEmail', isPersistent: false }),
        createTemplate({ name: 'amount', type: 'Decimal' }),
        createTemplate({ name: 'durationMs', type: 'integer' }),
      ],
    })

    expect(filter).toEqual({
      $or: [{ title: { $ilike: '%Alice%' } }, { value: { $ilike: '%Alice%' } }],
    })
  })

  it('searches scalar isValue fields of direct references without following nested references', () => {
    const filter = buildTableFilter({
      search: 'Schneider',
      entityTemplates: [
        createTemplate({ name: 'name' }),
        createTemplate({
          name: 'accountManager',
          kind: 'm:1',
          referenceName: 'person',
        }),
      ],
      referenceSearchTemplates: {
        accountManager: [
          createTemplate({ name: 'firstName', options: ['isValue'] }),
          createTemplate({ name: 'lastName', options: ['isValue'] }),
          createTemplate({
            name: 'externalKeyHash',
            options: ['isValue', 'isSearchExcluded'],
          }),
          createTemplate({ name: 'email' }),
          createTemplate({
            name: 'company',
            kind: 'm:1',
            referenceName: 'company',
            options: ['isValue'],
          }),
        ],
      },
    })

    expect(filter).toEqual({
      $or: [
        { name: { $ilike: '%Schneider%' } },
        { accountManager: { firstName: { $ilike: '%Schneider%' } } },
        { accountManager: { lastName: { $ilike: '%Schneider%' } } },
      ],
    })
  })

  it('matches every whitespace-separated search term across all searchable columns', () => {
    const filter = buildTableFilter({
      search: '  Anna   Beispiel  ',
      entityTemplates: [
        createTemplate({ name: 'firstName' }),
        createTemplate({ name: 'lastName' }),
      ],
    })

    expect(filter).toEqual({
      $and: [
        {
          $or: [{ firstName: { $ilike: '%Anna%' } }, { lastName: { $ilike: '%Anna%' } }],
        },
        {
          $or: [{ firstName: { $ilike: '%Beispiel%' } }, { lastName: { $ilike: '%Beispiel%' } }],
        },
      ],
    })
  })

  it('can constrain a long duplicate-check search to the field being edited', () => {
    const filter = buildTableFilter({
      search: 'Kunden antwortet auf E-Mail - neues Ticket',
      searchFieldNames: ['title'],
      entityTemplates: [
        createTemplate({ name: 'number' }),
        createTemplate({ name: 'title' }),
        createTemplate({ name: 'problemDescription' }),
        createTemplate({ name: 'solutionDescription' }),
      ],
    })

    expect(filter).toEqual({
      $and: [
        { $or: [{ title: { $ilike: '%Kunden%' } }] },
        { $or: [{ title: { $ilike: '%antwortet%' } }] },
        { $or: [{ title: { $ilike: '%auf%' } }] },
        { $or: [{ title: { $ilike: '%E-Mail%' } }] },
        { $or: [{ title: { $ilike: '%-%' } }] },
        { $or: [{ title: { $ilike: '%neues%' } }] },
        { $or: [{ title: { $ilike: '%Ticket%' } }] },
      ],
    })
    expect(JSON.stringify(filter)).not.toContain('problemDescription')
    expect(JSON.stringify(filter)).not.toContain('solutionDescription')
  })

  it('builds text filters for long varchar columns such as translation values', () => {
    expect(
      buildTableFilter({
        columnFilters: {
          value: {
            operator: 'like',
            value: 'Speichern',
          },
        },
        entityTemplates: [createTemplate({ name: 'value', length: 1024 })],
      }),
    ).toEqual({ value: { $ilike: '%Speichern%' } })
  })

  it('builds numeric, relation, and date range filters', () => {
    const amountTemplate = createTemplate({ name: 'amount', type: 'Decimal' })
    const companyTemplate = createTemplate({
      name: 'company',
      kind: 'm:1',
      referenceName: 'company',
    })
    const createdAtTemplate = createTemplate({ name: 'createdAt', type: 'Date' })
    const rangeEndExclusive = new Date('2026-04-02T00:00:00')
    rangeEndExclusive.setDate(rangeEndExclusive.getDate() + 1)

    expect(
      buildTableFilter({
        columnFilters: { amount: '42' },
        entityTemplates: [amountTemplate],
      }),
    ).toEqual({ amount: { $eq: 42 } })

    expect(
      buildTableFilter({
        columnFilters: {
          company: {
            operator: 'eq',
            value: '',
            relationItems: [{ handle: 5 }],
          },
        },
        entityTemplates: [companyTemplate],
      }),
    ).toEqual({ company: { handle: 5 } })

    expect(
      buildTableFilter({
        columnFilters: {
          createdAt: {
            operator: 'between',
            value: '',
            rangeStart: '2026-04-01',
            rangeEnd: '2026-04-02',
            rangeStartOperator: 'gte',
            rangeEndOperator: 'lt',
          },
        },
        entityTemplates: [createdAtTemplate],
      }),
    ).toEqual({
      $and: [
        { createdAt: { $gte: '2026-04-01' } },
        { createdAt: { $lt: rangeEndExclusive.toISOString().slice(0, 10) } },
      ],
    })
  })

  it('builds order-by clauses and compact labels', () => {
    const sortBy: SortItem[] = [
      { key: 'title', order: 'asc' },
      { key: '__actions', order: 'desc' },
      { key: 'createdAt', order: 'desc' },
    ]
    const item: SaplingGenericItem = {
      title: 'Ticket A',
      startTime: '09:30:59',
    }

    expect(buildTableOrderBy(sortBy)).toEqual({
      title: 'ASC',
      createdAt: 'DESC',
    })
    expect(
      getEntityValueLabel(item, [
        createTemplate({ name: 'title', options: ['isValue'] }),
        createTemplate({ name: 'startTime', type: 'time', options: ['isValue'] }),
      ]),
    ).toBe('Ticket A 09:30')
  })

  it('prefers isValue fields and falls back to handle for entity labels', () => {
    expect(
      getEntityValueLabel({ handle: 'closed', description: 'Geschlossen' }, [
        createTemplate({ name: 'description', options: ['isValue'] }),
      ]),
    ).toBe('Geschlossen')

    expect(
      getEntityValueLabel({ handle: 'priority' }, [
        createTemplate({ name: 'description', options: ['isValue'] }),
      ]),
    ).toBe('priority')
  })

  it('ignores relation objects in isValue labels and falls back gracefully', () => {
    expect(
      getEntityValueLabel(
        {
          handle: '2026#00015',
          title: 'DATEV Zahlungsverkehrsexport',
          customer: { handle: 'customer-1', title: 'Musterkunde' },
        },
        [
          createTemplate({ name: 'customer', options: ['isValue'] }),
          createTemplate({ name: 'title', options: ['isValue'] }),
        ],
      ),
    ).toBe('DATEV Zahlungsverkehrsexport')

    expect(
      getEntityValueLabel(
        {
          handle: '2026#00015',
          customer: { handle: 'customer-1', title: 'Musterkunde' },
        },
        [createTemplate({ name: 'customer', options: ['isValue'] })],
      ),
    ).toBe('2026#00015')
  })

  it('renders isValue references from their own value metadata on separate lines', () => {
    const personTemplates = [
      createTemplate({ name: 'firstName', options: ['isValue'] }),
      createTemplate({ name: 'lastName', options: ['isValue'] }),
      createTemplate({
        name: 'company',
        type: 'CompanyItem',
        isReference: true,
        kind: 'm:1',
        referenceName: 'company',
        options: ['isValue'],
      }),
    ]
    const item = {
      handle: 42,
      firstName: 'Max',
      lastName: 'Mustermann',
      company: { handle: 7, name: 'Standardfirma GmbH' },
    }
    const referenceTemplates = {
      company: [createTemplate({ name: 'name', options: ['isValue'] })],
    }

    expect(getEntityValueLabel(item, personTemplates, referenceTemplates)).toBe(
      'Max Mustermann\nStandardfirma GmbH',
    )
    expect(getEntityValueLabelLines(item, personTemplates, referenceTemplates)).toEqual([
      { value: 'Max Mustermann', isReference: false },
      { value: 'Standardfirma GmbH', isReference: true },
    ])
  })

  it('does not expose a raw handle for an unresolved nested isValue reference', () => {
    const personTemplates = [
      createTemplate({ name: 'firstName', options: ['isValue'] }),
      createTemplate({ name: 'lastName', options: ['isValue'] }),
      createTemplate({
        name: 'company',
        type: 'CompanyItem',
        isReference: true,
        kind: 'm:1',
        referenceName: 'company',
        options: ['isValue'],
      }),
    ]

    expect(
      getEntityValueLabel(
        {
          handle: 4772,
          firstName: null,
          lastName: 'Hersbach',
          company: { handle: 1688 },
        },
        personTemplates,
        { company: [] },
      ),
    ).toBe('Hersbach')
  })

  it('extracts entity and handle data for generic references', () => {
    const template = createTemplate({
      name: 'reference',
      genericReference: {
        entityField: 'entity',
        handleField: 'reference',
      },
    })

    expect(
      getGenericReferenceEntityHandle(
        {
          entity: { handle: 'ticket' },
          reference: '4711',
        },
        template,
      ),
    ).toBe('ticket')
    expect(
      getGenericReferenceHandle(
        {
          entity: 'company',
          reference: 'abc-123',
        },
        template,
      ),
    ).toBe('abc-123')
  })
})
