import type { EntityManager } from '@mikro-orm/core';
import { NotFoundException } from '@nestjs/common';
import type { PersonItem } from '../../entity/PersonItem';
import { ENTITY_MAP } from '../../entity/global/entity.registry';
import type { GenericReadService } from '../generic/generic-read.service';
import type { GenericSanitizerService } from '../generic/generic-sanitizer.service';
import type { TemplateService } from '../template/template.service';
import type {
  Customer360ActivityItem,
  Customer360Anchor,
  Customer360Section,
} from './customer-360.types';
import { Customer360MappingOperations } from './customer-360-mapping.operations';

type GenericRecord = Record<string, unknown>;

interface CustomerScope {
  anchor: Customer360Anchor;
  anchorHandle: number;
  companyHandle: number | null;
  personHandle: number | null;
  personHandles: number[];
  anchorRecord: GenericRecord;
  projectedAnchor: GenericRecord;
}

interface ReadPage {
  raw: GenericRecord[];
  data: GenericRecord[];
  total: number;
}

export const RELATED_CONFIG: Record<
  Exclude<Customer360Section, 'contacts' | 'documents' | 'relationships'>,
  { entityHandle: string; relations: string[]; orderBy: object }
> = {
  tickets: {
    entityHandle: 'ticket',
    relations: [
      'status',
      'priority',
      'type',
      'creatorCompany',
      'creatorPerson',
      'assigneePerson',
      'contract',
      'slaPolicy',
    ],
    orderBy: { updatedAt: 'DESC' },
  },
  opportunities: {
    entityHandle: 'salesOpportunity',
    relations: [
      'type',
      'forecast',
      'resultStatus',
      'creatorCompany',
      'creatorPerson',
      'assigneePerson',
    ],
    orderBy: { updatedAt: 'DESC' },
  },
  effortEstimates: {
    entityHandle: 'effortEstimate',
    relations: [
      'status',
      'creatorCompany',
      'creatorPerson',
      'assigneePerson',
      'salesOpportunity',
      'ticket',
      'positions',
    ],
    orderBy: { updatedAt: 'DESC' },
  },
  contracts: {
    entityHandle: 'contract',
    relations: [
      'company',
      'serviceLevel',
      'slaPolicy',
      'defaultSupportTeam',
      'defaultSupportQueue',
      'products',
    ],
    orderBy: { endDate: 'ASC', updatedAt: 'DESC' },
  },
};

export class Customer360Operations extends Customer360MappingOperations {
  constructor(
    protected readonly em: EntityManager,
    protected readonly templateService: TemplateService,
    protected readonly genericReadService: GenericReadService,
    protected readonly genericSanitizerService: GenericSanitizerService,
  ) {
    super();
  }

  protected async resolveScope(
    anchor: Customer360Anchor,
    handle: string | number,
    currentUser: PersonItem,
  ): Promise<CustomerScope> {
    const anchorHandle = Number(handle);
    if (!Number.isInteger(anchorHandle) || anchorHandle <= 0) {
      throw new NotFoundException('global.itemNotFound');
    }
    const relations =
      anchor === 'company'
        ? [
            'country',
            'accountManager',
            'customerSuccessManager',
            'industry',
            'segment',
            'size',
            'annualRevenueClass',
            'churnRiskReason',
          ]
        : [
            'company',
            'salutation',
            'title',
            'jobTitle',
            'jobFunction',
            'decisionRole',
            'department',
          ];
    const page = await this.readPage(
      anchor,
      { handle: anchorHandle },
      currentUser,
      1,
      1,
      {},
      relations,
    );
    const anchorRecord = page?.raw[0];
    const projectedAnchor = page?.data[0];
    if (!anchorRecord || !projectedAnchor) {
      throw new NotFoundException('global.itemNotFound');
    }

    const companyHandle =
      anchor === 'company'
        ? anchorHandle
        : (this.handleValue(anchorRecord.company) ?? null);
    const personHandle = anchor === 'person' ? anchorHandle : null;
    let personHandles = personHandle == null ? [] : [personHandle];

    if (
      anchor === 'company' &&
      companyHandle != null &&
      this.hasPermission(currentUser, 'person', 'allowRead')
    ) {
      const contacts = await this.readPage(
        'person',
        { company: companyHandle },
        currentUser,
        1,
        10_000,
        { lastName: 'ASC', firstName: 'ASC' },
        ['company'],
      );
      personHandles = (contacts?.raw ?? [])
        .map((person) => this.handleValue(person))
        .filter((value): value is number => value != null);
    }

    return {
      anchor,
      anchorHandle,
      companyHandle,
      personHandle,
      personHandles,
      anchorRecord,
      projectedAnchor,
    };
  }

