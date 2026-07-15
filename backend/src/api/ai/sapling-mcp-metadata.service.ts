import { Injectable } from '@nestjs/common';
import { PersonItem } from '../../entity/PersonItem';
import { ENTITY_HANDLES } from '../../entity/global/entity.registry';
import { CurrentService } from '../current/current.service';
import { TemplateService } from '../template/template.service';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import type { McpToolPolicy } from './mcp-policy.types';
import { SaplingMcpCriteriaService } from './sapling-mcp-criteria.service';
import { SaplingMcpValueService } from './sapling-mcp-value.service';
import { SAPLING_MCP_USAGE_HINTS } from './prompts/sapling-mcp.prompts';
@Injectable()
export class SaplingMcpMetadataService {
  constructor(
    private readonly currentService: CurrentService,
    private readonly templateService: TemplateService,
    private readonly criteriaService: SaplingMcpCriteriaService,
    private readonly values: SaplingMcpValueService,
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

        return {
          handle: this.values.asPrimitive(role.handle),
          title: this.values.asPrimitive(role.title),
          stage: stage
            ? {
                handle: this.values.asPrimitive(stage.handle),
                title: this.values.asPrimitive(stage.title),
              }
            : null,
        };
      });

    return {
      person: {
        handle: person.handle ?? null,
        fullName: `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim(),
        firstName: person.firstName ?? null,
        lastName: person.lastName ?? null,
        loginName: person.loginName ?? null,
        email: person.email ?? null,
        phone: person.phone ?? null,
        mobile: person.mobile ?? null,
        isActive: person.isActive ?? null,
        requirePasswordChange: person.requirePasswordChange ?? null,
        company: company
          ? {
              handle: this.values.asPrimitive(company.handle),
              name: this.values.asPrimitive(company.name),
              city: this.values.asPrimitive(company.city),
              email: this.values.asPrimitive(company.email),
            }
          : null,
        department: department
          ? {
              handle: this.values.asPrimitive(department.handle),
              description:
                this.values.asPrimitive(department.description) ??
                this.values.asPrimitive(department.title),
            }
          : null,
        language: language
          ? {
              handle: this.values.asPrimitive(language.handle),
              name: this.values.asPrimitive(language.name),
            }
          : null,
        type: type
          ? {
              handle: this.values.asPrimitive(type.handle),
              description:
                this.values.asPrimitive(type.description) ??
                this.values.asPrimitive(type.title),
            }
          : null,
        workWeek: workWeek
          ? {
              handle: this.values.asPrimitive(workWeek.handle),
              title: this.values.asPrimitive(workWeek.title),
            }
          : null,
        roles,
      },
      usageHints: [...SAPLING_MCP_USAGE_HINTS.currentPerson],
    };
  }

  executeEntityCatalog(policy?: McpToolPolicy): { entities: string[] } {
    return {
      entities: this.values
        .filterPolicyEntityHandles([...ENTITY_HANDLES], policy)
        .sort((left, right) => left.localeCompare(right)),
    };
  }

  executeEntitySchema(
    args: Record<string, unknown>,
    policy?: McpToolPolicy,
  ): {
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
    }>;
    relationNames: string[];
    requiredFieldNames: string[];
    filterOperators: string[];
    usageHints: string[];
  } {
    const entityHandle = this.values.requireStringArg(
      args.entityHandle,
      'entityHandle',
    );
    this.values.assertEntityAllowed(entityHandle, policy);
    const template = this.getEntityTemplate(entityHandle);

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
        const template = this.getEntityTemplate(entityHandle);
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
