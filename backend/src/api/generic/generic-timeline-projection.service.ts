import { Injectable } from '@nestjs/common';
import { TemplateService } from '../template/template.service';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import {
  TimelineEntitySummaryDto,
  TimelineMonthDto,
  TimelineRecordAnchorDto,
  TimelineSummaryGroupDto,
  TimelineSummaryGroupItemDto,
} from './dto/timeline-response.dto';
import { GenericTimelineDateService } from './generic-timeline-date.service';
import type {
  TimelineDateFieldConfig,
  TimelineDescriptorDataset,
  TimelineGroupIdentity,
  TimelineMonthWindow,
  TimelineRelationDescriptor,
} from './generic-timeline.types';

/** Projects timeline datasets into anchors, monthly summaries, and drilldowns. */
@Injectable()
export class GenericTimelineProjectionService {
  constructor(
    private readonly templateService: TemplateService,
    private readonly dateService: GenericTimelineDateService,
  ) {}

  buildAnchor(
    entityHandle: string,
    handle: string | number,
    record: Record<string, unknown>,
    template: EntityTemplateDto[],
    dateFields: TimelineDateFieldConfig,
  ): TimelineRecordAnchorDto {
    const anchor = new TimelineRecordAnchorDto();
    const span = this.dateService.getDateSpan(record, dateFields);
    anchor.entityHandle = entityHandle;
    anchor.handle = handle;
    anchor.label = this.buildRecordLabel(record, template, entityHandle);
    anchor.startField = dateFields.startFieldName;
    anchor.endField = dateFields.endFieldName;
    anchor.startAt = span.start ? span.start.toISOString() : null;
    anchor.endAt = span.end ? span.end.toISOString() : null;
    anchor.record = record;
    return anchor;
  }

  buildMonth(
    datasets: TimelineDescriptorDataset[],
    monthWindow: TimelineMonthWindow,
  ): TimelineMonthDto {
    const month = new TimelineMonthDto();
    month.key = monthWindow.key;
    month.label = monthWindow.label;
    month.start = monthWindow.start.toISOString();
    month.end = monthWindow.end.toISOString();

    for (const dataset of datasets) {
      const entitySummary = this.buildEntitySummary(dataset, monthWindow);
      if (entitySummary) {
        month.entities.push(entitySummary);
      }
    }
    month.entities.sort((left, right) => right.count - left.count);
    return month;
  }

  private buildEntitySummary(
    dataset: TimelineDescriptorDataset,
    monthWindow: TimelineMonthWindow,
  ): TimelineEntitySummaryDto | null {
    const { descriptor, relationFilter, records } = dataset;
    const monthRecords = this.dateService.filterRecordsByMonth(
      records,
      descriptor.dateFields,
      monthWindow,
    );
    if (monthRecords.length === 0) {
      return null;
    }

    const summary = new TimelineEntitySummaryDto();
    summary.entityHandle = descriptor.entityHandle;
    summary.label = this.humanizeKey(descriptor.entityHandle);
    summary.relationCategory = descriptor.relationCategory;
    summary.relationFields = descriptor.relationFields.map(
      (field) => field.name,
    );
    summary.count = monthRecords.length;
    summary.startCount = monthRecords.filter((record) =>
      this.dateService.isBoundaryWithinMonth(
        record,
        descriptor.dateFields,
        'start',
        monthWindow,
      ),
    ).length;
    summary.endCount = monthRecords.filter((record) =>
      this.dateService.isBoundaryWithinMonth(
        record,
        descriptor.dateFields,
        'end',
        monthWindow,
      ),
    ).length;
    summary.startField = descriptor.dateFields.startFieldName;
    summary.endField = descriptor.dateFields.endFieldName;
    summary.startFilter = this.dateService.buildActivityFilter(
      relationFilter,
      descriptor.dateFields,
      'start',
      monthWindow,
    ) as Record<string, unknown>;
    summary.endFilter = this.dateService.buildActivityFilter(
      relationFilter,
      descriptor.dateFields,
      'end',
      monthWindow,
    ) as Record<string, unknown>;
    summary.groups = [
      ...this.buildChipGroups(
        descriptor,
        relationFilter,
        monthRecords,
        monthWindow,
      ),
      ...this.buildBooleanGroups(
        descriptor,
        relationFilter,
        monthRecords,
        monthWindow,
      ),
    ];
    return summary;
  }

  private buildChipGroups(
    descriptor: TimelineRelationDescriptor,
    relationFilter: object,
    records: Record<string, unknown>[],
    monthWindow: TimelineMonthWindow,
  ): TimelineSummaryGroupDto[] {
    return descriptor.chipFields
      .map((field) => {
        const items = new Map<
          string,
          {
            identity: TimelineGroupIdentity;
            count: number;
            amount: number | null;
          }
        >();

        for (const record of records) {
          const identity = this.getGroupIdentity(field, record[field.name]);
          if (!identity) {
            continue;
          }
          const entry = items.get(identity.key) ?? {
            identity,
            count: 0,
            amount: descriptor.moneyField ? 0 : null,
          };
          entry.count += 1;
          if (descriptor.moneyField) {
            const amount = this.getNumericValue(
              record[descriptor.moneyField.name],
            );
            if (amount != null && entry.amount != null) {
              entry.amount += amount;
            }
          }
          items.set(identity.key, entry);
        }

        if (items.size === 0) {
          return null;
        }
        const group = new TimelineSummaryGroupDto();
        group.field = field.name;
        group.label = this.humanizeKey(field.name);
        group.items = [...items.values()]
          .sort((left, right) => right.count - left.count)
          .map((entry) =>
            this.createGroupItem(
              entry.identity,
              entry.count,
              entry.amount,
              descriptor.moneyField?.name ?? null,
              this.dateService.combineWhere(
                this.dateService.buildMonthFilter(
                  relationFilter,
                  descriptor.dateFields,
                  monthWindow,
                ),
                { [field.name]: entry.identity.rawValue },
              ),
            ),
          );
        return group;
      })
      .filter((group): group is TimelineSummaryGroupDto => group !== null);
  }

