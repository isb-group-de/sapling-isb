import { raw, type RawQueryFragment } from '@mikro-orm/core';
import type { SqlEntityManager } from '@mikro-orm/sql';
import { KpiItem } from '../../entity/KpiItem';
import { ENTITY_MAP } from '../../entity/global/entity.registry';
import { TrendResultDto } from './dto/trend-result.dto';
import type { SparklineMonthPointDto } from './dto/sparkline-month-point.dto';
import type { SparklineDayPointDto } from './dto/sparkline-day-point.dto';
import type { SparklineWeekPointDto } from './dto/sparkline-week-point.dto';
import { KpiDrilldownDto, KpiDrilldownEntryDto } from './dto/kpi-drilldown.dto';
import {
  KpiTimeframePlanner,
  type SparklinePointDto,
} from './kpi-timeframe-planner';

type KpiAggregateValue =
  number | object | Array<Record<string, unknown>> | null;

type KpiWhere = Record<string, unknown>;

interface AggregateConfig {
  entityHandle?: string;
  field?: string;
  aggregation?: string;
  durationStartField?: string;
  relation?: string;
}

export interface KpiFormulaResult {
  value: number | null;
  primaryValue: number | null;
  secondaryValue: number | null;
  operation: string;
  scale: number;
  unit: string | null;
}

export interface KpiTargetResult extends KpiFormulaResult {
  targetValue: number;
  progressPercent: number | null;
  status: 'good' | 'warning' | 'critical';
  direction: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
  warningThreshold: number | null;
  criticalThreshold: number | null;
}

/**
 * @class KPIExecutor
 * @version         1.0
 * @author          Martin Rosbund
 * @summary         Utility class for executing and aggregating KPI queries, including time-based analytics (trend, sparkline).
 *
 * @property        {EntityManager} em   Entity manager for database access
 * @property        {KpiItem} kpi         KPI entity containing configuration
 */
export class KPIExecutor {
  private readonly timeframePlanner = new KpiTimeframePlanner();

  /**
   * Creates an instance of KPIExecutor.
   * @param {EntityManager} em Entity manager for database access
   * @param {KpiItem} kpi KPI entity containing configuration
   */
  constructor(
    private readonly em: SqlEntityManager,
    private readonly kpi: KpiItem,
  ) {}

  private toColumnName(fieldPath: string): string {
    return fieldPath.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  }

