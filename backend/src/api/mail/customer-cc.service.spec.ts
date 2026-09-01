import { CompanyItem } from '../../entity/CompanyItem';
import {
  CustomerCcService,
  findMissingCcRecipients,
} from './customer-cc.service';

describe('CustomerCcService', () => {
  it('returns active configured people with valid, unique email addresses', async () => {
    const company = Object.assign(new CompanyItem(), { handle: 10 });
    const configuredCompany = {
      automaticCcPersons: {
        getItems: () => [
          { email: 'first@example.test', isActive: true },
          { email: 'FIRST@example.test', isActive: true },
          { email: 'inactive@example.test', isActive: false },
          { email: 'invalid address', isActive: true },
          { email: 'bcc@example.test', isActive: true },
        ],
      },
    };
    const em = { findOne: jest.fn().mockResolvedValue(configuredCompany) };
    const resolver = {
      resolve: jest.fn().mockResolvedValue({ company, person: null }),
    };
    const service = new CustomerCcService(resolver as never);

    await expect(
      service.resolveAdditionalCc(em as never, {
        entityHandle: 'ticket',
        itemHandle: 5,
        to: ['customer@example.test'],
        bcc: ['Recipient <BCC@example.test>'],
      }),
    ).resolves.toEqual(['first@example.test']);
    expect(em.findOne).toHaveBeenCalledWith(
      CompanyItem,
      { handle: 10 },
      { populate: ['automaticCcPersons'] },
    );
  });

  it('returns no recipients when the context has no customer company', async () => {
    const em = { findOne: jest.fn() };
    const resolver = {
      resolve: jest.fn().mockResolvedValue({ company: null, person: null }),
    };
    const service = new CustomerCcService(resolver as never);

    await expect(
      service.resolveAdditionalCc(em as never, { entityHandle: 'ticket' }),
    ).resolves.toEqual([]);
    expect(em.findOne).not.toHaveBeenCalled();
  });
});

describe('findMissingCcRecipients', () => {
  it('does not add an address already present in To, CC, or BCC', () => {
    expect(
      findMissingCcRecipients(
        [
          'TO@example.test',
          'cc@example.test',
          'bcc@example.test',
          'new@example.test',
          'NEW@example.test',
        ],
        {
          to: ['Name <to@example.test>'],
          cc: ['CC@example.test'],
          bcc: ['bcc@example.test'],
        },
      ),
    ).toEqual(['new@example.test']);
  });
});
