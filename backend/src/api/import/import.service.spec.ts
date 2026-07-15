import { ImportService } from './import.service';

describe('ImportService', () => {
  function createService(
    em: unknown = { findOne: jest.fn() },
    importBatchQueryService: unknown = {},
  ) {
    return new ImportService(
      em as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      importBatchQueryService as never,
      {} as never,
    );
  }

  it('delegates source-value queries to the batch query service', async () => {
    const getBatchSourceValues = jest.fn(() =>
      Promise.resolve({ values: ['Dr.', 'Prof.'], isTruncated: true }),
    );
    const service = createService({}, { getBatchSourceValues });

    const result = await service.getBatchSourceValues(42, 'Titel', 2);

    expect(result).toEqual({
      values: ['Dr.', 'Prof.'],
      isTruncated: true,
    });
    expect(getBatchSourceValues).toHaveBeenCalledWith(42, 'Titel', 2);
  });

  it('merges template value mappings with partial batch overrides', () => {
    const service = createService();

    const result = (
      service as unknown as {
        mergeValueMappings(
          baseMappings: unknown[],
          overrideMappings: unknown[],
        ): unknown[];
      }
    ).mergeValueMappings(
      [
        {
          targetField: 'department',
          fallback: 'keep',
          values: {
            Marketing: 'marketing',
            Produktion: 'production',
            Vertrieb: 'sales',
          },
        },
      ],
      [
        {
          targetField: 'department',
          fallback: 'error',
          values: {
            Vertrieb: 'direct_sales',
          },
        },
      ],
    );

    expect(result).toEqual([
      {
        targetField: 'department',
        fallback: 'error',
        values: {
          Marketing: 'marketing',
          Produktion: 'production',
          Vertrieb: 'direct_sales',
        },
      },
    ]);
  });
});