  protected async loadRelatedSection(
    scope: CustomerScope,
    currentUser: PersonItem,
    section: Customer360Section,
    page: number,
    limit: number,
    filter: object,
  ): Promise<{ entityHandle: string; page: ReadPage } | null> {
    if (section === 'contacts') {
      if (scope.companyHandle == null) return null;
      const result = await this.readPage(
        'person',
        { company: scope.companyHandle },
        currentUser,
        page,
        limit,
        { lastName: 'ASC', firstName: 'ASC' },
        ['company', 'jobTitle', 'jobFunction', 'decisionRole', 'department'],
      );
      return result ? { entityHandle: 'person', page: result } : null;
    }
    if (section === 'documents') {
      if (!this.hasPermission(currentUser, 'document', 'allowRead')) {
        return {
          entityHandle: 'document',
          page: { raw: [], data: [], total: 0 },
        };
      }
      const references: object[] = [
        { entity: scope.anchor, reference: String(scope.anchorHandle) },
      ];
      if (scope.anchor === 'company') {
        references.push(
          ...scope.personHandles.map((personHandle) => ({
            entity: 'person',
            reference: String(personHandle),
          })),
        );
      }
      const result = await this.readPage(
        'document',
        { $or: references },
        currentUser,
        page,
        limit,
        { createdAt: 'DESC' },
        ['entity', 'type', 'person'],
      );
      return result ? { entityHandle: 'document', page: result } : null;
    }
    if (section === 'relationships') {
      if (scope.companyHandle == null) return null;
      const result = await this.readPage(
        'companyRelationship',
        {
          $or: [
            { sourceCompany: scope.companyHandle },
            { targetCompany: scope.companyHandle },
          ],
        },
        currentUser,
        page,
        limit,
        { updatedAt: 'DESC' },
        ['sourceCompany', 'targetCompany', 'type'],
      );
      return result
        ? { entityHandle: 'companyRelationship', page: result }
        : null;
    }

    const config = RELATED_CONFIG[section];
    const where =
      section === 'contracts'
        ? scope.companyHandle == null
          ? null
          : { company: scope.companyHandle }
        : this.customerWhere(config.entityHandle, scope);
    if (!where) return null;
    const result = await this.readPage(
      config.entityHandle,
      this.combineWhere(where, filter),
      currentUser,
      page,
      limit,
      config.orderBy,
      config.relations,
    );
    return result ? { entityHandle: config.entityHandle, page: result } : null;
  }

  protected combineWhere(scopeFilter: object, userFilter: object): object {
    return Object.keys(userFilter).length > 0
      ? { $and: [scopeFilter, userFilter] }
      : scopeFilter;
  }

