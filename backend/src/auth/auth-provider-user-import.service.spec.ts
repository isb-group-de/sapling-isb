import { ForbiddenException } from '@nestjs/common';
import { AuthProviderUserImportService } from './auth-provider-user-import.service';
import { CompanyItem } from '../entity/CompanyItem';
import { PersonItem } from '../entity/PersonItem';
import { PersonSessionItem } from '../entity/PersonSessionItem';
import { PersonTypeItem } from '../entity/PersonTypeItem';
import { RoleItem } from '../entity/RoleItem';
import type { ProviderUserDto } from './dto/provider-user.dto';
import {
  mapAzureUserToProviderUser,
  mapGoogleUserToProviderUser,
  providerUserMatchesSearch,
} from './auth-provider-directory.utils';

type EntityLookup = Record<string, unknown>;

function createRolesCollection(initial: RoleItem[] = []) {
  const items = [...initial];
  return {
    items,
    contains: jest.fn((role: RoleItem) => items.includes(role)),
    add: jest.fn((role: RoleItem) => {
      if (!items.includes(role)) {
        items.push(role);
      }
    }),
  };
}

function createService(overrides: Partial<Record<string, jest.Mock>> = {}) {
  const em = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    persist: jest.fn(),
    flush: jest.fn(),
    ...overrides,
  };

  const directory = {
    getUser: jest.fn(),
    listUsers: jest.fn(),
  };
  return {
    em,
    directory,
    service: new AuthProviderUserImportService(em as never, directory as never),
  };
}

