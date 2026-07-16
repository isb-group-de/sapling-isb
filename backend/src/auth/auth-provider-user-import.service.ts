import { EntityManager } from '@mikro-orm/core';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CompanyItem } from '../entity/CompanyItem';
import { PersonItem } from '../entity/PersonItem';
import { PersonSessionItem } from '../entity/PersonSessionItem';
import { PersonTypeItem } from '../entity/PersonTypeItem';
import { RoleItem } from '../entity/RoleItem';
import { AuthProviderDirectoryService } from './auth-provider-directory.service';
import { normalizeProviderEmail } from './auth-provider-directory.utils';
import {
  ImportProviderUsersDto,
  ProviderUserDto,
  ProviderUserImportResponseDto,
  ProviderUserImportRowDto,
  ProviderUserListResponseDto,
  ProviderUserProvider,
} from './dto/provider-user.dto';

@Injectable()
export class AuthProviderUserImportService {
  constructor(
    private readonly em: EntityManager,
    private readonly directory: AuthProviderDirectoryService,
  ) {}

  async listProviderUsers(
    currentUser: PersonItem,
    provider: ProviderUserProvider,
    options: { search?: string; pageToken?: string } = {},
  ): Promise<ProviderUserListResponseDto> {
    this.assertCurrentUserCanUseProvider(currentUser, provider);
    const session = await this.getCurrentProviderSession(currentUser, provider);
    const users = await this.directory.listUsers(provider, session, options);

    await this.em.flush();
    users.users = await this.annotateExistingPeople(users.users);
    return users;
  }

  async importProviderUsers(
    currentUser: PersonItem,
    dto: ImportProviderUsersDto,
  ): Promise<ProviderUserImportResponseDto> {
    this.assertCurrentUserCanUseProvider(currentUser, dto.provider);
    const session = await this.getCurrentProviderSession(
      currentUser,
      dto.provider,
    );
    const { roles, personType, company } = await this.loadImportReferences(dto);
    const result: ProviderUserImportResponseDto = {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      rows: [],
    };

    for (const providerUserId of Array.from(new Set(dto.userIds))) {
      const row = await this.importOneProviderUser(
        session,
        dto.provider,
        providerUserId,
        personType,
        roles,
        company,
      );
      result.rows.push(row);
      result[row.action] += 1;
    }

    await this.em.flush();
    return result;
  }

  private async loadImportReferences(dto: ImportProviderUsersDto): Promise<{
    roles: RoleItem[];
    personType: PersonTypeItem;
    company: CompanyItem | null;
  }> {
    const roleHandles = Array.from(new Set(dto.roleHandles));
    const roles = await this.em.find(RoleItem, {
      handle: { $in: roleHandles },
    });
    if (roles.length !== roleHandles.length) {
      throw new BadRequestException('providerUserImport.rolesNotFound');
    }

    const personType = await this.em.findOne(PersonTypeItem, {
      handle: dto.provider,
    });
    if (!personType) {
      throw new BadRequestException('providerUserImport.personTypeMissing');
    }

    const company = dto.companyHandle
      ? await this.em.findOne(CompanyItem, { handle: dto.companyHandle })
      : null;
    if (dto.companyHandle && !company) {
      throw new BadRequestException('providerUserImport.companyNotFound');
    }
    return { roles, personType, company };
  }

  private async importOneProviderUser(
    session: PersonSessionItem,
    provider: ProviderUserProvider,
    providerUserId: string,
    personType: PersonTypeItem,
    roles: RoleItem[],
    company: CompanyItem | null,
  ): Promise<ProviderUserImportRowDto> {
    try {
      const providerUser = await this.directory.getUser(
        provider,
        session,
        providerUserId,
      );
      if (!providerUser.id) {
        return {
          providerUserId,
          action: 'skipped',
          message: 'providerUserImport.providerUserMissingId',
        };
      }

      const { person, action } = await this.upsertPersonFromProviderUser(
        providerUser,
        personType,
        roles,
        company,
      );
      return {
        providerUserId,
        action,
        personHandle: person.handle ?? null,
        displayName: providerUser.displayName,
        email: providerUser.email,
      };
    } catch (error) {
      return {
        providerUserId,
        action: 'failed',
        message:
          error instanceof Error
            ? error.message
            : 'providerUserImport.importFailed',
      };
    }
  }

