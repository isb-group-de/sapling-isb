import { ChangeLogDetailItem } from './ChangeLogDetailItem';
import { hasSaplingOption } from './global/entity.decorator';

describe('ChangeLogDetailItem', () => {
  it('keeps audit properties out of metadata-driven free-text search', () => {
    expect(
      hasSaplingOption(
        ChangeLogDetailItem.prototype,
        'property',
        'isSearchExcluded',
      ),
    ).toBe(true);
  });
});