  /**
   * Performs aggregation (SUM, AVG, COUNT, etc.) on the target entity, optionally grouped by fields.
   * @param {object} where Filter conditions for the query
   * @param {string[]} [groupBy] Optional array of fields to group by
   * @returns {Promise<unknown>} Aggregated value or grouped result
   */
  private async aggregate(
    where: object,
    groupBy?: string[],
    config: AggregateConfig = {},
  ) {
    const field = config.field ?? this.kpi.field;
    const aggregation = (
      config.aggregation ?? this.kpi.aggregation.handle
    ).toUpperCase();
    let result: unknown;
    const entityClass = ENTITY_MAP[
      config.entityHandle ?? this.kpi.targetEntity?.handle ?? ''
    ] as import('@mikro-orm/core').EntityName<any>;
    const meta = this.em.getMetadata().get(entityClass);
    const qb = this.em.createQueryBuilder(entityClass, 'e');
    const joinAliases = new Map<string, string>();

    const ensureJoin = (relationPath: string) => {
      const existingAlias = joinAliases.get(relationPath);
      if (existingAlias) {
        return existingAlias;
      }

      const alias = joinAliases.size === 0 ? 'r' : `r${joinAliases.size + 1}`;
      qb.leftJoin(`e.${relationPath}`, alias);
      joinAliases.set(relationPath, alias);
      return alias;
    };

    let relation: string | undefined = config.relation;
    if (!config.entityHandle) {
      relation = relation ?? this.kpi.relation?.handle;
    }
    let selectField = `e.${field}`;
    let useRelation = false;

    if (field.includes('.')) {
      const [rel, relField] = field.split('.');
      relation = relation || rel;
      selectField = `${ensureJoin(relation)}.${relField}`;
      useRelation = true;
    }

    const relationHandleField = relation;
    const resolveField = (fieldPath: string, alias?: string) => {
      const propertyMeta = meta.properties[fieldPath];

      if (fieldPath.includes('.')) {
        const [rel, relField] = fieldPath.split('.');
        const expression = `${ensureJoin(rel)}.${relField}`;

        return {
          expression,
          groupBy: expression,
          select: alias
            ? raw<RawQueryFragment>(`${expression} as ${alias}`)
            : expression,
        };
      }

      if (fieldPath === relationHandleField && relationHandleField) {
        const expression = `e.${this.toColumnName(fieldPath)}_handle`;

        return {
          expression,
          groupBy: expression,
          select: raw<RawQueryFragment>(
            `${expression} as ${alias || fieldPath}`,
          ),
        };
      }

      if (
        propertyMeta &&
        ['m:1', '1:1'].includes(propertyMeta.kind ?? '') &&
        propertyMeta.fieldNames?.[0]
      ) {
        const expression = `e.${propertyMeta.fieldNames[0]}`;

        return {
          expression,
          groupBy: expression,
          select: raw<RawQueryFragment>(
            `${expression} as ${alias || fieldPath}`,
          ),
        };
      }

      const expression = `e.${fieldPath}`;

      return {
        expression,
        groupBy: expression,
        select: alias
          ? raw<RawQueryFragment>(`${expression} as ${alias}`)
          : expression,
      };
    };

    const durationStartField = config.durationStartField;
    const aggregateExpression = (valueExpression: string) => {
      if (
        (aggregation === 'DURATION_AVG' ||
          aggregation === 'DURATION_SUM' ||
          aggregation === 'COUNT_LTE_FIELD') &&
        !durationStartField
      ) {
        throw new Error(`${aggregation} requires durationStartField`);
      }

      const comparisonExpression = durationStartField
        ? resolveField(durationStartField).expression
        : null;

      if (aggregation === 'DURATION_AVG') {
        return `AVG(EXTRACT(EPOCH FROM (${valueExpression} - ${comparisonExpression}))) / 3600.0`;
      }
      if (aggregation === 'DURATION_SUM') {
        return `SUM(EXTRACT(EPOCH FROM (${valueExpression} - ${comparisonExpression}))) / 3600.0`;
      }
      if (aggregation === 'COUNT_LTE_FIELD') {
        return `SUM(CASE WHEN ${valueExpression} <= ${comparisonExpression} THEN 1 ELSE 0 END)`;
      }

      return `${aggregation}(${valueExpression})`;
    };

    if (useRelation) {
      if (groupBy && groupBy.length > 0) {
        const primaryField = resolveField(field, 'handle');
        const selectFields: (string | RawQueryFragment)[] = [
          primaryField.select,
        ];
        const groupByFields: string[] = [primaryField.groupBy];

        groupBy.forEach((gb) => {
          const groupField = resolveField(
            gb,
            gb.includes('.') ? gb.split('.')[1] : gb,
          );

          if (groupField.expression !== primaryField.expression) {
            selectFields.push(groupField.select);
            groupByFields.push(groupField.groupBy);
          }
        });

        qb.select([
          ...selectFields,
          raw<RawQueryFragment>(`${aggregateExpression(selectField)} as value`),
        ]);
        qb.groupBy(groupByFields);
        qb.where(where);
        result = await qb.execute();
      } else {
        qb.select([raw(`${aggregateExpression(selectField)} as value`)]);
        qb.where(where);
        result = await qb.execute();
        result =
          Array.isArray(result) && result.length > 0 && 'value' in result[0]
            ? (result[0] as { value?: unknown }).value
            : undefined;
      }
    } else {
      if (groupBy && groupBy.length > 0) {
        const groupFields = groupBy.map((gb) =>
          resolveField(gb, gb.includes('.') ? gb.split('.')[1] : gb),
        );

        qb.select([
          ...groupFields.map((groupField) => groupField.select),
          raw<RawQueryFragment>(
            `${aggregateExpression(resolveField(field).expression)} as value`,
          ),
        ]);
        qb.groupBy(groupFields.map((groupField) => groupField.groupBy));
        qb.where(where);
        result = await qb.execute();
      } else {
        qb.select([
          raw(
            `${aggregateExpression(resolveField(field).expression)} as value`,
          ),
        ]);
        qb.where(where);
        result = await qb.execute();
        result =
          Array.isArray(result) && result.length > 0 && 'value' in result[0]
            ? (result[0] as { value?: unknown }).value
            : undefined;
      }
    }
    return result;
  }