describe('AuthProviderUserImportService', () => {
  it('maps Azure users to provider users', () => {
    const result = mapAzureUserToProviderUser({
      id: 'azure-1',
      displayName: 'Ada Lovelace',
      givenName: 'Ada',
      surname: 'Lovelace',
      mail: null,
      userPrincipalName: 'ada@example.com',
    });

    expect(result).toEqual({
      provider: 'azure',
      id: 'azure-1',
      displayName: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      userPrincipalName: 'ada@example.com',
    });
  });

  it('maps Google users to provider users', () => {
    const result = mapGoogleUserToProviderUser({
      id: 'google-1',
      primaryEmail: 'grace@example.com',
      name: {
        givenName: 'Grace',
        familyName: 'Hopper',
        fullName: 'Grace Hopper',
      },
    });

    expect(result).toEqual({
      provider: 'google',
      id: 'google-1',
      displayName: 'Grace Hopper',
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.com',
      userPrincipalName: 'grace@example.com',
    });
  });

  it('matches provider users by substring across name and email fields', () => {
    const user: ProviderUserDto = {
      provider: 'azure',
      id: 'bc106372-6994-4987-a7cc-c6c9010ca5a7',
      displayName: 'ISB - Kasse',
      firstName: null,
      lastName: null,
      email: 'kasse@isb-solutions.de',
      userPrincipalName: 'kasse@isb-solutions.de',
    };

    expect(providerUserMatchesSearch(user, 'kasse')).toBe(true);
    expect(providerUserMatchesSearch(user, 'solutions')).toBe(true);
    expect(providerUserMatchesSearch(user, 'no-match')).toBe(false);
  });

  it('creates provider people and assigns selected roles', async () => {
    const { em, directory, service } = createService();
    const session = { accessToken: 'token' };
    const personType = { handle: 'azure' } as PersonTypeItem;
    const role = { handle: 7, title: 'Support' } as RoleItem;
    const roles = createRolesCollection();
    const createdPerson = { roles } as unknown as PersonItem;

    em.findOne.mockImplementation((entity: unknown, where: EntityLookup) => {
      if (entity === PersonSessionItem) return Promise.resolve(session);
      if (entity === PersonTypeItem) return Promise.resolve(personType);
      if (entity === PersonItem && 'loginName' in where)
        return Promise.resolve(null);
      if (entity === PersonItem && 'email' in where)
        return Promise.resolve(null);
      return Promise.resolve(null);
    });
    em.find.mockResolvedValue([role]);
    em.create.mockReturnValue(createdPerson);
    directory.getUser.mockResolvedValue({
      provider: 'azure',
      id: 'azure-1',
      displayName: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
    });

    const result = await service.importProviderUsers(
      { handle: 1, type: { handle: 'azure' } } as PersonItem,
      { provider: 'azure', userIds: ['azure-1'], roleHandles: [7] },
    );

    expect(result.created).toBe(1);
    expect(em.create).toHaveBeenCalledWith(
      PersonItem,
      expect.objectContaining({
        loginName: 'azure-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        type: personType,
        isActive: true,
      }),
    );
    expect(roles.add).toHaveBeenCalledWith(role);
    expect(em.persist).toHaveBeenCalledWith(createdPerson);
    expect(em.flush).toHaveBeenCalled();
  });

  it('updates existing provider people and keeps existing roles', async () => {
    const { em, directory, service } = createService();
    const session = { accessToken: 'token' };
    const personType = { handle: 'google' } as PersonTypeItem;
    const existingRole = { handle: 3, title: 'Sales' } as RoleItem;
    const newRole = { handle: 8, title: 'Admin' } as RoleItem;
    const roles = createRolesCollection([existingRole]);
    const existingPerson = {
      handle: 9,
      loginName: 'old',
      firstName: 'Old',
      lastName: 'Name',
      email: 'old@example.com',
      roles,
    } as unknown as PersonItem;

    em.findOne.mockImplementation((entity: unknown, where: EntityLookup) => {
      if (entity === PersonSessionItem) return Promise.resolve(session);
      if (entity === PersonTypeItem) return Promise.resolve(personType);
      if (entity === PersonItem && 'loginName' in where)
        return Promise.resolve(existingPerson);
      return Promise.resolve(null);
    });
    em.find.mockResolvedValue([existingRole, newRole]);
    directory.getUser.mockResolvedValue({
      provider: 'google',
      id: 'google-1',
      displayName: 'Grace Hopper',
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.com',
    });

    const result = await service.importProviderUsers(
      { handle: 1, type: { handle: 'google' } } as PersonItem,
      { provider: 'google', userIds: ['google-1'], roleHandles: [3, 8] },
    );

    expect(result.updated).toBe(1);
    expect(existingPerson.loginName).toBe('google-1');
    expect(existingPerson.firstName).toBe('Grace');
    expect(existingPerson.lastName).toBe('Hopper');
    expect(existingPerson.email).toBe('grace@example.com');
    expect(existingPerson.isActive).toBe(true);
    expect(roles.add).toHaveBeenCalledTimes(1);
    expect(roles.add).toHaveBeenCalledWith(newRole);
  });

  it('assigns the selected company to imported people', async () => {
    const { em, directory, service } = createService();
    const session = { accessToken: 'token' };
    const personType = { handle: 'azure' } as PersonTypeItem;
    const role = { handle: 7, title: 'Support' } as RoleItem;
    const company = { handle: 12, name: 'ISB Solutions' } as CompanyItem;
    const roles = createRolesCollection();
    const createdPerson = { roles } as unknown as PersonItem;

    em.findOne.mockImplementation((entity: unknown, where: EntityLookup) => {
      if (entity === PersonSessionItem) return Promise.resolve(session);
      if (entity === PersonTypeItem) return Promise.resolve(personType);
      if (entity === CompanyItem && where.handle === 12)
        return Promise.resolve(company);
      if (entity === PersonItem && 'loginName' in where)
        return Promise.resolve(null);
      if (entity === PersonItem && 'email' in where)
        return Promise.resolve(null);
      return Promise.resolve(null);
    });
    em.find.mockResolvedValue([role]);
    em.create.mockReturnValue(createdPerson);
    directory.getUser.mockResolvedValue({
      provider: 'azure',
      id: 'azure-1',
      displayName: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
    });

    await service.importProviderUsers(
      { handle: 1, type: { handle: 'azure' } } as PersonItem,
      {
        provider: 'azure',
        userIds: ['azure-1'],
        roleHandles: [7],
        companyHandle: 12,
      },
    );

    expect(em.create).toHaveBeenCalledWith(
      PersonItem,
      expect.objectContaining({
        company,
      }),
    );
  });

  it('rejects importing a provider different from the current login provider', async () => {
    const { service } = createService();

    await expect(
      service.listProviderUsers(
        { handle: 1, type: { handle: 'google' } } as PersonItem,
        'azure',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
