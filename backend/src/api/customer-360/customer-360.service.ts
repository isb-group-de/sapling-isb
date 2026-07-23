import { EntityManager } from '@mikro-orm/core';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PersonItem } from '../../entity/PersonItem';
import { ENTITY_MAP } from '../../entity/global/entity.registry';
import { GenericReadService } from '../generic/generic-read.service';
import { GenericSanitizerService } from '../generic/generic-sanitizer.service';
import { TemplateService } from '../template/template.service';
import {
  type Customer360ActivityItem,
  type Customer360Anchor,
  type Customer360RelatedResult,
  type Customer360Section,
} from './customer-360.types';

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

const RELATED_CONFIG: Record<
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

@Injectable()
export class Customer360Service {
  constructor(
    private readonly em: EntityManager,
    private readonly templateService: TemplateService,
    private readonly genericReadService: GenericReadService,
    private readonly genericSanitizerService: GenericSanitizerService,
  ) {}

  async getSummary(
    anchor: Customer360Anchor,
    handle: string | number,
    currentUser: PersonItem,
  ) {
    const scope = await this.resolveScope(anchor, handle, currentUser);
    const now = new Date();
    const ninetyDays = new Date(now);
    ninetyDays.setDate(ninetyDays.getDate() + 90);

    const [
      recentActivity,
      nextEvents,
      openTickets,
      openOpportunities,
      activeEstimates,
      activeContracts,
    ] = await Promise.all([
      this.loadActivity(scope, currentUser, {
        before: now.toISOString(),
        limit: 5,
      }),
      this.readPage(
        'event',
        this.andWhere(this.customerWhere('event', scope), {
          startDate: { $gte: now },
          type: { handle: { $ne: 'mail' } },
        }),
        currentUser,
        1,
        1,
        { startDate: 'ASC' },
        ['type', 'status', 'creatorCompany', 'creatorPerson', 'participants'],
      ),
      this.readPage(
        'ticket',
        this.andWhere(this.customerWhere('ticket', scope), {
          status: { isOpen: true },
        }),
        currentUser,
        1,
        200,
        { updatedAt: 'DESC' },
        RELATED_CONFIG.tickets.relations,
      ),
      this.readPage(
        'salesOpportunity',
        this.andWhere(this.customerWhere('salesOpportunity', scope), {
          isActive: true,
        }),
        currentUser,
        1,
        500,
        { updatedAt: 'DESC' },
        RELATED_CONFIG.opportunities.relations,
      ),
      this.readPage(
        'effortEstimate',
        this.andWhere(this.customerWhere('effortEstimate', scope), {
          isActive: true,
        }),
        currentUser,
        1,
        500,
        { updatedAt: 'DESC' },
        RELATED_CONFIG.effortEstimates.relations,
      ),
      scope.companyHandle == null
        ? null
        : this.readPage(
            'contract',
            { company: scope.companyHandle, isActive: true },
            currentUser,
            1,
            200,
            { endDate: 'ASC' },
            RELATED_CONFIG.contracts.relations,
          ),
    ]);

    const pipeline = (openOpportunities?.data ?? []).reduce(
      (sum, item) =>
        sum +
        this.numberValue(item.expectedRevenue) *
          (this.numberValue(item.probability) / 100),
      0,
    );
    const estimateHours = (activeEstimates?.data ?? []).reduce(
      (sum, item) => sum + this.numberValue(item.totalEstimatedHours),
      0,
    );
    const warnings = this.buildWarnings(
      scope,
      recentActivity.items[0],
      openTickets,
      openOpportunities,
      activeContracts,
      ninetyDays,
    );

    return {
      anchor: scope.projectedAnchor,
      anchorEntityHandle: anchor,
      companyContext:
        anchor === 'person' && scope.anchorRecord.company
          ? this.genericSanitizerService.projectEntityResult(
              'company',
              scope.anchorRecord.company,
              currentUser,
            )
          : null,
      metrics: {
        lastContactAt: recentActivity.items[0]?.occurredAt ?? null,
        ...(nextEvents
          ? {
              nextAppointmentAt:
                this.dateValue(nextEvents.data[0]?.startDate)?.toISOString() ??
                null,
            }
          : {}),
        ...(openTickets
          ? {
              openTickets: openTickets.total,
              slaCriticalTickets: this.countCriticalTickets(
                openTickets.data,
                now,
              ),
            }
          : {}),
        ...(openOpportunities
          ? {
              openOpportunities: openOpportunities.total,
              weightedPipeline: pipeline,
            }
          : {}),
        ...(activeEstimates
          ? {
              activeEffortEstimates: activeEstimates.total,
              estimatedHours: estimateHours,
            }
          : {}),
        ...(activeContracts
          ? {
              activeContracts: activeContracts.total,
              nextContractEndAt:
                this.firstDate(
                  activeContracts.data,
                  'endDate',
                )?.toISOString() ?? null,
            }
          : {}),
      },
      warnings,
      recentActivity: recentActivity.items,
      availableSections: this.availableSections(currentUser, scope),
      actions: {
        mail: this.hasPermission(currentUser, anchor, 'allowUpdate'),
        call: this.hasPermission(currentUser, 'event', 'allowInsert'),
        appointment: this.hasPermission(currentUser, 'event', 'allowInsert'),
        ticket: this.hasPermission(currentUser, 'ticket', 'allowInsert'),
        opportunity: this.hasPermission(
          currentUser,
          'salesOpportunity',
          'allowInsert',
        ),
        effortEstimate: this.hasPermission(
          currentUser,
          'effortEstimate',
          'allowInsert',
        ),
        contract:
          scope.companyHandle != null &&
          this.hasPermission(currentUser, 'contract', 'allowInsert'),
      },
    };
  }

