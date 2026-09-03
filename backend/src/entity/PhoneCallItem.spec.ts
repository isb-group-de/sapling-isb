import { describe, expect, it } from '@jest/globals';
import {
  getSaplingFormLayout,
  getSaplingGenericReference,
  getSaplingOptions,
} from './global/entity.decorator';
import { PhoneCallItem } from './PhoneCallItem';

describe('PhoneCallItem metadata', () => {
  it('exposes its source record as a visible generic reference', () => {
    expect(getSaplingOptions(PhoneCallItem.prototype, 'entity')).toEqual(
      expect.arrayContaining(['isEntity', 'isReadOnly']),
    );
    expect(
      getSaplingGenericReference(PhoneCallItem.prototype, 'reference'),
    ).toEqual({
      entityField: 'entity',
      handleField: 'reference',
    });
    expect(getSaplingFormLayout(PhoneCallItem.prototype, 'reference')).toEqual(
      expect.objectContaining({
        group: 'phoneCall.groupReference',
        formVisible: true,
        tableVisible: true,
        mobileVisible: true,
      }),
    );
  });
});