  private buildBooleanGroups(
    descriptor: TimelineRelationDescriptor,
    relationFilter: object,
    records: Record<string, unknown>[],
    monthWindow: TimelineMonthWindow,
  ): TimelineSummaryGroupDto[] {
    if (descriptor.chipFields.length > 0) {
      return [];
    }

    return descriptor.booleanFields
      .map((field) => {
        const counts = {
          true: records.filter((record) => record[field.name] === true).length,
          false: records.filter((record) => record[field.name] === false)
            .length,
        };
        if (counts.true === 0 && counts.false === 0) {
          return null;
        }

        const group = new TimelineSummaryGroupDto();
        group.field = field.name;
        group.label = this.humanizeKey(field.name);
        group.items = (
          [
            { key: 'true', label: 'Ja', rawValue: true, count: counts.true },
            {
              key: 'false',
              label: 'Nein',
              rawValue: false,
              count: counts.false,
            },
          ] as const
        )
          .filter((entry) => entry.count > 0)
          .map((entry) =>
            this.createGroupItem(
              entry,
              entry.count,
              null,
              null,
              this.dateService.combineWhere(
                this.dateService.buildMonthFilter(
                  relationFilter,
                  descriptor.dateFields,
                  monthWindow,
                ),
                { [field.name]: entry.rawValue },
              ),
            ),
          );
        return group;
      })
      .filter((group): group is TimelineSummaryGroupDto => group !== null);
  }

  private createGroupItem(
    identity: TimelineGroupIdentity,
    count: number,
    amount: number | null,
    moneyField: string | null,
    drilldownFilter: object,
  ): TimelineSummaryGroupItemDto {
    const item = new TimelineSummaryGroupItemDto();
    item.key = identity.key;
    item.label = identity.label;
    item.color = identity.color ?? null;
    item.icon = identity.icon ?? null;
    item.count = count;
    item.amount = amount;
    item.moneyField = moneyField;
    item.drilldownFilter = drilldownFilter as Record<string, unknown>;
    return item;
  }

  private getGroupIdentity(
    field: EntityTemplateDto,
    value: unknown,
  ): TimelineGroupIdentity | null {
    if (value == null) {
      return null;
    }
    if (typeof value === 'object') {
      const referenceValue = value as Record<string, unknown>;
      const rawValue = this.extractHandleValue(referenceValue);
      const label =
        this.buildRecordLabel(
          referenceValue,
          field.referenceName
            ? this.templateService.getEntityTemplate(field.referenceName)
            : [],
          field.referenceName,
        ) || String(rawValue ?? '-');
      return {
        key: String(rawValue ?? label),
        label,
        color:
          typeof referenceValue.color === 'string'
            ? referenceValue.color
            : null,
        icon:
          typeof referenceValue.icon === 'string' ? referenceValue.icon : null,
        rawValue: rawValue ?? null,
      };
    }
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return { key: String(value), label: String(value), rawValue: value };
    }
    return null;
  }

  private buildRecordLabel(
    record: Record<string, unknown>,
    template: EntityTemplateDto[],
    fallback?: string,
  ): string {
    const compactParts = template
      .filter((field) => field.options?.includes('isValue'))
      .map((field) => this.getDisplayValue(field, record[field.name]))
      .filter((value): value is string => value.length > 0);
    if (compactParts.length > 0) {
      return compactParts.join(' ');
    }

    for (const fieldName of [
      'title',
      'name',
      'description',
      'number',
      'handle',
    ]) {
      const value = record[fieldName];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
    }
    return fallback ? this.humanizeKey(fallback) : '-';
  }

  private getDisplayValue(field: EntityTemplateDto, value: unknown): string {
    if (value == null) {
      return '';
    }
    if (typeof value === 'object' && field.referenceName) {
      return this.buildRecordLabel(
        value as Record<string, unknown>,
        this.templateService.getEntityTemplate(field.referenceName),
        field.referenceName,
      );
    }
    if (typeof value === 'string') {
      return value.trim();
    }
    return typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : '';
  }

  private getNumericValue(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsedValue = Number(value);
      return Number.isFinite(parsedValue) ? parsedValue : null;
    }
    return null;
  }

  private humanizeKey(value: string): string {
    return value
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^./, (character) => character.toUpperCase());
  }

  private extractHandleValue(
    value: unknown,
  ): string | number | null | undefined {
    if (
      value == null ||
      typeof value === 'string' ||
      typeof value === 'number'
    ) {
      return value;
    }
    if (typeof value !== 'object') {
      return undefined;
    }

    const objectValue = value as Record<string, unknown>;
    if (
      'unwrap' in value &&
      typeof (value as { unwrap?: unknown }).unwrap === 'function'
    ) {
      return this.extractHandleValue(
        (value as { unwrap: () => unknown }).unwrap(),
      );
    }
    if (
      'getEntity' in value &&
      typeof (value as { getEntity?: unknown }).getEntity === 'function'
    ) {
      return this.extractHandleValue(
        (value as { getEntity: () => unknown }).getEntity(),
      );
    }
    if ('handle' in objectValue) {
      const nestedHandle = objectValue.handle;
      if (
        nestedHandle == null ||
        typeof nestedHandle === 'string' ||
        typeof nestedHandle === 'number'
      ) {
        return nestedHandle;
      }
    }
    return undefined;
  }
}
