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
    ['ticket', TicketItem, 'creatorCompany', 'isCompany'],
    ['ticket', TicketItem, 'creatorPerson', 'isPerson'],
    ['event', EventItem, 'creatorCompany', 'isCompany'],
    ['event', EventItem, 'creatorPerson', 'isPerson'],
    ['salesOpportunity', SalesOpportunityItem, 'creatorCompany', 'isCompany'],
    ['salesOpportunity', SalesOpportunityItem, 'creatorPerson', 'isPerson'],
    ['effortEstimate', EffortEstimateItem, 'creatorCompany', 'isCompany'],
    ['effortEstimate', EffortEstimateItem, 'creatorPerson', 'isPerson'],
  ] as const)(
    'marks %s.%s as a customer reference without defaulting to the current user or company',
    (_entityHandle, EntityClass, fieldName, referenceOption) => {
      const prototype = EntityClass.prototype;

      expect(hasSaplingOption(prototype, fieldName, 'isCustomer')).toBe(true);
      expect(hasSaplingOption(prototype, fieldName, referenceOption)).toBe(
        true,
      );
      expect(hasSaplingOption(prototype, fieldName, 'isCurrentCompany')).toBe(
        false,
      );
      expect(hasSaplingOption(prototype, fieldName, 'isCurrentPerson')).toBe(
        false,
      );
    },
  );

  it.each([
    ['address', AddressItem, 'company', 'companyEmail', 10000],
    ['company', CompanyItem, 'serviceProvider', 'serviceProviderEmail', 10000],
    [
      'companyRelationship',
      CompanyRelationshipItem,
      'sourceCompany',
      'sourceCompanyEmail',
      10000,
    ],
    [
      'companyRelationship',
      CompanyRelationshipItem,
      'targetCompany',
      'targetCompanyEmail',
      10001,
    ],
    ['contract', ContractItem, 'company', 'companyEmail', 10000],
    [
      'effortEstimate',
      EffortEstimateItem,
      'assigneeCompany',
      'assigneeCompanyEmail',
      10000,
    ],
    [
      'effortEstimate',
      EffortEstimateItem,
      'creatorCompany',
      'creatorCompanyEmail',
      10001,
    ],
    [
      'emailDelivery',
      EmailDeliveryItem,
      'customerCompany',
      'customerCompanyEmail',
      10000,
    ],
    ['event', EventItem, 'assigneeCompany', 'assigneeCompanyEmail', 10000],
    ['event', EventItem, 'creatorCompany', 'creatorCompanyEmail', 10001],
    ['inboundEmail', InboundEmailItem, 'company', 'companyEmail', 10000],
    [
      'internalCase',
      InternalCaseItem,
      'customerCompany',
      'customerCompanyEmail',
      10000,
    ],
    [
      'internalCase',
      InternalCaseItem,
      'responsibleCompany',
      'responsibleCompanyEmail',
      10001,
    ],
    ['person', PersonItem, 'company', 'companyEmail', 10000],
    [
      'salesOpportunity',
      SalesOpportunityItem,
      'assigneeCompany',
      'assigneeCompanyEmail',
      10000,
    ],
    [
      'salesOpportunity',
      SalesOpportunityItem,
      'creatorCompany',
      'creatorCompanyEmail',
      10001,
    ],
    ['serverLandscape', ServerLandscapeItem, 'company', 'companyEmail', 10000],
    ['ticket', TicketItem, 'assigneeCompany', 'assigneeCompanyEmail', 10000],
    ['ticket', TicketItem, 'creatorCompany', 'creatorCompanyEmail', 10001],
  ])(
    'projects the %s.%s company email as a visible mail field',
    (
      _entityHandle,
      EntityClass,
      relationName,
      emailFieldName,
      expectedOrder,
    ) => {
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
        order: expectedOrder,
        tableOrder: expectedOrder,
        tableVisible: true,
        mobileOrder: expectedOrder,
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
