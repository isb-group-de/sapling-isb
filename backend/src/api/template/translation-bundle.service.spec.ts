import { TranslationBundleService } from './translation-bundle.service';

describe('Translation bundles', () => {
  it('returns more than a generic page in one query and excludes persistence fields', async () => {
    const find = jest.fn().mockResolvedValue(
      Array.from({ length: 501 }, (_, i) => ({
        entity: 'ticket',
        property: `p${i}`,
        value: `v${i}`,
      })),
    );
    const result = await new TranslationBundleService({ find } as never).load(
      'de',
      'ticket,ticket',
    );
    expect(Object.keys(result.messages.ticket)).toHaveLength(501);
    expect(find).toHaveBeenCalledTimes(1);
    expect(result.etag).toMatch(/^"[a-f0-9]{64}"$/);
  });

  it('revalidates against current rows so update and delete change the ETag', async () => {
    const find = jest
      .fn()
      .mockResolvedValueOnce([
        { entity: 'ticket', property: 'title', value: 'A' },
      ])
      .mockResolvedValueOnce([
        { entity: 'ticket', property: 'title', value: 'B' },
      ])
      .mockResolvedValueOnce([]);
    const service = new TranslationBundleService({ find } as never);
    const tags = await Promise.all([
      service.load('de', 'ticket'),
      service.load('de', 'ticket'),
      service.load('de', 'ticket'),
    ]);
    expect(new Set(tags.map((bundle) => bundle.etag)).size).toBe(3);
  });

  it('rejects unbounded or malformed requests before querying', async () => {
    const find = jest.fn();
    const service = new TranslationBundleService({ find } as never);
    await expect(service.load('de', '')).rejects.toThrow();
    await expect(
      service.load(
        'de',
        Array.from({ length: 101 }, (_, i) => `n${i}`).join(','),
      ),
    ).rejects.toThrow();
    expect(find).not.toHaveBeenCalled();
  });
});