  private normalizeWhere(where: object): KpiWhere {
    if (where && typeof where === 'object' && !Array.isArray(where)) {
      return { ...(where as KpiWhere) };
    }

    return {};
  }

  private hasWhere(where: KpiWhere): boolean {
    return Object.keys(where).length > 0;
  }

  private combineWhere(baseWhere: object, extraWhere: KpiWhere): KpiWhere {
    const normalizedBase = this.normalizeWhere(baseWhere);

    if (!this.hasWhere(extraWhere)) {
      return normalizedBase;
    }

    if (!this.hasWhere(normalizedBase)) {
      return { ...extraWhere };
    }

    return {
      $and: [normalizedBase, extraWhere],
    };
  }

  private getTargetEntityHandle(): string | null {
    const handle = this.kpi.targetEntity?.handle;

    return typeof handle === 'string' && handle.length > 0 ? handle : null;
  }

  private createDrilldownEntry(
    key: string,
    label: string,
    filter: KpiWhere,
    value?: KpiAggregateValue,
  ): KpiDrilldownEntryDto {
    const entry = new KpiDrilldownEntryDto();
    entry.key = key;
    entry.label = label;
    entry.filter = filter;
    entry.value = value;
    return entry;
  }

  buildBaseDrilldown(baseWhere: object): KpiDrilldownDto | null {
    const entityHandle = this.getTargetEntityHandle();

    if (!entityHandle) {
      return null;
    }

    const drilldown = new KpiDrilldownDto();
    drilldown.entityHandle = entityHandle;
    drilldown.baseFilter = this.normalizeWhere(baseWhere);
    return drilldown;
  }

  buildTrendDrilldown(
    baseWhere: object,
    trend: TrendResultDto | null,
  ): KpiDrilldownDto | null {
    const drilldown = this.buildBaseDrilldown(baseWhere);
    const timeframe = this.kpi.timeframe?.handle;
    const timeframeField = this.kpi.timeframeField || 'created_at';
    const now = new Date();
    const rangeCurrent = this.timeframePlanner.getTimeRange(timeframe, now);
    const rangePrevious = this.timeframePlanner.getPreviousTimeRange(
      timeframe,
      now,
    );

    if (!drilldown) {
      return null;
    }

    if (rangeCurrent) {
      drilldown.current = this.createDrilldownEntry(
        'current',
        `${this.timeframePlanner.formatDate(rangeCurrent.start)} - ${this.timeframePlanner.formatDate(rangeCurrent.end)}`,
        this.combineWhere(baseWhere, {
          [timeframeField]: {
            $gte: rangeCurrent.start,
            $lte: rangeCurrent.end,
          },
        }),
        trend?.current ?? null,
      );
    }

    if (rangePrevious) {
      drilldown.previous = this.createDrilldownEntry(
        'previous',
        `${this.timeframePlanner.formatDate(rangePrevious.start)} - ${this.timeframePlanner.formatDate(rangePrevious.end)}`,
        this.combineWhere(baseWhere, {
          [timeframeField]: {
            $gte: rangePrevious.start,
            $lte: rangePrevious.end,
          },
        }),
        trend?.previous ?? null,
      );
    }

    return drilldown;
  }

