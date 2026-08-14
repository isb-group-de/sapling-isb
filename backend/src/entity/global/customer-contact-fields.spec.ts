import { describe, expect, it } from '@jest/globals';

import { EffortEstimateItem } from '../EffortEstimateItem';
import { SalesOpportunityItem } from '../SalesOpportunityItem';
import { TicketItem } from '../TicketItem';
import { getSaplingFormLayout, hasSaplingOption } from './entity.decorator';

type CustomerContactEntityClass = {
  prototype: {
    creatorPersonEmail?: string;
    creatorPersonPhone?: string;
  };
};

describe('customer contact display fields', () => {
  it.each([
    ['ticket', TicketItem, 'ticket.groupReference', 803, 804],
    [
      'salesOpportunity',
      SalesOpportunityItem,
      'salesOpportunity.groupReference',
      703,
      704,
    ],
    [
      'effortEstimate',
      EffortEstimateItem,
      'effortEstimate.groupReference',
      403,
      404,
    ],
  ])(
    'shows the %s customer email and phone in forms and desktop tables',
    (_entityHandle, EntityClass, group, emailOrder, phoneOrder) => {
      const typedEntityClass = EntityClass as CustomerContactEntityClass;
      const emailLayout = getSaplingFormLayout(
        typedEntityClass.prototype,
        'creatorPersonEmail',
      );
      const phoneLayout = getSaplingFormLayout(
        typedEntityClass.prototype,
        'creatorPersonPhone',
      );

      expect(emailLayout).toMatchObject({
        formVisible: true,
        group,
        order: emailOrder,
        tableOrder: emailOrder,
        tableVisible: true,
        width: 1,
      });
      expect(phoneLayout).toMatchObject({
        formVisible: true,
        group,
        order: phoneOrder,
        tableOrder: phoneOrder,
        tableVisible: true,
        width: 1,
      });
      expect(
        hasSaplingOption(
          typedEntityClass.prototype,
          'creatorPersonEmail',
          'isMail',
        ),
      ).toBe(true);
      expect(
        hasSaplingOption(
          typedEntityClass.prototype,
          'creatorPersonPhone',
          'isPhone',
        ),
      ).toBe(true);

      const instance = Object.create(typedEntityClass.prototype) as {
        creatorPerson: { email: string; phone: string };
        creatorPersonEmail: string;
        creatorPersonPhone: string;
      };
      instance.creatorPerson = {
        email: 'customer@example.com',
        phone: '+49 30 1234567',
      };
      expect(instance.creatorPersonEmail).toBe('customer@example.com');
      expect(instance.creatorPersonPhone).toBe('+49 30 1234567');
    },
  );

  it('shows the SLA policy in the default ticket table', () => {
    expect(
      getSaplingFormLayout(TicketItem.prototype, 'slaPolicy'),
    ).toMatchObject({
      formVisible: true,
      tableVisible: true,
    });
  });
});
