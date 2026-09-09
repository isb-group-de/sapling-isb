import { describe, expect, it } from '@jest/globals';
import { getSaplingFormLayout } from './global/entity.decorator';
import { InternalCaseItem } from './InternalCaseItem';

describe('InternalCaseItem reference metadata', () => {
  it.each([
    ['salesOpportunity', 500],
    ['ticket', 600],
  ] as const)('exposes %s in the reference group', (field, order) => {
    expect(getSaplingFormLayout(InternalCaseItem.prototype, field)).toEqual(
      expect.objectContaining({
        group: 'internalCase.groupReference',
        formVisible: true,
        tableVisible: false,
        mobileVisible: false,
        order,
      }),
    );
  });
});
