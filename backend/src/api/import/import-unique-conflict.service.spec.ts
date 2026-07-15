import { ImportUniqueConflictService } from './import-unique-conflict.service';

describe('ImportUniqueConflictService', () => {
  function createService(find: jest.Mock = jest.fn(() => Promise.resolve([]))) {
    return new ImportUniqueConflictService(
      { find } as never,
      { getEntityClass: jest.fn(() => class Company {}) } as never,
    );
  }

  it('marks database duplicate values as conflicts by default', async () => {
    const service = createService(
      jest.fn(() => Promise.resolve([{ handle: 5 }])),
    );

    await expect(
      service.applyStrategies(
        [
          { name: 'name', isUnique: true, type: 'string', length: 128 },
        ] as never,
        { name: 'Leibniz' },
        {} as never,
        'company',
        { rowNumber: 2 } as never,
        null,
        { parts: { id: '123' }, hash: 'hash' },
        new Map(),
      ),
    ).rejects.toThrow('import.uniqueFieldConflict:name:Leibniz');
  });

  it('appends the external key when the configured strategy allows it', async () => {
    const service = createService(
      jest.fn((_, criteria: { name?: string }) =>
        Promise.resolve(criteria.name === 'Leibniz' ? [{ handle: 5 }] : []),
      ),
    );
    const payload = { name: 'Leibniz' };

    await service.applyStrategies(
      [{ name: 'name', isUnique: true, type: 'string', length: 128 }] as never,
      payload,
      {
        uniqueConflictStrategies: [
          { targetField: 'name', strategy: 'appendExternalKey' },
        ],
      } as never,
      'company',
      { rowNumber: 2 } as never,
      null,
      { parts: { id: '123' }, hash: 'hash' },
      new Map(),
    );

    expect(payload.name).toBe('Leibniz (123)');
  });

  it('detects duplicate values claimed by an earlier row in the same batch', async () => {
    const service = createService();
    const claims = new Map([['name:leibniz', 2]]);

    await expect(
      service.applyStrategies(
        [{ name: 'name', isUnique: true, type: 'string' }] as never,
        { name: 'Leibniz' },
        {} as never,
        'company',
        { rowNumber: 3 } as never,
        null,
        null,
        claims,
      ),
    ).rejects.toThrow('import.uniqueFieldDuplicateInBatch:name:Leibniz');
  });
});
