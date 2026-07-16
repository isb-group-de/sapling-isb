import { SparklineDayPointDto } from './dto/sparkline-day-point.dto';
import { SparklineMonthPointDto } from './dto/sparkline-month-point.dto';
import { SparklineWeekPointDto } from './dto/sparkline-week-point.dto';

export type SparklinePointDto =
  | SparklineMonthPointDto
  | SparklineDayPointDto
  | SparklineWeekPointDto;

export type SparklineBucket = {
  key: string;
  label: string;
  start: Date;
  end: Date;
  createPoint: (value: number | object | null) => SparklinePointDto;
};

export type KpiTimeRange = { start: Date; end: Date };

export class KpiTimeframePlanner {
  buildBucketExpression(
    fieldExpression: string,
    buckets: SparklineBucket[],
  ): string {
    const conditions = buckets
      .map(
        (bucket, index) =>
          `when ${fieldExpression} >= '${bucket.start.toISOString()}'::timestamptz and ${fieldExpression} <= '${bucket.end.toISOString()}'::timestamptz then ${index}`,
      )
      .join(' ');
    return `case ${conditions} end`;
  }

  getSparklineBuckets(
    timeframe: string | undefined,
    interval: string | undefined,
    now: Date,
  ): SparklineBucket[] {
    if (timeframe === 'YEAR' && interval === 'MONTH') {
      return this.getYearMonthBuckets(now);
    }
    if (timeframe === 'MONTH' && interval === 'DAY') {
      return this.getMonthDayBuckets(now);
    }
    if (timeframe === 'MONTH' && interval === 'WEEK') {
      return this.getMonthWeekBuckets(now);
    }
    if (timeframe === 'QUARTER' && interval === 'MONTH') {
      return this.getQuarterMonthBuckets(now);
    }
    return [];
  }

  getTimeRange(timeframe: string | undefined, now: Date): KpiTimeRange | null {
    if (timeframe === 'MONTH') {
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        ),
      };
    }
    if (timeframe === 'YEAR') {
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
      };
    }
    if (timeframe === 'QUARTER') {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      return {
        start: new Date(now.getFullYear(), quarterStartMonth, 1),
        end: new Date(
          now.getFullYear(),
          quarterStartMonth + 3,
          0,
          23,
          59,
          59,
          999,
        ),
      };
    }
    if (timeframe === 'WEEK') {
      const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
      return {
        start: new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - dayOfWeek + 1,
        ),
        end: new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - dayOfWeek + 7,
          23,
          59,
          59,
          999,
        ),
      };
    }
    if (timeframe === 'DAY') {
      return {
        start: new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          0,
          0,
          0,
          0,
        ),
        end: new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
          999,
        ),
      };
    }
    return null;
  }

  getPreviousTimeRange(
    timeframe: string | undefined,
    now: Date,
  ): KpiTimeRange | null {
    if (timeframe === 'MONTH') {
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
      };
    }
    if (timeframe === 'YEAR') {
      return {
        start: new Date(now.getFullYear() - 1, 0, 1),
        end: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999),
      };
    }
    if (timeframe === 'QUARTER') {
      const currentQuarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      const previousQuarterStartMonth = currentQuarterStartMonth - 3;
      const previousQuarterYear =
        previousQuarterStartMonth < 0
          ? now.getFullYear() - 1
          : now.getFullYear();
      const normalizedQuarterStartMonth =
        previousQuarterStartMonth < 0
          ? previousQuarterStartMonth + 12
          : previousQuarterStartMonth;
      return {
        start: new Date(previousQuarterYear, normalizedQuarterStartMonth, 1),
        end: new Date(
          previousQuarterYear,
          normalizedQuarterStartMonth + 3,
          0,
          23,
          59,
          59,
          999,
        ),
      };
    }
    if (timeframe === 'WEEK') {
      const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
      return {
        start: new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - dayOfWeek - 6,
        ),
        end: new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - dayOfWeek,
          23,
          59,
          59,
          999,
        ),
      };
    }
    if (timeframe === 'DAY') {
      return {
        start: new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 1,
          0,
          0,
          0,
          0,
        ),
        end: new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 1,
          23,
          59,
          59,
          999,
        ),
      };
    }
    return null;
  }

  formatDate(date: Date): string {
    const day = `${date.getDate()}`.padStart(2, '0');
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    return `${day}.${month}.${date.getFullYear()}`;
  }

  private getYearMonthBuckets(now: Date): SparklineBucket[] {
    const buckets: SparklineBucket[] = [];
    for (let index = 11; index >= 0; index -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      buckets.push({
        key: `${start.getFullYear()}-${start.getMonth() + 1}`,
        label: `${`${start.getMonth() + 1}`.padStart(2, '0')}/${start.getFullYear()}`,
        start,
        end,
        createPoint: (value) =>
          new SparklineMonthPointDto(
            start.getMonth() + 1,
            start.getFullYear(),
            value,
          ),
      });
    }
    return buckets;
  }

  private getMonthDayBuckets(now: Date): SparklineBucket[] {
    const buckets: SparklineBucket[] = [];
    for (let index = 29; index >= 0; index -= 1) {
      const date = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - index,
      );
      const start = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        0,
        0,
        0,
        0,
      );
      const end = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        23,
        59,
        59,
        999,
      );
      buckets.push({
        key: `${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}`,
        label: this.formatDate(start),
        start,
        end,
        createPoint: (value) =>
          new SparklineDayPointDto(
            start.getDate(),
            start.getMonth() + 1,
            start.getFullYear(),
            value,
          ),
      });
    }
    return buckets;
  }

  private getMonthWeekBuckets(now: Date): SparklineBucket[] {
    const buckets: SparklineBucket[] = [];
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    const weekStart = new Date(firstDayOfMonth);
    let weekNumber = 1;

    while (weekStart <= lastDayOfMonth) {
      let weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      if (weekEnd > lastDayOfMonth) weekEnd = new Date(lastDayOfMonth);

      const start = new Date(weekStart);
      const end = new Date(weekEnd);
      const bucketWeek = weekNumber;
      buckets.push({
        key: `${start.getFullYear()}-${start.getMonth() + 1}-W${bucketWeek}`,
        label: `W${bucketWeek} ${`${start.getMonth() + 1}`.padStart(2, '0')}/${start.getFullYear()}`,
        start,
        end,
        createPoint: (value) =>
          new SparklineWeekPointDto(
            bucketWeek,
            start.getMonth() + 1,
            start.getFullYear(),
            value,
          ),
      });
      weekStart.setDate(weekStart.getDate() + 7);
      weekStart.setHours(0, 0, 0, 0);
      weekNumber += 1;
    }
    return buckets;
  }

  private getQuarterMonthBuckets(now: Date): SparklineBucket[] {
    const buckets: SparklineBucket[] = [];
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    for (let index = 0; index < 3; index += 1) {
      const start = new Date(now.getFullYear(), quarterStartMonth + index, 1);
      const end = new Date(
        now.getFullYear(),
        quarterStartMonth + index + 1,
        0,
        23,
        59,
        59,
        999,
      );
      buckets.push({
        key: `${start.getFullYear()}-${start.getMonth() + 1}`,
        label: `${`${start.getMonth() + 1}`.padStart(2, '0')}/${start.getFullYear()}`,
        start,
        end,
        createPoint: (value) =>
          new SparklineMonthPointDto(
            start.getMonth() + 1,
            start.getFullYear(),
            value,
          ),
      });
    }
    return buckets;
  }
}
