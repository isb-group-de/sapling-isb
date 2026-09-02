import { KpiItem } from '../../entity/KpiItem';
import { KpiDrilldownDto, KpiDrilldownEntryDto } from './dto/kpi-drilldown.dto';
import type { TrendResultDto } from './dto/trend-result.dto';
import {
  KpiTimeframePlanner,
  type SparklinePointDto,
} from './kpi-timeframe-planner';
import {
  combineKpiWhere,
  normalizeKpiWhere,
  type KpiWhere,
} from './kpi-where.utils';

type KpiDrilldownValue =
  number | object | Array<Record<string, unknown>> | null;

export class KpiDrilldownBuilder {
  constructor(
    private readonly kpi: KpiItem,
    private readonly timeframePlanner: KpiTimeframePlanner,
  ) {}

  private createEntry(
    key: string,
    label: string,
    filter: KpiWhere,
    value?: KpiDrilldownValue,
  ): KpiDrilldownEntryDto {
    const entry = new KpiDrilldownEntryDto();
    entry.key = key;
    entry.label = label;
    entry.filter = filter;
    entry.value = value;
    return entry;
  }

  buildBase(baseWhere: object): KpiDrilldownDto | null {
    const entityHandle = this.kpi.targetEntity?.handle;

    if (typeof entityHandle !== 'string' || entityHandle.length === 0) {
      return null;
    }

    const drilldown = new KpiDrilldownDto();
    drilldown.entityHandle = entityHandle;
    drilldown.baseFilter = normalizeKpiWhere(baseWhere);
    return drilldown;
  }

  buildTrend(
    baseWhere: object,
    trend: TrendResultDto | null,
  ): KpiDrilldownDto | null {
    const drilldown = this.buildBase(baseWhere);
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
      drilldown.current = this.createEntry(
        'current',
        `${this.timeframePlanner.formatDate(rangeCurrent.start)} - ${this.timeframePlanner.formatDate(rangeCurrent.end)}`,
        combineKpiWhere(baseWhere, {
          [timeframeField]: {
            $gte: rangeCurrent.start,
            $lte: rangeCurrent.end,
          },
        }),
        trend?.current ?? null,
      );
    }

    if (rangePrevious) {
      drilldown.previous = this.createEntry(
        'previous',
        `${this.timeframePlanner.formatDate(rangePrevious.start)} - ${this.timeframePlanner.formatDate(rangePrevious.end)}`,
        combineKpiWhere(baseWhere, {
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

  buildSparkline(
    baseWhere: object,
    points: SparklinePointDto[] = [],
  ): KpiDrilldownDto | null {
    const drilldown = this.buildBase(baseWhere);
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
      this.createEntry(
        bucket.key,
        bucket.label,
        combineKpiWhere(baseWhere, {
          [timeframeField]: {
            $gte: bucket.start,
            $lte: bucket.end,
          },
        }),
        (points[index]?.value as KpiDrilldownValue | undefined) ?? null,
      ),
    );

    return drilldown;
  }
}