  buildSparklineDrilldown(
    baseWhere: object,
    points: SparklinePointDto[] = [],
  ): KpiDrilldownDto | null {
    const drilldown = this.buildBaseDrilldown(baseWhere);
    const timeframe = this.kpi.timeframe?.handle;
    const interval = this.kpi.timeframeInterval?.handle;
    const timeframeField = this.kpi.timeframeField || 'created_at';
    const buckets = this.timeframePlanner.getSparklineBuckets(
      timeframe,
      interval,
      new Date(),
    );

    if (!drilldown) {
      return null;
    }

    drilldown.items = buckets.map((bucket, index) =>
      this.createDrilldownEntry(
        bucket.key,
        bucket.label,
        this.combineWhere(baseWhere, {
          [timeframeField]: {
            $gte: bucket.start,
            $lte: bucket.end,
          },
        }),
        (points[index]?.value as KpiAggregateValue | undefined) ?? null,
      ),
    );

    return drilldown;
  }

  /**
   * Executes a KPI of type ITEM or LIST, returning the aggregated value or grouped result.
   * @param {object} baseWhere Filter conditions
   * @param {string[]} [groupBy] Optional grouping fields
   * @returns {Promise<number | object | null>} Aggregated value or grouped result
   */
  async executeItemOrList(
    baseWhere: object,
    groupBy?: string[],
  ): Promise<KpiAggregateValue> {
    return (await this.aggregate(baseWhere, groupBy)) as KpiAggregateValue;
  }

  private normalizeNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private calculateFormula(
    primaryValue: number | null,
    secondaryValue: number | null,
    operation: string,
    scale: number,
  ): number | null {
    if (primaryValue === null) return null;

    let value: number;
    switch (operation) {
      case 'ADD':
        if (secondaryValue === null) return null;
        value = primaryValue + secondaryValue;
        break;
      case 'SUBTRACT':
        if (secondaryValue === null) return null;
        value = primaryValue - secondaryValue;
        break;
      case 'MULTIPLY':
        if (secondaryValue === null) return null;
        value = primaryValue * secondaryValue;
        break;
      case 'DIVIDE':
        if (secondaryValue === null || secondaryValue === 0) return null;
        value = primaryValue / secondaryValue;
        break;
      case 'IDENTITY':
        value = primaryValue;
        break;
      default:
        throw new Error(`Unsupported KPI formula operation: ${operation}`);
    }

    const scaled = value * scale;
    return Number.isFinite(scaled) ? scaled : null;
  }

  async executeFormula(
    baseWhere: object,
    secondaryWhere?: object,
  ): Promise<KpiFormulaResult> {
    const operation = (this.kpi.formulaOperation ?? 'DIVIDE').toUpperCase();
    const scale = this.kpi.formulaScale ?? (operation === 'DIVIDE' ? 100 : 1);
    const primaryValue = this.normalizeNumber(
      await this.aggregate(baseWhere, undefined, {
        durationStartField: this.kpi.durationStartField,
      }),
    );
    const hasSecondaryOperand = Boolean(
      this.kpi.secondaryField && this.kpi.secondaryAggregation,
    );
    const secondaryValue = hasSecondaryOperand
      ? this.normalizeNumber(
          await this.aggregate(secondaryWhere ?? {}, undefined, {
            entityHandle:
              this.kpi.secondaryTargetEntity?.handle ??
              this.kpi.targetEntity?.handle,
            field: this.kpi.secondaryField,
            aggregation: this.kpi.secondaryAggregation?.handle,
          }),
        )
      : null;

    return {
      value: this.calculateFormula(
        primaryValue,
        secondaryValue,
        hasSecondaryOperand ? operation : 'IDENTITY',
        scale,
      ),
      primaryValue,
      secondaryValue,
      operation: hasSecondaryOperand ? operation : 'IDENTITY',
      scale,
      unit: this.kpi.unit ?? null,
    };
  }

