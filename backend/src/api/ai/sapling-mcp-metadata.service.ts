import { ForbiddenException, Injectable } from '@nestjs/common';
import { PersonItem } from '../../entity/PersonItem';
import { ENTITY_HANDLES } from '../../entity/global/entity.registry';
import { CurrentService } from '../current/current.service';
import { TemplateService } from '../template/template.service';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import type { McpToolPolicy } from './mcp-policy.types';
import { SaplingMcpCriteriaService } from './sapling-mcp-criteria.service';
import { SaplingMcpValueService } from './sapling-mcp-value.service';
import { SAPLING_MCP_USAGE_HINTS } from './prompts/sapling-mcp.prompts';
import { FieldPermissionService } from '../current/field-permission.service';
@Injectable()
export class SaplingMcpMetadataService {
  constructor(
    private readonly currentService: CurrentService,
    private readonly templateService: TemplateService,
    private readonly criteriaService: SaplingMcpCriteriaService,
    private readonly values: SaplingMcpValueService,
    private readonly fieldPermissions: FieldPermissionService = {
      applyTemplateAccess: (_user, _entityHandle, templates) => templates,
      getTemplates: (entityHandle) =>
        Promise.resolve(
          this.templateService
            .getEntityTemplate(entityHandle)
            .filter((field) => !field.options?.includes('isSecurity')),
        ),
    } as unknown as FieldPermissionService,
  ) {}
  async executeCurrentPerson(user: PersonItem): Promise<unknown> {
    const person = (await this.currentService.getPerson(user)) ?? user;
    const personRecord = person as unknown as Record<string, unknown>;
    const company = this.values.asEntityRecord(personRecord.company);
    const department = this.values.asEntityRecord(personRecord.department);
    const language = this.values.asEntityRecord(personRecord.language);
    const type = this.values.asEntityRecord(personRecord.type);
    const workWeek = this.values.asEntityRecord(personRecord.workWeek);
    const roles = this.values
      .asCollectionRecords(personRecord.roles)
      .map((role) => {
        const stage = this.values.asEntityRecord(role.stage);
        const projectedRole = this.projectMcpRelation(user, 'role', role, [
          'handle',
          'title',
        ]);
        if (this.getReadableFieldNames(user, 'role').has('stage')) {
          projectedRole.stage = stage
            ? this.projectMcpRelation(user, 'roleStage', stage, [
                'handle',
                'title',
              ])
            : null;
        }
        return projectedRole;
      });

    const readable = this.getReadableFieldNames(user, 'person');
    const personPayload: Record<string, unknown> = {};
    if (readable.has('handle')) personPayload.handle = person.handle ?? null;
    if (readable.has('firstName') || readable.has('lastName')) {
      personPayload.fullName =
        `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim();
    }
    for (const fieldName of [
      'firstName',
      'lastName',
      'loginName',
      'email',
      'phone',
      'mobile',
      'isActive',
      'requirePasswordChange',
    ] as const) {
      if (readable.has(fieldName))
        personPayload[fieldName] = person[fieldName] ?? null;
    }
    if (readable.has('company')) {
      personPayload.company = company
        ? this.projectMcpRelation(user, 'company', company, [
            'handle',
            'name',
            'city',
            'email',
          ])
        : null;
    }
    if (readable.has('department')) {
      personPayload.department = department
        ? this.projectMcpRelation(user, 'personDepartment', department, [
            'handle',
            'description',
            'title',
          ])
        : null;
    }
    if (readable.has('language')) {
      personPayload.language = language
        ? this.projectMcpRelation(user, 'language', language, [
            'handle',
            'name',
          ])
        : null;
    }
    if (readable.has('type')) {
      personPayload.type = type
        ? this.projectMcpRelation(user, 'personType', type, [
            'handle',
            'description',
            'title',
          ])
        : null;
    }
    if (readable.has('workWeek')) {
      personPayload.workWeek = workWeek
        ? this.projectMcpRelation(user, 'workHourWeek', workWeek, [
            'handle',
            'title',
          ])
        : null;
    }
    if (readable.has('roles')) personPayload.roles = roles;

    return {
      person: {
        ...personPayload,
      },
      usageHints: [...SAPLING_MCP_USAGE_HINTS.currentPerson],
    };
  }

  executeEntityCatalog(
    policy?: McpToolPolicy,
    user?: PersonItem,
  ): { entities: string[] } {
    return {
      entities: this.values
        .filterPolicyEntityHandles([...ENTITY_HANDLES], policy)
        .filter(
          (entityHandle) =>
            !user || this.getUserEntityTemplate(entityHandle, user).length > 0,
        )
        .sort((left, right) => left.localeCompare(right)),
    };
  }

  async executeEntitySchema(
    args: Record<string, unknown>,
    policy?: McpToolPolicy,
    user?: PersonItem,
  ): Promise<{
    entityHandle: string;
    fields: Array<{
      name: string;
      type: string;
      kind: string | null | undefined;
      referenceName: string;
      isReference: boolean;
      isPrimaryKey: boolean;
      isAutoIncrement: boolean;
      isRequired: boolean;
      nullable: boolean;
      default: unknown;
      defaultRaw: string | null;
      options: string[];
      mappedBy?: string | null;
      inversedBy?: string | null;
      referenceDependency?: Record<string, unknown> | null;
      fieldAccess?: EntityTemplateDto['fieldAccess'];
    }>;
    relationNames: string[];
    requiredFieldNames: string[];
    filterOperators: string[];
    usageHints: string[];
  }> {
    const entityHandle = this.values.requireStringArg(
      args.entityHandle,
      'entityHandle',
    );
    this.values.assertEntityAllowed(entityHandle, policy);
    const template = await this.getUserEntityTemplateWithCustomFields(
      entityHandle,
      user,
    );
    if (user && template.length === 0) {
      throw new ForbiddenException('global.fieldPermissionDenied');
    }

    return {
      entityHandle,
      fields: template.map((field) => ({
        name: field.name,
        type: field.type,
        kind: field.kind,
        referenceName: field.referenceName,
        isReference: field.isReference,
        isPrimaryKey: field.isPrimaryKey,
        isAutoIncrement: field.isAutoIncrement,
        isRequired: field.isRequired,
        nullable: field.nullable,
        default: (field.default as unknown) ?? null,
        defaultRaw: field.defaultRaw ?? null,
        options: [...field.options],
        mappedBy: field.mappedBy,
        inversedBy: field.inversedBy,
        referenceDependency: field.referenceDependency
          ? { ...field.referenceDependency }
          : null,
        fieldAccess: field.fieldAccess ? { ...field.fieldAccess } : undefined,
      })),
      relationNames: template
        .filter((field) => field.isReference)
        .map((field) => field.name),
      requiredFieldNames: template
        .filter((field) => field.isRequired)
        .map((field) => field.name),
      filterOperators: this.criteriaService.getFilterOperators(),
      usageHints: [...SAPLING_MCP_USAGE_HINTS.entitySchema],
    };
  }

  executeEntitySearch(
    args: Record<string, unknown>,
    policy?: McpToolPolicy,
    user?: PersonItem,
  ): {
    query: string;
    matches: Array<{
      entityHandle: string;
      score: number;
      matchedOn: string[];
      relationNames: string[];
      requiredFieldNames: string[];
      fieldPreview: string[];
    }>;
    usageHints: string[];
  } {
    const query = this.values.requireStringArg(args.query, 'query');
    const normalizedQuery = query.toLowerCase();
    const limit = Math.min(this.values.asPositiveNumber(args.limit) ?? 10, 50);

    const matches = this.values
      .filterPolicyEntityHandles([...ENTITY_HANDLES], policy)
      .map((entityHandle) => {
        const template = this.getUserEntityTemplate(entityHandle, user);
        if (user && template.length === 0) return null;
        const matchedOn = new Set<string>();
        let score = 0;

        score += this.scoreSearchValue(
          normalizedQuery,
          entityHandle,
          'entityHandle',
          matchedOn,
          120,
          90,
          60,
        );

        for (const field of template) {
          score += this.scoreSearchValue(
            normalizedQuery,
            field.name,
            `field:${field.name}`,
            matchedOn,
            50,
            35,
            20,
          );

          if (field.referenceName) {
            score += this.scoreSearchValue(
              normalizedQuery,
              field.referenceName,
              `reference:${field.referenceName}`,
              matchedOn,
              24,
              18,
              12,
            );
          }
        }

        if (score === 0) {
          return null;
        }

        return {
          entityHandle,
          score,
          matchedOn: [...matchedOn],
          relationNames: template
            .filter((field) => field.isReference)
            .map((field) => field.name),
          requiredFieldNames: template
            .filter((field) => field.isRequired)
            .map((field) => field.name),
          fieldPreview: template.slice(0, 12).map((field) => field.name),
        };
      })
      .filter(
        (
          item,
        ): item is {
          entityHandle: string;
          score: number;
          matchedOn: string[];
          relationNames: string[];
          requiredFieldNames: string[];
          fieldPreview: string[];
        } => item != null,
      )
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.entityHandle.localeCompare(right.entityHandle),
      )
      .slice(0, limit);

    return {
      query,
      matches,
      usageHints: [...SAPLING_MCP_USAGE_HINTS.entitySearch],
    };
  }

  private scoreSearchValue(
    normalizedQuery: string,
    candidate: string | null | undefined,
    label: string,
    matchedOn: Set<string>,
    exactScore: number,
    prefixScore: number,
    includeScore: number,
  ): number {
    if (!candidate) {
      return 0;
    }

    const normalizedCandidate = candidate.toLowerCase();

    if (normalizedCandidate === normalizedQuery) {
      matchedOn.add(label);
      return exactScore;
    }

    if (normalizedCandidate.startsWith(normalizedQuery)) {
      matchedOn.add(label);
      return prefixScore;
    }

    if (normalizedCandidate.includes(normalizedQuery)) {
      matchedOn.add(label);
      return includeScore;
    }

    return 0;
  }

  getEntityTemplate(entityHandle: string): EntityTemplateDto[] {
    return this.getRawEntityTemplate(entityHandle).filter(
      (field) => !field.options?.includes('isSecurity'),
    );
  }

  private getUserEntityTemplate(
    entityHandle: string,
    user?: PersonItem,
  ): EntityTemplateDto[] {
    const template = this.getEntityTemplate(entityHandle);
    return user
      ? this.fieldPermissions.applyTemplateAccess(user, entityHandle, template)
      : template;
  }

  private async getUserEntityTemplateWithCustomFields(
    entityHandle: string,
    user?: PersonItem,
  ): Promise<EntityTemplateDto[]> {
    const template = (
      await this.fieldPermissions.getTemplates(entityHandle)
    ).filter((field) => !field.options?.includes('isSecurity'));
    return user
      ? this.fieldPermissions.applyTemplateAccess(user, entityHandle, template)
      : template;
  }

  private getReadableFieldNames(
    user: PersonItem,
    entityHandle: string,
  ): Set<string> {
    return new Set(
      this.getUserEntityTemplate(entityHandle, user)
        .filter((field) => field.fieldAccess?.allowRead !== false)
        .map((field) => field.name),
    );
  }

  private projectMcpRelation(
    user: PersonItem,
    entityHandle: string,
    record: Record<string, unknown>,
    fieldNames: string[],
  ): Record<string, unknown> {
    const readable = this.getReadableFieldNames(user, entityHandle);
    const projected: Record<string, unknown> = {};
    for (const fieldName of fieldNames) {
      if (readable.has(fieldName)) {
        projected[fieldName] = this.values.asPrimitive(record[fieldName]);
      }
    }
    if (
      projected.description == null &&
      readable.has('description') &&
      readable.has('title')
    ) {
      projected.description = this.values.asPrimitive(record.title);
      delete projected.title;
    }
    return projected;
  }

  private getRawEntityTemplate(entityHandle: string): EntityTemplateDto[] {
    return this.templateService.getEntityTemplate(entityHandle);
  }

  stripSecurityFields(
    entityHandle: string,
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const sanitizedData: Record<string, unknown> = {};
    const template = this.getRawEntityTemplate(entityHandle);

    for (const [key, value] of Object.entries(data)) {
      const field = template.find((entry) => entry.name === key);

      if (field?.options?.includes('isSecurity')) {
        continue;
      }

      if (field?.isReference && field.referenceName) {
        sanitizedData[key] = this.stripSecurityValue(
          field.referenceName,
          value,
        );
        continue;
      }

      sanitizedData[key] = value;
    }

    return sanitizedData;
  }

  private stripSecurityValue(entityHandle: string, value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.stripSecurityValue(entityHandle, item));
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    return this.stripSecurityFields(
      entityHandle,
      value as Record<string, unknown>,
    );
  }
}