  protected async loadActivity(
    scope: CustomerScope,
    currentUser: PersonItem,
    options: {
      before?: string;
      after?: string;
      limit: number;
      kinds?: string[];
      direction?: 'inbound' | 'outbound' | 'none';
    },
  ) {
    const before = options.before ? new Date(options.before) : null;
    const cursor = before && !Number.isNaN(before.getTime()) ? before : null;
    const afterValue = options.after ? new Date(options.after) : null;
    const after =
      afterValue && !Number.isNaN(afterValue.getTime()) ? afterValue : null;
    const wants = (kind: string) => {
      const direction =
        kind === 'emailInbound'
          ? 'inbound'
          : kind === 'emailOutbound'
            ? 'outbound'
            : 'none';
      return (
        (!options.kinds?.length || options.kinds.includes(kind)) &&
        (!options.direction || options.direction === direction)
      );
    };
    const sourceLimit = Math.min(200, options.limit * 3);
    const [events, inbound, outbound] = await Promise.all([
      wants('call') || wants('appointment') || wants('event')
        ? this.readPage(
            'event',
            this.andWhere(this.customerWhere('event', scope), {
              type: { handle: { $ne: 'mail' } },
              ...this.activityDateWhere('startDate', cursor, after),
            }),
            currentUser,
            1,
            sourceLimit,
            { startDate: 'DESC' },
            [
              'type',
              'status',
              'creatorCompany',
              'creatorPerson',
              'participants',
              'ticket',
              'salesOpportunity',
            ],
          )
        : null,
      wants('emailInbound')
        ? this.readPage(
            'inboundEmail',
            this.andWhere(
              this.customerWhere('inboundEmail', scope),
              this.activityDateWhere('receivedAt', cursor, after),
            ),
            currentUser,
            1,
            sourceLimit,
            { receivedAt: 'DESC' },
            [
              'status',
              'person',
              'company',
              'ticket',
              'salesOpportunity',
              'officeTask',
              'sourceDocument',
            ],
          )
        : null,
      wants('emailOutbound')
        ? this.readPage(
            'emailDelivery',
            this.andWhere(
              this.customerWhere('emailDelivery', scope),
              this.activityDateWhere('createdAt', cursor, after),
            ),
            currentUser,
            1,
            sourceLimit,
            { createdAt: 'DESC' },
            ['status', 'entity', 'customerCompany', 'customerPerson'],
          )
        : null,
    ]);

    const items: Customer360ActivityItem[] = [
      ...(events?.data ?? []).map((item) => this.mapEvent(item)),
      ...(inbound?.data ?? []).map((item) => this.mapInboundEmail(item)),
      ...(outbound?.data ?? []).map((item) => this.mapOutboundEmail(item)),
    ]
      .filter((item) => wants(item.kind))
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, options.limit);
    const nextBefore = items.at(-1)?.occurredAt ?? null;