  async executeTarget(
    baseWhere: object,
    secondaryWhere?: object,
  ): Promise<KpiTargetResult> {
    const formula = await this.executeFormula(baseWhere, secondaryWhere);
    const targetValue = this.kpi.targetValue ?? 0;
    const direction =
      this.kpi.targetDirection === 'LOWER_IS_BETTER'
        ? 'LOWER_IS_BETTER'
        : 'HIGHER_IS_BETTER';
    const value = formula.value;
    const warningThreshold = this.kpi.warningThreshold ?? null;
    const criticalThreshold = this.kpi.criticalThreshold ?? null;
    let status: KpiTargetResult['status'] = 'warning';

    if (value !== null) {
      if (direction === 'HIGHER_IS_BETTER') {
        const goodThreshold = warningThreshold ?? targetValue;
        status =
          value >= goodThreshold
            ? 'good'
            : criticalThreshold !== null && value <= criticalThreshold
              ? 'critical'
              : 'warning';
      } else {
        const goodThreshold = warningThreshold ?? targetValue;
        status =
          value <= goodThreshold
            ? 'good'
            : criticalThreshold !== null && value >= criticalThreshold
              ? 'critical'
              : 'warning';
      }
    } else {
      status = 'critical';
    }

    const progressPercent =
      value === null
        ? null
        : direction === 'HIGHER_IS_BETTER'
          ? targetValue === 0
            ? value >= 0
              ? 100
              : 0
            : (value / targetValue) * 100
          : value === 0
            ? 100
            : (targetValue / value) * 100;

    return {
      ...formula,
      targetValue,
      progressPercent:
        progressPercent !== null && Number.isFinite(progressPercent)
          ? progressPercent
          : null,
      status,
      direction,
      warningThreshold,
      criticalThreshold,
    };
  }

  /**
   * Executes a KPI of type TREND, comparing current and previous time periods.
   * @param {object} baseWhere Filter conditions
   * @param {string[]} [groupBy] Optional grouping fields
   * @returns {Promise<TrendResultDto>} TrendResult with current and previous values
   */
  async executeTrend(
    baseWhere: object,
    groupBy?: string[],
  ): Promise<TrendResultDto> {
    const timeframe = this.kpi.timeframe?.handle;
    const timeframeField = this.kpi.timeframeField || 'created_at';
    const now = new Date();
    const rangeCurrent = this.timeframePlanner.getTimeRange(timeframe, now);
    const rangePrev = this.timeframePlanner.getPreviousTimeRange(
      timeframe,
      now,
    );
    const currentWhere = rangeCurrent
      ? this.combineWhere(baseWhere, {
          [timeframeField]: {
            $gte: rangeCurrent.start,
            $lte: rangeCurrent.end,
          },
        })
      : this.normalizeWhere(baseWhere);
    const previousWhere = rangePrev
      ? this.combineWhere(baseWhere, {
          [timeframeField]: {
            $gte: rangePrev.start,
            $lte: rangePrev.end,
          },
        })
      : this.normalizeWhere(baseWhere);

    return {
      current: await this.aggregate(currentWhere, groupBy),
      previous: await this.aggregate(previousWhere, groupBy),
    } as TrendResultDto;
  }

