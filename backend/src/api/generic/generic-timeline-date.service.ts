import { Injectable } from '@nestjs/common';
import type {
  TimelineDateFieldConfig,
  TimelineDateSpan,
  TimelineDescriptorDataset,
  TimelineMonthWindow,
} from './generic-timeline.types';

/** Owns timeline date spans, cursor windows, and drilldown filters. */
@Injectable()
export class GenericTimelineDateService {
  getLowerBound(datasets: TimelineDescriptorDataset[]): Date | null {
    let earliestDate: Date | null = null;
    for (const dataset of datasets) {
      for (const record of dataset.records) {
        const span = this.getDateSpan(record, dataset.descriptor.dateFields);
        const candidateDate = span.start ?? span.end;
        if (
          candidateDate &&
          (!earliestDate || candidateDate.getTime() < earliestDate.getTime())
        ) {
          earliestDate = candidateDate;
        }
      }
    }
    return earliestDate ? this.getMonthStart(earliestDate) : null;
  }

  buildRecordUpperBoundFilter(
    dateFields: TimelineDateFieldConfig,
    upperBound: Date,
  ): object {
    return this.buildBoundaryComparisonFilter(
      dateFields.startFieldName,
      dateFields.startFallbackFieldName,
      '$lte',
      upperBound,
    );
  }

  buildRecordWindowFilter(
    dateFields: TimelineDateFieldConfig,
    lowerBound: Date,
    upperBound: Date,
  ): object {
    return {
      $and: [
        this.buildBoundaryComparisonFilter(
          dateFields.startFieldName,
          dateFields.startFallbackFieldName,
          '$lte',
          upperBound,
        ),
        this.buildBoundaryComparisonFilter(
          dateFields.endFieldName,
          dateFields.endFallbackFieldName,
          '$gte',
          lowerBound,
        ),
      ],
    };
  }

  buildRecordBeforeFilter(
    dateFields: TimelineDateFieldConfig,
    boundary: Date,
  ): object {
    return this.buildBoundaryComparisonFilter(
      dateFields.startFieldName,
      dateFields.startFallbackFieldName,
      '$lt',
      boundary,
    );
  }

  createMonthWindow(baseDate: Date): TimelineMonthWindow {
    const start = this.getMonthStart(baseDate);
    const end = this.getMonthEnd(baseDate);
    const month = String(start.getMonth() + 1).padStart(2, '0');
    const year = start.getFullYear();
    return { key: `${year}-${month}`, label: `${month}/${year}`, start, end };
  }

