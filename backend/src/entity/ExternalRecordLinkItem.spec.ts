import { ExternalRecordLinkItem } from './ExternalRecordLinkItem';
import { hasSaplingOption } from './global/entity.decorator';

describe('ExternalRecordLinkItem', () => {
  it('keeps external key hashes out of metadata-driven free-text search', () => {
    expect(
      hasSaplingOption(
        ExternalRecordLinkItem.prototype,
        'externalKeyHash',
        'isSearchExcluded',
      ),
    ).toBe(true);
  });
});
