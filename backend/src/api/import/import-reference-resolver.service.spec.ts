import { ImportReferenceResolverService } from './import-reference-resolver.service';

describe('ImportReferenceResolverService', () => {
  function createService() {
    const em = {
      find: jest.fn(),
      findOne: jest.fn(),
      getConnection: jest.fn(),
    };
    const genericQueryService = {
      getEntityClass: jest.fn(() => class Status {}),
    };
    const templateService = {
      getEntityTemplate: jest.fn(() => [
        { name: 'name', options: ['isValue'] },
      ]),
    };
    return {
      service: new ImportReferenceResolverService(
        em as never,
        genericQueryService as never,
        templateService as never,
      ),
      em,
    };
  }

  it('builds deterministic external keys from normalized columns and values', () => {
    const { service } = createService();

    const first = service.buildExternalKey(
      'erp',
      'company',
      [' External Id ', 'External Id'],
      { 'External Id': 42 },
    );
    const second = service.buildExternalKey('erp', 'company', ['External Id'], {
      'External Id': 42,
    });

    expect(first).toEqual(second);
    expect(first.parts).toEqual({ 'External Id': '42' });
    expect(first.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('resolves reference values through the metadata value field', async () => {
    const { service, em } = createService();
    em.find.mockResolvedValue([{ handle: 5, name: 'Open' }]);

    await expect(
      service.resolveValueReference('ticketStatus', ' Open '),
    ).resolves.toBe(5);
    expect(em.find).toHaveBeenCalledWith(
      expect.any(Function),
      { name: 'Open' },
      { limit: 2 },
    );
  });

  it('rejects incomplete external keys before querying links', () => {
    const { service } = createService();

    expect(() =>
      service.buildExternalKey('erp', 'company', ['External Id'], {
        'External Id': '',
      }),
    ).toThrow('import.externalKeyValueMissing');
  });
});
