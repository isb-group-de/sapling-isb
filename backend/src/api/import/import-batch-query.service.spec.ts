import { ImportBatchQueryService } from './import-batch-query.service';

describe('ImportBatchQueryService', () => {
  it('loads distinct source values from all import rows with a capped limit', async () => {
    const execute = jest.fn(() =>
      Promise.resolve([{ value: 'Dr.' }, { value: 'Prof.' }, { value: 'Sir' }]),
    );
    const service = new ImportBatchQueryService(
      {
        findOne: jest.fn(() =>
          Promise.resolve({ handle: 42, headers: ['Titel'] }),
        ),
        getConnection: jest.fn(() => ({ execute })),
      } as never,
      {} as never,
    );

    const result = await service.getBatchSourceValues(42, 'Titel', 2);

    expect(result).toEqual({
      values: ['Dr.', 'Prof.'],
      isTruncated: true,
    });
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('distinct'), [
      'Titel',
      42,
      3,
    ]);
  });

  it('rejects source columns that are not part of the analyzed headers', async () => {
    const service = new ImportBatchQueryService(
      {
        findOne: jest.fn(() =>
          Promise.resolve({ handle: 42, headers: ['Titel'] }),
        ),
      } as never,
      {} as never,
    );

    await expect(service.getBatchSourceValues(42, 'Unbekannt')).rejects.toThrow(
      'import.sourceColumnRequired',
    );
  });
});
