import { describe, expect, it } from '@jest/globals';
import { getEntityHandleByTableName } from './entity-table-name.util';

describe('getEntityHandleByTableName', () => {
  it.each([
    ['event_delivery_item', 'eventDelivery'],
    ['email_list_item', 'emailList'],
    ['favorite_item', 'favorite'],
    ['public.event_delivery_item', 'eventDelivery'],
    ['webhook_authentication_oauth2item', 'webhookAuthenticationOAuth2'],
    ['"event_delivery_item"', 'eventDelivery'],
  ])('maps %s to %s', (tableName, entityHandle) => {
    expect(getEntityHandleByTableName(tableName)).toBe(entityHandle);
  });

  it('does not expose unknown database tables as entity handles', () => {
    expect(getEntityHandleByTableName('internal_join_table')).toBeUndefined();
  });
});
