import { describe, expect, it } from '@jest/globals';

import { TicketItem } from './TicketItem';
import {
  getSaplingOptions,
  getSaplingReferenceDependency,
} from './global/entity.decorator';

describe('TicketItem', () => {
  it('marks the dependent contract selection as recommended', () => {
    expect(getSaplingOptions(TicketItem.prototype, 'contract')).toContain(
      'isRecommended',
    );
    expect(
      getSaplingReferenceDependency(TicketItem.prototype, 'contract'),
    ).toEqual({
      parentField: 'creatorCompany',
      targetField: 'company',
      clearOnParentChange: true,
    });
  });
});
