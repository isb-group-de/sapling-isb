import { EntityManager } from '@mikro-orm/core';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { PersonItem } from '../../entity/PersonItem';
import { GenericReadService } from '../generic/generic-read.service';
import { GenericSanitizerService } from '../generic/generic-sanitizer.service';
import { TemplateService } from '../template/template.service';
import type {
  Customer360Anchor,
  Customer360RelatedResult,
  Customer360Section,
} from './customer-360.types';
import {
  Customer360Operations,
  RELATED_CONFIG,
} from './customer-360.operations';

@Injectable()
export class Customer360Service extends Customer360Operations {
  constructor(
    em: EntityManager,
    templateService: TemplateService,
    genericReadService: GenericReadService,
    genericSanitizerService: GenericSanitizerService,
  ) {
    super(em, templateService, genericReadService, genericSanitizerService);
  }

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
}
