// KpiService: Service for executing KPI queries and returning results
import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import type { SqlEntityManager } from '@mikro-orm/sql';
import { KpiItem } from '../../entity/KpiItem';
import { PersonItem } from '../../entity/PersonItem';
import { ENTITY_MAP } from '../../entity/global/entity.registry';
import { KPIExecutor } from './kpi.executor';
import { KpiResponseDto } from './dto/kpi-response.dto';
import { TrendResultDto } from './dto/trend-result.dto';
import { SparklineMonthPointDto } from './dto/sparkline-month-point.dto';
import { SparklineDayPointDto } from './dto/sparkline-day-point.dto';
import { SparklineWeekPointDto } from './dto/sparkline-week-point.dto';
import { GenericFilterService } from '../generic/generic-filter.service';
import { GenericPermissionService } from '../generic/generic-permission.service';
import { TemplateService } from '../template/template.service';
import { FieldPermissionService } from '../current/field-permission.service';

/**
 * @class KpiService
 * @version         1.0
 * @author          Martin Rosbund
 * @summary         Service providing KPI query execution and result aggregation.
 *
 * @property        {EntityManager} em Entity manager for database access
 */
@Injectable()
export class KpiService {
  /**
   * Creates an instance of KpiService.
   */
  constructor(
    private readonly em: EntityManager,
    private readonly templateService: TemplateService,
    private readonly genericFilterService: GenericFilterService,
    private readonly genericPermissionService: GenericPermissionService,
    private readonly fieldPermissions: FieldPermissionService = {
      assertReadableFields: () => Promise.resolve(),
      assertReadableQuery: () => Promise.resolve(),
    } as unknown as FieldPermissionService,
  ) {}

  /**
   * Executes a KPI by its ID, performing the configured aggregation and returning the result.
   * Handles all supported KPI types (ITEM, LIST, TREND, SPARKLINE).
   *
   * The KPI's persisted `filter` is first run through the same dynamic
   * placeholder resolution as generic reads (e.g. `{{currentUser.handle}}`),
   * and finally the entity-level permission filter (isPerson / isCompany /
   * isEntity) of `currentUser` is applied so KPIs respect the same data
   * scope that the generic API enforces.
   *
   * @param {number} id The KPI handle (ID)
   * @param {PersonItem | null} currentUser The user performing the query
   * @returns {Promise<KpiResponseDto>} The KPI entity and the computed value
   * @throws NotFoundException if the KPI or target entity is not found
   */
  async executeKPIById(
    id: number,
    currentUser?: PersonItem | null,
  ): Promise<KpiResponseDto> {
    const kpi = await this.em.findOne(
      KpiItem,
      { handle: id },
      {
        populate: [
          'aggregation',
          'type',
          'timeframe',
          'timeframeInterval',
          'targetEntity',
          'relation',
          'secondaryAggregation',
          'secondaryTargetEntity',
        ],
      },
    );
    if (!kpi) throw new NotFoundException(`global.notFound`);

    return this.executeKPI(kpi, currentUser);
  }

  async executeKPIBatch(
    handles: Array<number | string>,
    currentUser?: PersonItem | null,
  ): Promise<KpiResponseDto[]> {
    const normalizedHandles = [
      ...new Set(
        handles
          .map((handle) => Number(handle))
          .filter((handle) => Number.isInteger(handle) && handle > 0),
      ),
    ];

    if (normalizedHandles.length === 0) {
      return [];
    }

    const kpis = await this.em.find(
      KpiItem,
      { handle: { $in: normalizedHandles } },
      {
        populate: [
          'aggregation',
          'type',
          'timeframe',
          'timeframeInterval',
          'targetEntity',
          'relation',
          'secondaryAggregation',
          'secondaryTargetEntity',
        ],
      },
    );
    const kpisByHandle = new Map(kpis.map((kpi) => [kpi.handle, kpi]));
    const orderedKpis = normalizedHandles.map((handle) => {
      const kpi = kpisByHandle.get(handle);
      if (!kpi) {
        throw new NotFoundException(`global.notFound`);
      }

      return kpi;
    });

    return Promise.all(
      orderedKpis.map((kpi) => {
        const entityHandle = kpi.targetEntity?.handle ?? '';
        this.genericPermissionService.checkTopLevelReadPermission(
          entityHandle,
          currentUser,
        );
        return this.executeKPI(kpi, currentUser);
      }),
    );
  }

