import { describe, expect, it } from '@jest/globals';

import { AddressItem } from '../AddressItem';
import { CompanyItem } from '../CompanyItem';
import { CompanyRelationshipItem } from '../CompanyRelationshipItem';
import { ContractItem } from '../ContractItem';
import { EffortEstimateItem } from '../EffortEstimateItem';
import { EmailDeliveryItem } from '../EmailDeliveryItem';
import { EventItem } from '../EventItem';
import { InboundEmailItem } from '../InboundEmailItem';
import { InternalCaseItem } from '../InternalCaseItem';
import { PersonItem } from '../PersonItem';
import { SalesOpportunityItem } from '../SalesOpportunityItem';
import { ServerLandscapeItem } from '../ServerLandscapeItem';
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
    ['address', AddressItem, 'company', 'companyEmail'],
    ['company', CompanyItem, 'serviceProvider', 'serviceProviderEmail'],
    [
      'companyRelationship',
      CompanyRelationshipItem,
      'sourceCompany',
      'sourceCompanyEmail',
    ],
    [
      'companyRelationship',
      CompanyRelationshipItem,
      'targetCompany',
      'targetCompanyEmail',
    ],
    ['contract', ContractItem, 'company', 'companyEmail'],
    [
      'effortEstimate',
      EffortEstimateItem,
      'assigneeCompany',
      'assigneeCompanyEmail',
    ],
    [
      'effortEstimate',
      EffortEstimateItem,
      'creatorCompany',
      'creatorCompanyEmail',
    ],
    [
      'emailDelivery',
      EmailDeliveryItem,
      'customerCompany',
      'customerCompanyEmail',
    ],
    ['event', EventItem, 'assigneeCompany', 'assigneeCompanyEmail'],
    ['event', EventItem, 'creatorCompany', 'creatorCompanyEmail'],
    ['inboundEmail', InboundEmailItem, 'company', 'companyEmail'],
    [
      'internalCase',
      InternalCaseItem,
      'customerCompany',
      'customerCompanyEmail',
    ],
    [
      'internalCase',
      InternalCaseItem,
      'responsibleCompany',
      'responsibleCompanyEmail',
    ],
    ['person', PersonItem, 'company', 'companyEmail'],
    [
      'salesOpportunity',
      SalesOpportunityItem,
      'assigneeCompany',
      'assigneeCompanyEmail',
    ],
    [
      'salesOpportunity',
      SalesOpportunityItem,
      'creatorCompany',
      'creatorCompanyEmail',
    ],
    ['serverLandscape', ServerLandscapeItem, 'company', 'companyEmail'],
    ['ticket', TicketItem, 'assigneeCompany', 'assigneeCompanyEmail'],
    ['ticket', TicketItem, 'creatorCompany', 'creatorCompanyEmail'],
  ])(
    'projects the %s.%s company email as a visible mail field',
    (_entityHandle, EntityClass, relationName, emailFieldName) => {
      const prototype = EntityClass.prototype as unknown as Record<
        string,
        unknown
      >;
      const layout = getSaplingFormLayout(prototype, emailFieldName);

      expect(hasSaplingOption(prototype, emailFieldName, 'isMail')).toBe(true);
      expect(hasSaplingOption(prototype, emailFieldName, 'isReadOnly')).toBe(
        true,
      );
      expect(layout).toMatchObject({
        formVisible: true,
        tableVisible: true,
        mobileVisible: false,
      });

      const instance = Object.create(prototype) as Record<string, unknown>;
      instance[relationName] = { email: 'company@example.com' };
      expect(instance[emailFieldName]).toBe('company@example.com');
    },
  );

  it('marks the Office task company and person as customer-side references', () => {
    expect(
      hasSaplingOption(
        InternalCaseItem.prototype,
        'customerCompany',
        'isCustomer',
      ),
    ).toBe(true);
    expect(
      hasSaplingOption(
        InternalCaseItem.prototype,
        'customerPerson',
        'isCustomer',
      ),
    ).toBe(true);
  });

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