  private async upsertPersonFromProviderUser(
    providerUser: ProviderUserDto,
    personType: PersonTypeItem,
    roles: RoleItem[],
    company: CompanyItem | null,
  ): Promise<{ person: PersonItem; action: 'created' | 'updated' }> {
    const externalId = providerUser.id.trim();
    const email = normalizeProviderEmail(providerUser.email);
    let person = (await this.em.findOne(
      PersonItem,
      { loginName: externalId },
      { populate: ['roles', 'type'] },
    )) as PersonItem | null;

    if (!person && email) {
      person = await this.em.findOne(
        PersonItem,
        { email },
        { populate: ['roles', 'type'] },
      );
    }

    const names = this.resolvePersonNames(providerUser);
    const action = person ? 'updated' : 'created';
    if (!person) {
      person = this.em.create(PersonItem, {
        loginName: externalId,
        firstName: names.firstName,
        lastName: names.lastName,
        email: email ?? undefined,
        type: personType,
        company: company ?? undefined,
        isActive: true,
      });
      this.em.persist(person);
    } else {
      person.loginName = externalId;
      person.firstName = names.firstName;
      person.lastName = names.lastName;
      person.email = email ?? person.email;
      person.type = personType;
      if (company) person.company = company;
      person.isActive = true;
    }

    for (const role of roles) {
      if (!person.roles.contains(role)) person.roles.add(role);
    }
    return { person, action };
  }

  private resolvePersonNames(providerUser: ProviderUserDto): {
    firstName: string;
    lastName: string;
  } {
    const displayName = providerUser.displayName.trim();
    const fallbackLabel =
      displayName ||
      providerUser.email?.trim() ||
      providerUser.userPrincipalName?.trim() ||
      providerUser.id.trim();
    const parts = fallbackLabel.split(/\s+/).filter(Boolean);
    const firstName =
      providerUser.firstName?.trim() ||
      (parts.length > 1 ? parts.slice(0, -1).join(' ') : fallbackLabel);
    const lastName =
      providerUser.lastName?.trim() ||
      (parts.length > 1 ? parts[parts.length - 1] : fallbackLabel);
    return {
      firstName: truncate(firstName, 64),
      lastName: truncate(lastName, 64),
    };
  }

  private async annotateExistingPeople(
    users: ProviderUserDto[],
  ): Promise<ProviderUserDto[]> {
    const ids = users.map((user) => user.id).filter(Boolean);
    const emails = users
      .map((user) => normalizeProviderEmail(user.email))
      .filter((email): email is string => Boolean(email));
    const people =
      ids.length || emails.length
        ? await this.em.find(PersonItem, {
            $or: [
              ...(ids.length ? [{ loginName: { $in: ids } }] : []),
              ...(emails.length ? [{ email: { $in: emails } }] : []),
            ],
          })
        : [];

    return users.map((user) => {
      const normalizedEmail = normalizeProviderEmail(user.email);
      const existing = people.find(
        (person) =>
          person.loginName === user.id ||
          (normalizedEmail &&
            normalizeProviderEmail(person.email) === normalizedEmail),
      );
      return { ...user, existingPersonHandle: existing?.handle ?? null };
    });
  }

  private assertCurrentUserCanUseProvider(
    currentUser: PersonItem,
    provider: ProviderUserProvider,
  ): void {
    if (currentUser.type?.handle !== provider) {
      throw new ForbiddenException(
        provider === 'azure'
          ? 'providerUserImport.azureUserRequired'
          : 'providerUserImport.googleUserRequired',
      );
    }
  }

  private async getCurrentProviderSession(
    currentUser: PersonItem,
    provider: ProviderUserProvider,
  ): Promise<PersonSessionItem> {
    const session = await this.em.findOne(PersonSessionItem, {
      person: { handle: currentUser.handle },
    });
    if (!session) {
      throw new UnauthorizedException(
        provider === 'azure'
          ? 'providerUserImport.azureSessionNotFound'
          : 'providerUserImport.googleSessionNotFound',
      );
    }
    return session;
  }
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}