  private async executeKPI(
    kpi: KpiItem,
    currentUser?: PersonItem | null,
  ): Promise<KpiResponseDto> {
    // Resolve target entity class from registry
    const entityClass = ENTITY_MAP[kpi.targetEntity?.handle || ''] as unknown;
    if (!entityClass) {
      throw new NotFoundException(`global.entityNotFound`);
    }
    const entityHandle = kpi.targetEntity?.handle ?? '';
    const template = entityHandle
      ? this.templateService.getEntityTemplate(entityHandle)
      : [];

    // Start from the persisted filter, resolve dynamic placeholders
    // ({{currentUser.handle}}, {{today.start}}, …) via the same service that
    // powers generic reads, then layer the user's entity scope on top.
    const rawFilter =
      kpi.filter && typeof kpi.filter === 'object' ? { ...kpi.filter } : {};
    if (currentUser && entityHandle) {
      await this.fieldPermissions.assertReadableFields(
        currentUser,
        entityHandle,
        this.getKpiFieldPaths(kpi),
      );
      await this.fieldPermissions.assertReadableQuery(
        currentUser,
        entityHandle,
        this.normalizePermissionCriteria(rawFilter),
      );
    }
    const resolvedFilter = this.genericFilterService.prepareReadCriteria(
      rawFilter,
      template,
      currentUser ?? null,
    );
    const baseWhere =
      currentUser && entityHandle
        ? (this.genericPermissionService.setTopLevelFilter(
            resolvedFilter,
            currentUser,
            entityHandle,
          ) as Record<string, unknown>)
        : (resolvedFilter as Record<string, unknown>);
    let secondaryWhere: Record<string, unknown> | undefined;
    if (kpi.secondaryField && kpi.secondaryAggregation) {
      const secondaryEntityHandle =
        kpi.secondaryTargetEntity?.handle ?? entityHandle;
      const secondaryTemplate = this.templateService.getEntityTemplate(
        secondaryEntityHandle,
      );
      const secondaryRawFilter =
        kpi.secondaryFilter && typeof kpi.secondaryFilter === 'object'
          ? { ...kpi.secondaryFilter }
          : {};

      if (currentUser && secondaryEntityHandle) {
        this.genericPermissionService.checkTopLevelReadPermission(
          secondaryEntityHandle,
          currentUser,
        );
        await this.fieldPermissions.assertReadableFields(
          currentUser,
          secondaryEntityHandle,
          [kpi.secondaryField].map((field) =>
            this.normalizePermissionPath(field),
          ),
        );
        await this.fieldPermissions.assertReadableQuery(
          currentUser,
          secondaryEntityHandle,
          this.normalizePermissionCriteria(secondaryRawFilter),
        );
      }

      const resolvedSecondaryFilter =
        this.genericFilterService.prepareReadCriteria(
          secondaryRawFilter,
          secondaryTemplate,
          currentUser ?? null,
        );
      secondaryWhere =
        currentUser && secondaryEntityHandle
          ? (this.genericPermissionService.setTopLevelFilter(
              resolvedSecondaryFilter,
              currentUser,
              secondaryEntityHandle,
            ) as Record<string, unknown>)
          : resolvedSecondaryFilter;
    }
    // Instantiate executor for this KPI
    const executor = new KPIExecutor(this.em as SqlEntityManager, kpi);
    const type = kpi.type?.handle || 'ITEM';
    const groupBy = kpi.groupBy;
    let value:
      | number
      | object
      | Array<Record<string, unknown>>
      | TrendResultDto
      | SparklineMonthPointDto[]
      | SparklineDayPointDto[]
      | SparklineWeekPointDto[]
      | null;
    // Delegate to the correct executor method based on KPI type
    if (
      type === 'ITEM' ||
      type === 'LIST' ||
      type === 'BREAKDOWN' ||
      type === 'FUNNEL'
    ) {
      value = await executor.executeItemOrList(baseWhere, groupBy);
    } else if (type === 'RATIO' || type === 'FORMULA') {
      value = await executor.executeFormula(baseWhere, secondaryWhere);
    } else if (type === 'TARGET' || type === 'PROGRESS') {
      value = await executor.executeTarget(baseWhere, secondaryWhere);
    } else if (type === 'TREND' || type === 'COMPARISON') {
      const trend = await executor.executeTrend(baseWhere, groupBy);
      value = trend
        ? { current: trend.current, previous: trend.previous }
        : null;
    } else if (type === 'SPARKLINE') {
      value = await executor.executeSparkline(baseWhere, groupBy);
    } else {
      value = await executor.executeItemOrList(baseWhere, groupBy);
    }

    const drilldown =
      type === 'TREND' || type === 'COMPARISON'
        ? executor.buildTrendDrilldown(baseWhere, value as TrendResultDto)
        : type === 'SPARKLINE'
          ? executor.buildSparklineDrilldown(
              baseWhere,
              value as
                | SparklineMonthPointDto[]
                | SparklineDayPointDto[]
                | SparklineWeekPointDto[],
            )
          : executor.buildBaseDrilldown(baseWhere);

    // Return both the KPI entity and the computed value
    return { kpi, value, drilldown };
  }

  private getKpiFieldPaths(kpi: KpiItem): string[] {
    const paths = [
      kpi.field,
      kpi.timeframeField,
      kpi.durationStartField,
      ...(Array.isArray(kpi.groupBy) ? kpi.groupBy : []),
    ]
      .filter((value): value is string => !!value?.trim())
      .map((value) => this.normalizePermissionPath(value));
    const relationName = kpi.field?.includes('.')
      ? kpi.field.split('.')[0]
      : null;
    if (relationName && kpi.relationField?.trim()) {
      paths.push(
        this.normalizePermissionPath(
          `${relationName}.${kpi.relationField.trim()}`,
        ),
      );
    }
    return [...new Set(paths)];
  }

  private normalizePermissionCriteria(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((entry) => this.normalizePermissionCriteria(entry));
    }
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key.startsWith('$') ? key : this.normalizePermissionPath(key),
        this.normalizePermissionCriteria(entry),
      ]),
    );
  }

  private normalizePermissionPath(value: string): string {
    return value
      .split('.')
      .map((segment) =>
        segment.replace(/_([a-z])/g, (_match, character: string) =>
          character.toUpperCase(),
        ),
      )
      .join('.');
  }
}
