import { describe, expect, it, jest } from '@jest/globals';
import { ImportTemplateService } from './import-template.service';

describe('ImportTemplateService', () => {
  it('returns template summaries with persisted value mappings', async () => {
    const find = jest
      .fn<
        (
          entity: unknown,
          filter: unknown,
          options: unknown,
        ) => Promise<object[]>
      >()
      .mockResolvedValue([
        {
          handle: 7,
          title: 'Companies',
          description: 'ERP companies',
          source: { handle: 'erp' },
          targetEntity: { handle: 'company' },
          isActive: true,
          mapping: {
            mappings: [{ sourceColumn: 'Name', targetField: 'name' }],
          },
          externalKeyColumns: ['External ID'],
          genericReferenceMapping: null,
          valueMappings: {
            isInitialized: () => true,
            getItems: () => [
              {
                targetField: 'status',
                sourceValue: 'A',
                targetValue: 'active',
                fallback: 'keep',
              },
            ],
          },
        },
      ]);
    const service = new ImportTemplateService({ find } as never);

    const result = await service.listTemplates('company', 'erp');

    expect(find).toHaveBeenCalledWith(
      expect.any(Function),
      {
        isActive: true,
        targetEntity: { handle: 'company' },
        source: { handle: 'erp' },
      },
      {
        populate: ['source', 'targetEntity', 'valueMappings'],
        orderBy: { title: 'ASC' },
      },
    );
    expect(result).toEqual([
      expect.objectContaining({
        handle: 7,
        sourceHandle: 'erp',
        entityHandle: 'company',
        mapping: expect.objectContaining({
          valueMappings: [
            {
              targetField: 'status',
              values: { A: 'active' },
              fallback: 'keep',
            },
          ],
        }),
      }),
    ]);
  });

  it('merges template value mappings with batch overrides', () => {
    const service = new ImportTemplateService({} as never);

    expect(
      service.mergeValueMappings(
        [
          {
            targetField: 'department',
            fallback: 'keep',
            values: { Marketing: 'marketing', Sales: 'sales' },
          },
        ],
        [
          {
            targetField: 'department',
            fallback: 'error',
            values: { Sales: 'direct_sales' },
          },
        ],
      ),
    ).toEqual([
      {
        targetField: 'department',
        fallback: 'error',
        values: { Marketing: 'marketing', Sales: 'direct_sales' },
      },
    ]);
  });
});