  /**
   * Executes a KPI of type SPARKLINE, returning a time series for the configured interval.
   * @param {object} baseWhere Filter conditions
   * @param {string[]} [groupBy] Optional grouping fields
   * @returns {Promise<SparklineMonthPointDto[] | SparklineDayPointDto[] | SparklineWeekPointDto[]>} Array of sparkline data points
   */
  async executeSparkline(
    baseWhere: object,
    groupBy?: string[],
  ): Promise<
    SparklineMonthPointDto[] | SparklineDayPointDto[] | SparklineWeekPointDto[]
  > {
    const timeframe = this.kpi.timeframe?.handle;
    const interval = this.kpi.timeframeInterval?.handle;
    const timeframeField = this.kpi.timeframeField || 'created_at';
    const buckets = this.timeframePlanner.getSparklineBuckets(
      timeframe,
      interval,
      new Date(),
    );

    if (buckets.length === 0) {
      return [];
    }

    const entityClass = ENTITY_MAP[
      this.kpi.targetEntity?.handle || ''
    ] as import('@mikro-orm/core').EntityName<any>;
    const meta = this.em.getMetadata().get(entityClass);
    const qb = this.em.createQueryBuilder(entityClass, 'e');
    const joinAliases = new Map<string, string>();
    const ensureJoin = (relationPath: string) => {
      const existingAlias = joinAliases.get(relationPath);
      if (existingAlias) {
        return existingAlias;
      }

      const alias = joinAliases.size === 0 ? 'r' : `r${joinAliases.size + 1}`;
      qb.leftJoin(`e.${relationPath}`, alias);
      joinAliases.set(relationPath, alias);
      return alias;
    };
    const resolveField = (fieldPath: string, alias?: string) => {
      const propertyMeta = meta.properties[fieldPath];

      if (fieldPath.includes('.')) {
        const [rel, relField] = fieldPath.split('.');
        const expression = `${ensureJoin(rel)}.${relField}`;

        return {
          expression,
          groupBy: expression,
          select: alias
            ? raw<RawQueryFragment>(`${expression} as ${alias}`)
            : expression,
        };
      }

      if (
        propertyMeta &&
        ['m:1', '1:1'].includes(propertyMeta.kind ?? '') &&
        propertyMeta.fieldNames?.[0]
      ) {
        const expression = `e.${propertyMeta.fieldNames[0]}`;

        return {
          expression,
          groupBy: expression,
          select: raw<RawQueryFragment>(
            `${expression} as ${alias || fieldPath}`,
          ),
        };
      }

      const expression = `e.${fieldPath}`;

      return {
        expression,
        groupBy: expression,
        select: alias
          ? raw<RawQueryFragment>(`${expression} as ${alias}`)
          : expression,
      };
    };
    const field = this.kpi.field;
    const aggregation = this.kpi.aggregation.handle.toUpperCase();
    const aggregateField = field.includes('.')
      ? (() => {
          const [relation, relationField] = field.split('.');
          return `${ensureJoin(relation)}.${relationField}`;
        })()
      : `e.${field}`;
    const bucketExpression = this.timeframePlanner.buildBucketExpression(
      `e.${timeframeField}`,
      buckets,
    );
    const groupFields =
      groupBy?.map((gb) =>
        resolveField(gb, gb.includes('.') ? gb.split('.')[1] : gb),
      ) ?? [];
    const where = this.combineWhere(baseWhere, {
      [timeframeField]: {
        $gte: buckets[0].start,
        $lte: buckets[buckets.length - 1].end,
      },
    });

    qb.select([
      raw<RawQueryFragment>(`${bucketExpression} as bucket_index`),
      ...groupFields.map((groupField) => groupField.select),
      raw<RawQueryFragment>(`${aggregation}(${aggregateField}) as value`),
    ]);
    qb.where(where);
    qb.groupBy([
      raw<RawQueryFragment>(bucketExpression),
      ...groupFields.map((groupField) => groupField.groupBy),
    ]);

    const queryResult: unknown = await qb.execute();
    const rows = Array.isArray(queryResult)
      ? (queryResult as unknown[]).filter(
          (row): row is Record<string, unknown> =>
            typeof row === 'object' && row !== null && !Array.isArray(row),
        )
      : [];
    const rowsByBucket = new Map<number, Array<Record<string, unknown>>>();

    for (const row of rows) {
      const bucketIndex = Number(row.bucket_index);
      if (!Number.isInteger(bucketIndex)) {
        continue;
      }

      const rowWithoutBucket = { ...row };
      delete rowWithoutBucket.bucket_index;
      rowsByBucket.set(bucketIndex, [
        ...(rowsByBucket.get(bucketIndex) ?? []),
        rowWithoutBucket,
      ]);
    }

    return buckets.map((bucket, index) => {
      const bucketRows = rowsByBucket.get(index) ?? [];
      const value =
        groupFields.length > 0
          ? bucketRows
          : ((bucketRows[0]?.value as number | object | null | undefined) ??
            null);

      return bucket.createPoint(value);
    });
  }
}