    return {
      items,
      hasMore:
        (events?.total ?? 0) > (events?.data.length ?? 0) ||
        (inbound?.total ?? 0) > (inbound?.data.length ?? 0) ||
        (outbound?.total ?? 0) > (outbound?.data.length ?? 0) ||
        items.length === options.limit,
      nextBefore,
    };
  }

  protected customerWhere(entityHandle: string, scope: CustomerScope): object {
    const relationNames: Record<string, { company: string; person: string }> = {
      ticket: { company: 'creatorCompany', person: 'creatorPerson' },
      salesOpportunity: { company: 'creatorCompany', person: 'creatorPerson' },
      effortEstimate: { company: 'creatorCompany', person: 'creatorPerson' },
      event: { company: 'creatorCompany', person: 'creatorPerson' },
      inboundEmail: { company: 'company', person: 'person' },
      emailDelivery: {
        company: 'customerCompany',
        person: 'customerPerson',
      },
    };
    const relations = relationNames[entityHandle];
    if (!relations) return {};

    if (scope.anchor === 'person') {
      const direct = { [relations.person]: scope.personHandle };
      return entityHandle === 'event'
        ? {
            $or: [direct, { participants: { handle: scope.personHandle } }],
          }
        : direct;
    }

    const conditions: object[] = [];
    if (scope.companyHandle != null) {
      conditions.push({ [relations.company]: scope.companyHandle });
    }
    if (scope.personHandles.length > 0) {
      conditions.push({ [relations.person]: { $in: scope.personHandles } });
      if (entityHandle === 'event') {
        conditions.push({
          participants: { handle: { $in: scope.personHandles } },
        });
      }
    }
    return conditions.length === 1 ? conditions[0] : { $or: conditions };
  }

  protected async readPage(
    entityHandle: string,
    where: object,
    currentUser: PersonItem,
    page: number,
    limit: number,
    orderBy: object,
    populate: string[],
  ): Promise<ReadPage | null> {
    if (!this.hasPermission(currentUser, entityHandle, 'allowRead')) {
      return null;
    }
    const entityClass = ENTITY_MAP[entityHandle] as unknown;
    if (!entityClass) return null;
    const template = this.templateService.getEntityTemplate(entityHandle);
    const result = await this.genericReadService.findAndCount(
      entityHandle,
      entityClass,
      where,
      currentUser,
      template,
      {
        offset: (page - 1) * limit,
        limit,
        orderBy,
        populate: populate as never[],
      },
    );
    const afterRead = (await this.genericReadService.applyAfterRead(
      result.items,
      result.entity,
      currentUser,
    )) as GenericRecord[];
    const data = this.genericSanitizerService.projectEntityResult<
      GenericRecord[]
    >(entityHandle, afterRead, currentUser, template);
    const raw = result.items as unknown as GenericRecord[];
    return { raw, data, total: result.total };
  }

  protected hasPermission(
    user: PersonItem,
    entityHandle: string,
    permission: 'allowRead' | 'allowInsert' | 'allowUpdate',
  ): boolean {
    return Array.from(user.roles ?? []).some((role) =>
      Array.from(role.permissions ?? []).some(
        (item) =>
          item.entity?.handle === entityHandle && item[permission] === true,
      ),
    );
  }

  protected availableSections(
    user: PersonItem,
    scope: CustomerScope,
  ): Customer360Section[] {
    const sections: Customer360Section[] = [];
    if (
      scope.companyHandle != null &&
      this.hasPermission(user, 'person', 'allowRead')
    ) {
      sections.push('contacts');
    }
    if (this.hasPermission(user, 'ticket', 'allowRead'))
      sections.push('tickets');
    if (this.hasPermission(user, 'salesOpportunity', 'allowRead')) {
      sections.push('opportunities');
    }
    if (this.hasPermission(user, 'effortEstimate', 'allowRead')) {
      sections.push('effortEstimates');
    }
    if (
      scope.companyHandle != null &&
      this.hasPermission(user, 'contract', 'allowRead')
    ) {
      sections.push('contracts');
    }
    if (
      this.hasPermission(user, 'document', 'allowRead') ||
      this.hasPermission(user, 'information', 'allowRead')
    )
      sections.push('documents');
    if (
      scope.companyHandle != null &&
      this.hasPermission(user, 'companyRelationship', 'allowRead')
    ) {
      sections.push('relationships');
    }
    return sections;
  }

  protected buildWarnings(
    scope: CustomerScope,
    lastActivity: Customer360ActivityItem | undefined,
    tickets: ReadPage | null,
    opportunities: ReadPage | null,
    contracts: ReadPage | null,
    contractThreshold: Date,
  ) {
    const warnings: Array<{ key: string; severity: string; value?: unknown }> =
      [];
    if (scope.projectedAnchor.churnRiskReason) {
      warnings.push({
        key: 'churnRisk',
        severity: 'warning',
        value: scope.projectedAnchor.churnRiskReason,
      });
    }
    const lastContact = lastActivity ? new Date(lastActivity.occurredAt) : null;
    if (
      !lastContact ||
      Date.now() - lastContact.getTime() > 30 * 24 * 60 * 60 * 1000
    ) {
      warnings.push({ key: 'contactGap', severity: 'info' });
    }
    if (this.countCriticalTickets(tickets?.data ?? [], new Date()) > 0) {
      warnings.push({ key: 'slaCritical', severity: 'error' });
    }
    if ((opportunities?.data ?? []).some((item) => !item.nextStep)) {
      warnings.push({ key: 'missingNextStep', severity: 'warning' });
    }
    if (
      (contracts?.data ?? []).some((item) => {
        const endDate = this.dateValue(item.endDate);
        return endDate && endDate <= contractThreshold;
      })
    ) {
      warnings.push({ key: 'contractEnding', severity: 'warning' });
    }
    return warnings;
  }
}
