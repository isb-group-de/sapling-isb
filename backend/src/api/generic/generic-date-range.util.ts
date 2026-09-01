import { BadRequestException } from '@nestjs/common';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';

export type GenericDateRangePair = {
  start: EntityTemplateDto;
  end: EntityTemplateDto;
};

type OrderedTemplate = {
  template: EntityTemplateDto;
  index: number;
};

const UNGROUPED_DATE_RANGE = '__sapling_ungrouped_date_range__';

/**
 * Pairs isDateStart/isDateEnd fields within their declared form group.
 * Multiple pairs in one group are matched by form order and then declaration
 * order. Unmatched markers remain valid standalone timeline anchors.
 */
export function getGenericDateRangePairs(
  templates: EntityTemplateDto[],
): GenericDateRangePair[] {
  const groups = new Map<
    string,
    { starts: OrderedTemplate[]; ends: OrderedTemplate[] }
  >();

  templates.forEach((template, index) => {
    const isStart = template.options?.includes('isDateStart') === true;
    const isEnd = template.options?.includes('isDateEnd') === true;
    if (!isStart && !isEnd) {
      return;
    }

    const groupKey = template.formGroup ?? UNGROUPED_DATE_RANGE;
    const group = groups.get(groupKey) ?? { starts: [], ends: [] };
    if (isStart) {
      group.starts.push({ template, index });
    }
    if (isEnd) {
      group.ends.push({ template, index });
    }
    groups.set(groupKey, group);
  });

  const sortByFormOrder = (left: OrderedTemplate, right: OrderedTemplate) =>
    (left.template.formOrder ?? left.index) -
    (right.template.formOrder ?? right.index);

  return Array.from(groups.values()).flatMap((group) => {
    const starts = [...group.starts].sort(sortByFormOrder);
    const ends = [...group.ends].sort(sortByFormOrder);
    return starts
      .slice(0, Math.min(starts.length, ends.length))
      .map((start, index) => ({
        start: start.template,
        end: ends[index].template,
      }));
  });
}

export function assertGenericDateRanges(
  templates: EntityTemplateDto[],
  payload: Record<string, unknown>,
  currentItem?: Record<string, unknown>,
): void {
  for (const pair of getGenericDateRangePairs(templates)) {
    const start = getMutationValue(pair.start.name, payload, currentItem);
    const end = getMutationValue(pair.end.name, payload, currentItem);
    const startTimestamp = toTimestamp(start);
    const endTimestamp = toTimestamp(end);

    if (
      startTimestamp !== null &&
      endTimestamp !== null &&
      endTimestamp < startTimestamp
    ) {
      throw new BadRequestException('global.invalidDateRange');
    }
  }
}

function getMutationValue(
  fieldName: string,
  payload: Record<string, unknown>,
  currentItem?: Record<string, unknown>,
): unknown {
  return Object.prototype.hasOwnProperty.call(payload, fieldName)
    ? payload[fieldName]
    : currentItem?.[fieldName];
}

function toTimestamp(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    return null;
  }

  const date =
    value instanceof Date
      ? value
      : typeof value === 'string' || typeof value === 'number'
        ? new Date(value)
        : null;

  return date && !Number.isNaN(date.getTime()) ? date.getTime() : null;
}
