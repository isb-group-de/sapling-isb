import { describe, expect, it } from '@jest/globals';

import {
  Sapling,
  SaplingForm,
  SaplingGenericReference,
  SaplingKanban,
  SaplingNumeric,
  getSaplingNumeric,
  SaplingReferenceTemplate,
  getSaplingFormLayout,
  getSaplingGenericReference,
  getSaplingKanban,
  getSaplingOptions,
  getSaplingPropertyNamesWithOption,
  getSaplingReferenceTemplate,
} from './entity.decorator';

describe('entity.decorator', () => {
  it.each([0.5, 1, 10, 100])(
    'stores a numeric step of %s independently per field',
    (step) => {
      class NumericEntity {
        @SaplingNumeric({ step })
        amount!: number;
      }
      expect(getSaplingNumeric(NumericEntity.prototype, 'amount')).toEqual({
        step,
      });
      expect(getSaplingNumeric(NumericEntity.prototype, 'other')).toBeNull();
    },
  );

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid numeric step %s',
    (step) => {
      expect(() => SaplingNumeric({ step })).toThrow('finite positive number');
    },
  );

  class ExampleEntity {
    @Sapling(['isValue'])
    @SaplingForm({
      group: ' details ',
      order: 7.9,
      width: 3.4 as never,
      visible: false,
      tableOrder: 12.9,
      tableVisible: false,
      mobileOrder: 3.9,
      mobileVisible: true,
    })
    title!: string;

    @SaplingForm({ group: '   ', order: Number.NaN, width: 99 as never })
    description!: string;

    @SaplingForm({ width: 2 })
    compact!: string;

    @Sapling(['isAddress'])
    street!: string;

    @Sapling(['isAddress'])
    city!: string;

    @SaplingGenericReference({
      entityField: ' entity ',
      handleField: ' reference ',
    })
    genericReference!: string;

    @SaplingReferenceTemplate([
      {
        sourceField: ' bodyMarkdown ',
        targetField: ' description ',
      },
      {
        sourceField: ' estimatedHours ',
        targetField: ' effort ',
        overwrite: false,
      },
    ])
    template!: string;

    @SaplingKanban({
      columnField: ' status ',
      scopeOpenField: ' isOpen ',
      scopeOpenValue: true,
      recordScopeOpenField: ' isActive ',
      recordScopeOpenValue: true,
      cardSubtitleFields: [' customer ', ' ', 'assignee'],
      cardMetaFields: [' priority '],
      cardFooterFields: [' owner ', ' deadline '],
      columnDescriptionField: ' description ',
    })
    kanban!: string;
  }

  it('stores normalized form layout metadata without affecting sapling options', () => {
    expect(getSaplingOptions(ExampleEntity.prototype, 'title')).toEqual([
      'isValue',
    ]);

    expect(getSaplingFormLayout(ExampleEntity.prototype, 'title')).toEqual({
      group: 'details',
      groupOrder: null,
      order: 7,
      width: 3,
      formVisible: false,
      tableOrder: 12,
      tableVisible: false,
      mobileOrder: 3,
      mobileVisible: true,
    });
  });

  it('lists properties for an option in declaration order', () => {
    expect(
      getSaplingPropertyNamesWithOption(new ExampleEntity(), 'isAddress'),
    ).toEqual(['street', 'city']);
  });

  it('returns sane defaults for missing or invalid form layout metadata', () => {
    expect(
      getSaplingFormLayout(ExampleEntity.prototype, 'description'),
    ).toEqual({
      group: null,
      groupOrder: null,
      order: null,
      width: 4,
      formVisible: null,
      tableOrder: null,
      tableVisible: null,
      mobileOrder: null,
      mobileVisible: null,
    });

    expect(getSaplingFormLayout(ExampleEntity.prototype, 'missing')).toEqual({
      group: null,
      groupOrder: null,
      order: null,
      width: null,
      formVisible: null,
      tableOrder: null,
      tableVisible: null,
      mobileOrder: null,
      mobileVisible: null,
    });
  });

  it('supports partial form options without forcing unspecified values', () => {
    expect(getSaplingFormLayout(ExampleEntity.prototype, 'compact')).toEqual({
      group: null,
      groupOrder: null,
      order: null,
      width: 2,
      formVisible: null,
      tableOrder: null,
      tableVisible: null,
      mobileOrder: null,
      mobileVisible: null,
    });
  });

  it('stores normalized generic reference metadata', () => {
    expect(
      getSaplingGenericReference(ExampleEntity.prototype, 'genericReference'),
    ).toEqual({
      entityField: 'entity',
      handleField: 'reference',
    });

    expect(
      getSaplingGenericReference(ExampleEntity.prototype, 'missing'),
    ).toBeNull();
  });

  it('stores normalized reference template mappings', () => {
    expect(
      getSaplingReferenceTemplate(ExampleEntity.prototype, 'template'),
    ).toEqual({
      mappings: [
        {
          sourceField: 'bodyMarkdown',
          targetField: 'description',
          overwrite: undefined,
        },
        {
          sourceField: 'estimatedHours',
          targetField: 'effort',
          overwrite: false,
        },
      ],
    });

    expect(
      getSaplingReferenceTemplate(ExampleEntity.prototype, 'missing'),
    ).toBeNull();
  });

  it('stores normalized kanban metadata', () => {
    expect(getSaplingKanban(ExampleEntity.prototype, 'kanban')).toEqual({
      columnField: 'status',
      scopeOpenField: 'isOpen',
      scopeOpenValue: true,
      recordScopeOpenField: 'isActive',
      recordScopeOpenValue: true,
      cardSubtitleFields: ['customer', 'assignee'],
      cardMetaFields: ['priority'],
      cardFooterFields: ['owner', 'deadline'],
      columnDescriptionField: 'description',
    });

    expect(getSaplingKanban(ExampleEntity.prototype, 'missing')).toBeNull();
  });
});
