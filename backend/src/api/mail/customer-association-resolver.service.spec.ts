import { describe, expect, it, jest } from '@jest/globals';
import { CompanyItem } from '../../entity/CompanyItem';
import { PersonItem } from '../../entity/PersonItem';
import { CustomerAssociationResolverService } from './customer-association-resolver.service';

describe('CustomerAssociationResolverService', () => {
  it('resolves a person together with its company', async () => {
    const company = Object.assign(new CompanyItem(), { handle: 10 });
    const person = Object.assign(new PersonItem(), { handle: 20, company });
    const em = {
      findOne: jest.fn(
        async (_entity: unknown, _where: unknown, _options?: unknown) => person,
      ),
    };
    const service = new CustomerAssociationResolverService({} as never);

    await expect(service.resolve(em as never, 'person', 20)).resolves.toEqual({
      company,
      person,
    });
    expect(em.findOne).toHaveBeenCalledWith(
      PersonItem,
      { handle: 20 },
      { populate: ['company'] },
    );
  });

  it('ignores internal assignee links and selects customer-marked links', async () => {
    const internalCompany = Object.assign(new CompanyItem(), { handle: 99 });
    const customerCompany = Object.assign(new CompanyItem(), { handle: 10 });
    const customerPerson = Object.assign(new PersonItem(), {
      handle: 20,
      company: customerCompany,
    });
    const templateService = {
      getEntityTemplate: jest.fn(() => [
        { name: 'assigneeCompany', referenceName: 'company' },
        { name: 'assigneePerson', referenceName: 'person' },
        { name: 'creatorCompany', referenceName: 'company' },
        { name: 'creatorPerson', referenceName: 'person' },
      ]),
    };
    const em = {
      findOne: jest.fn(
        async (_entity: unknown, _where: unknown, _options?: unknown) => ({
          assigneeCompany: internalCompany,
          creatorCompany: customerCompany,
          creatorPerson: customerPerson,
        }),
      ),
    };
    const service = new CustomerAssociationResolverService(
      templateService as never,
    );

    await expect(service.resolve(em as never, 'ticket', 1)).resolves.toEqual({
      company: customerCompany,
      person: customerPerson,
    });
    expect(em.findOne).toHaveBeenCalledWith(
      expect.any(Function),
      { handle: 1 },
      {
        populate: ['creatorCompany', 'creatorPerson', 'creatorPerson.company'],
      },
    );
  });

  it('returns an empty association for unknown or empty references', async () => {
    const service = new CustomerAssociationResolverService({} as never);
    await expect(service.resolve({} as never, 'ticket', null)).resolves.toEqual(
      {
        company: null,
        person: null,
      },
    );
    await expect(service.resolve({} as never, 'unknown', 1)).resolves.toEqual({
      company: null,
      person: null,
    });
  });
});
