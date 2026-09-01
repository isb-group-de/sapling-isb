import { BadRequestException } from '@nestjs/common';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import {
  assertGenericDateRanges,
  getGenericDateRangePairs,
} from './generic-date-range.util';

const field = (
  name: string,
  options: EntityTemplateDto['options'],
  formGroup: string | null,
  formOrder: number,
): EntityTemplateDto =>
  ({
    name,
    type: 'datetime',
    options,
    formGroup,
    formOrder,
  }) as EntityTemplateDto;

describe('generic date range validation', () => {
  const templates = [
    field('startDate', ['isDateStart'], 'schedule', 100),
    field('endDate', ['isDateEnd'], 'schedule', 200),
    field('firstRespondedAt', ['isDateStart'], 'sla', 100),
    field('resolvedAt', ['isDateEnd'], 'sla', 200),
    field('publishedAt', ['isDateStart'], 'lifecycle', 100),
  ];

  it('pairs start and end markers within their form group', () => {
    expect(
      getGenericDateRangePairs(templates).map((pair) => [
        pair.start.name,
        pair.end.name,
      ]),
    ).toEqual([
      ['startDate', 'endDate'],
      ['firstRespondedAt', 'resolvedAt'],
    ]);
  });

  it('accepts equal and ascending date ranges', () => {
    expect(() =>
      assertGenericDateRanges(templates, {
        startDate: '2026-09-01T10:00:00.000Z',
        endDate: '2026-09-01T10:00:00.000Z',
      }),
    ).not.toThrow();

    expect(() =>
      assertGenericDateRanges(templates, {
        startDate: '2026-09-01T10:00:00.000Z',
        endDate: '2026-09-01T11:00:00.000Z',
      }),
    ).not.toThrow();
  });

  it('rejects an end before its start', () => {
    expect(() =>
      assertGenericDateRanges(templates, {
        startDate: '2026-09-01T11:00:00.000Z',
        endDate: '2026-09-01T10:00:00.000Z',
      }),
    ).toThrow(BadRequestException);
  });

  it('validates partial updates against the persisted counterpart', () => {
    expect(() =>
      assertGenericDateRanges(
        templates,
        { startDate: new Date('2026-09-01T12:00:00.000Z') },
        { endDate: new Date('2026-09-01T11:00:00.000Z') },
      ),
    ).toThrow('global.invalidDateRange');
  });

  it('ignores incomplete, unmatched, and unparsable ranges', () => {
    expect(() =>
      assertGenericDateRanges(templates, {
        startDate: 'not-a-date',
        publishedAt: '2026-09-01T12:00:00.000Z',
      }),
    ).not.toThrow();
  });
});
