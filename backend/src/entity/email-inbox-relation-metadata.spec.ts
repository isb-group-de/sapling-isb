import { Collection } from '@mikro-orm/core';
import { describe, expect, it } from '@jest/globals';

import { EmailInboxSubscriptionItem } from './EmailInboxSubscriptionItem';
import { getSaplingOptions } from './global/entity.decorator';

describe('email inbox relation metadata', () => {
  it('exposes imported emails as a read-only inverse collection', () => {
    const subscription = new EmailInboxSubscriptionItem();

    expect(subscription.inboundEmails).toBeInstanceOf(Collection);
    expect(
      getSaplingOptions(EmailInboxSubscriptionItem.prototype, 'inboundEmails'),
    ).toContain('isReadOnly');
  });
});