  parseCursor(value?: string): Date | null {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value.trim())) {
      return null;
    }
    const [year, month] = value.trim().split('-').map(Number);
    return !year || !month || month < 1 || month > 12
      ? null
      : new Date(year, month - 1, 1);
  }

  formatCursor(value: Date): string {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  }

  getMonthStart(value: Date): Date {
    return new Date(value.getFullYear(), value.getMonth(), 1, 0, 0, 0, 0);
  }

  addMonths(value: Date, delta: number): Date {
    return new Date(
      value.getFullYear(),
      value.getMonth() + delta,
      1,
      0,
      0,
      0,
      0,
    );
  }

  combineWhere(base: object, addition: object): object {
    if (!base || Object.keys(base).length === 0) {
      return addition;
    }
    if (!addition || Object.keys(addition).length === 0) {
      return base;
    }
    return { $and: [base, addition] };
  }

  buildMonthFilter(
    relationFilter: object,
    dateFields: TimelineDateFieldConfig,
    monthWindow: TimelineMonthWindow,
  ): object {
    return this.combineWhere(
      relationFilter,
      this.buildPrimarySpanOverlapFilter(dateFields, monthWindow),
    );
  }

  buildActivityFilter(
    relationFilter: object,
    dateFields: TimelineDateFieldConfig,
    boundary: 'start' | 'end',
    monthWindow: TimelineMonthWindow,
  ): object {
    const fieldName =
      boundary === 'start'
        ? dateFields.startFieldName
        : dateFields.endFieldName;
    return this.combineWhere(
      relationFilter,
      this.buildBoundaryMonthFilter(fieldName, monthWindow),
    );
  }

  getDateSpan(
    record: Record<string, unknown>,
    dateFields: TimelineDateFieldConfig,
  ): TimelineDateSpan {
    const primaryStart = this.getRecordDate(record[dateFields.startFieldName]);
    const fallbackStart =
      dateFields.startFieldName !== dateFields.startFallbackFieldName
        ? this.getRecordDate(record[dateFields.startFallbackFieldName])
        : null;
    const primaryEnd = this.getRecordDate(record[dateFields.endFieldName]);
    const fallbackEnd =
      dateFields.endFieldName !== dateFields.endFallbackFieldName
        ? this.getRecordDate(record[dateFields.endFallbackFieldName])
        : null;
    const start = primaryStart ?? fallbackStart ?? primaryEnd ?? fallbackEnd;
    const end = primaryEnd ?? fallbackEnd ?? primaryStart ?? fallbackStart;
    return { start: start ?? null, end: end ?? null };
  }

  filterRecordsByMonth(
    records: Record<string, unknown>[],
    dateFields: TimelineDateFieldConfig,
    monthWindow: TimelineMonthWindow,
  ): Record<string, unknown>[] {
    return records.filter((record) => {
      const span = this.getDateSpan(record, dateFields);
      const start = span.start ?? span.end;
      const end = span.end ?? span.start;
      return Boolean(
        start &&
        end &&
        start.getTime() <= monthWindow.end.getTime() &&
        end.getTime() >= monthWindow.start.getTime(),
      );
    });
  }

  isBoundaryWithinMonth(
    record: Record<string, unknown>,
    dateFields: TimelineDateFieldConfig,
    boundary: 'start' | 'end',
    monthWindow: TimelineMonthWindow,
  ): boolean {
    const span = this.getDateSpan(record, dateFields);
    const parsedDate = boundary === 'start' ? span.start : span.end;
    return Boolean(
      parsedDate &&
      parsedDate.getTime() >= monthWindow.start.getTime() &&
      parsedDate.getTime() <= monthWindow.end.getTime(),
    );
  }

  private buildPrimarySpanOverlapFilter(
    dateFields: TimelineDateFieldConfig,
    monthWindow: TimelineMonthWindow,
  ): object {
    const monthEndExclusive = this.getMonthEndExclusive(monthWindow);
    return {
      $and: [
        { [dateFields.startFieldName]: { $lt: monthEndExclusive } },
        { [dateFields.endFieldName]: { $gte: monthWindow.start } },
      ],
    };
  }

  private buildBoundaryComparisonFilter(
    fieldName: string,
    fallbackFieldName: string,
    operator: '$gte' | '$lte' | '$lt',
    value: Date,
  ): object {
    if (fieldName === fallbackFieldName) {
      return { [fieldName]: { [operator]: value } };
    }
    return {
      $or: [
        { [fieldName]: { [operator]: value } },
        {
          $and: [
            { [fieldName]: null },
            { [fallbackFieldName]: { [operator]: value } },
          ],
        },
      ],
    };
  }

  private buildBoundaryMonthFilter(
    fieldName: string,
    monthWindow: TimelineMonthWindow,
  ): object {
    return {
      [fieldName]: {
        $gte: monthWindow.start,
        $lt: this.getMonthEndExclusive(monthWindow),
      },
    };
  }

  private getMonthEndExclusive(monthWindow: TimelineMonthWindow): Date {
    return new Date(monthWindow.end.getTime() + 1);
  }

  private getMonthEnd(value: Date): Date {
    return new Date(
      value.getFullYear(),
      value.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
  }

  private getRecordDate(value: unknown): Date | null {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsedDate = new Date(value);
      return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
    }
    return null;
  }
}