  async getActivity(
    anchor: Customer360Anchor,
    handle: string | number,
    currentUser: PersonItem,
    options: {
      before?: string;
      after?: string;
      limit: number;
      kinds?: string[];
      direction?: 'inbound' | 'outbound' | 'none';
    },
  ) {
    const scope = await this.resolveScope(anchor, handle, currentUser);
    return this.loadActivity(scope, currentUser, options);
  }

  async getRelated(
    anchor: Customer360Anchor,
    handle: string | number,
    currentUser: PersonItem,
    section: Customer360Section,
    page: number,
    limit: number,
    filter: object = {},
  ): Promise<Customer360RelatedResult> {
    const scope = await this.resolveScope(anchor, handle, currentUser);
    const resolved = await this.loadRelatedSection(
      scope,
      currentUser,
      section,
      page,
      limit,
      filter,
    );
    if (!resolved) {
      throw new ForbiddenException('global.permissionDenied');
    }

    return {
      section,
      entityHandle: resolved.entityHandle,
      data: resolved.page.data,
      meta: {
        total: resolved.page.total,
        page,
        limit,
        totalPages: Math.ceil(resolved.page.total / limit),
      },
    };
  }

  private async resolveScope(
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

  private async loadRelatedSection(
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

  private combineWhere(scopeFilter: object, userFilter: object): object {
    return Object.keys(userFilter).length > 0
      ? { $and: [scopeFilter, userFilter] }
      : scopeFilter;
  }

  private async loadActivity(
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

  private customerWhere(entityHandle: string, scope: CustomerScope): object {
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

  private async readPage(
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

  private hasPermission(
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

  private availableSections(
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

  private buildWarnings(
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

  private mapEvent(item: GenericRecord): Customer360ActivityItem {
    const typeHandle = this.stringValue(
      this.recordValue(item.type, 'handle') ?? item.type,
    );
    const recordHandle = this.referenceHandle(item.handle) ?? '';
    const ticketHandle = this.referenceHandle(item.ticket);
    const opportunityHandle = this.referenceHandle(item.salesOpportunity);
    const kind =
      typeHandle === 'call'
        ? 'call'
        : ['online', 'project', 'sales'].includes(typeHandle)
          ? 'appointment'
          : 'event';
    return {
      id: `event:${recordHandle}`,
      kind,
      direction: 'none',
      occurredAt: this.isoValue(item.startDate ?? item.createdAt),
      entityHandle: 'event',
      recordHandle,
      title: this.stringValue(item.title),
      summary: this.stringValue(item.description) || null,
      participants: this.collectionLabels(item.participants),
      status: item.status,
      attachmentHandles: [],
      source:
        ticketHandle != null
          ? {
              entityHandle: 'ticket',
              recordHandle: ticketHandle,
            }
          : opportunityHandle != null
            ? {
                entityHandle: 'salesOpportunity',
                recordHandle: opportunityHandle,
              }
            : null,
    };
  }

  private mapInboundEmail(item: GenericRecord): Customer360ActivityItem {
    const recordHandle = this.referenceHandle(item.handle) ?? '';
    const sourceDocumentHandle = this.handleValue(item.sourceDocument);
    const ticketHandle = this.referenceHandle(item.ticket);
    const opportunityHandle = this.referenceHandle(item.salesOpportunity);
    const officeTaskHandle = this.referenceHandle(item.officeTask);
    return {
      id: `inboundEmail:${recordHandle}`,
      kind: 'emailInbound',
      direction: 'inbound',
      occurredAt: this.isoValue(item.receivedAt ?? item.createdAt),
      entityHandle: 'inboundEmail',
      recordHandle,
      title: this.stringValue(item.subject),
      summary: this.stringValue(item.bodyText) || null,
      participants: [
        this.stringValue(item.fromName),
        this.stringValue(item.fromAddress),
        ...this.stringArray(item.toRecipients),
      ].filter(Boolean),
      status: item.status,
      attachmentHandles:
        sourceDocumentHandle == null ? [] : [sourceDocumentHandle],
      source:
        ticketHandle != null
          ? {
              entityHandle: 'ticket',
              recordHandle: ticketHandle,
            }
          : opportunityHandle != null
            ? {
                entityHandle: 'salesOpportunity',
                recordHandle: opportunityHandle,
              }
            : officeTaskHandle != null
              ? {
                  entityHandle: 'event',
                  recordHandle: officeTaskHandle,
                }
              : null,
    };
  }

  private mapOutboundEmail(item: GenericRecord): Customer360ActivityItem {
    const sourceEntity = this.stringValue(
      this.recordValue(item.entity, 'handle') ?? item.entity,
    );
    const recordHandle = this.referenceHandle(item.handle) ?? '';
    const referenceHandle = this.referenceHandle(item.referenceHandle);
    return {
      id: `emailDelivery:${recordHandle}`,
      kind: 'emailOutbound',
      direction: 'outbound',
      occurredAt: this.isoValue(item.completedAt ?? item.createdAt),
      entityHandle: 'emailDelivery',
      recordHandle,
      title: this.stringValue(item.subject),
      summary: this.stringValue(item.bodyMarkdown) || null,
      participants: [
        ...this.stringArray(item.toRecipients),
        ...this.stringArray(item.ccRecipients),
      ],
      status: item.status,
      attachmentHandles: this.numberArray(item.attachmentHandles),
      source:
        sourceEntity && referenceHandle != null
          ? {
              entityHandle: sourceEntity,
              recordHandle: referenceHandle,
            }
          : null,
    };
  }

  private countCriticalTickets(items: GenericRecord[], now: Date): number {
    return items.filter((item) =>
      [item.firstResponseDueAt, item.resolutionDueAt, item.deadlineDate].some(
        (value) => {
          const date = this.dateValue(value);
          return date != null && date < now;
        },
      ),
    ).length;
  }

  private andWhere(left: object, right: object): object {
    if (Object.keys(right).length === 0) return left;
    if (Object.keys(left).length === 0) return right;
    return { $and: [left, right] };
  }

  private activityDateWhere(
    field: string,
    before: Date | null,
    after: Date | null,
  ): object {
    const range: Record<string, Date> = {};
    if (before) range.$lt = before;
    if (after) range.$gte = after;
    return Object.keys(range).length > 0 ? { [field]: range } : {};
  }

  private handleValue(value: unknown): number | null {
    const candidate = this.recordValue(value, 'handle') ?? value;
    if (typeof candidate !== 'string' && typeof candidate !== 'number') {
      return null;
    }
    const parsed = Number(candidate);
    return Number.isInteger(parsed) ? parsed : null;
  }

  private referenceHandle(value: unknown): string | number | null {
    const candidate = this.recordValue(value, 'handle') ?? value;
    return typeof candidate === 'string' || typeof candidate === 'number'
      ? candidate
      : null;
  }

  private recordValue(value: unknown, field: string): unknown {
    return value && typeof value === 'object'
      ? (value as GenericRecord)[field]
      : undefined;
  }

  private relationLabel(value: unknown): string {
    if (!value || typeof value !== 'object') return this.stringValue(value);
    const record = value as GenericRecord;
    return (
      [record.firstName, record.lastName].filter(Boolean).join(' ') ||
      this.stringValue(record.name ?? record.title ?? record.handle)
    );
  }

  private collectionLabels(value: unknown): string[] {
    return Array.isArray(value)
      ? value.map((item) => this.relationLabel(item)).filter(Boolean)
      : [];
  }

  private firstDate(items: GenericRecord[], field: string): Date | null {
    return (
      items
        .map((item) => this.dateValue(item[field]))
        .filter((value): value is Date => value != null)
        .sort((left, right) => left.getTime() - right.getTime())[0] ?? null
    );
  }

  private dateValue(value: unknown): Date | null {
    if (!value) return null;
    if (
      !(value instanceof Date) &&
      typeof value !== 'string' &&
      typeof value !== 'number'
    ) {
      return null;
    }
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private isoValue(value: unknown): string {
    return this.dateValue(value)?.toISOString() ?? new Date(0).toISOString();
  }

  private stringValue(value: unknown): string {
    return typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : '';
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.map((item) => this.stringValue(item)).filter(Boolean)
      : [];
  }

  private numberArray(value: unknown): number[] {
    return Array.isArray(value)
      ? value.map(Number).filter((item) => Number.isFinite(item))
      : [];
  }

  private numberValue(value: unknown): number {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }
}
