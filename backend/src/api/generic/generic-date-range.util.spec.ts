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

  const legacyRange = {
    startDate: new Date('2026-09-01T11:00:00.000Z'),
    endDate: new Date('2026-09-01T10:00:00.000Z'),
  };

  it.each([
    { status: 'completed' },
    { status: 'completed', startDate: '2026-09-01T11:00:00.000Z' },
    {
      status: 'completed',
      startDate: '2026-09-01T13:00:00+02:00',
      endDate: '2026-09-01T12:00:00+02:00',
    },
  ])('accepts unchanged legacy ranges on update: %j', (payload) => {
    expect(() =>
      assertGenericDateRanges(templates, payload, legacyRange),
    ).not.toThrow();
  });

  it.each([
    { startDate: '2026-09-01T12:00:00.000Z' },
    { endDate: '2026-09-01T09:00:00.000Z' },
    { status: 'completed', endDate: '2026-09-01T10:30:00.000Z' },
  ])('rejects changed ranges that remain invalid: %j', (payload) => {
    expect(() =>
      assertGenericDateRanges(templates, payload, legacyRange),
    ).toThrow('global.invalidDateRange');
  });

  it('allows correcting a legacy range', () => {
    expect(() =>
      assertGenericDateRanges(
        templates,
        { endDate: '2026-09-01T12:00:00.000Z' },
        legacyRange,
      ),
    ).not.toThrow();
  });

  it('validates each changed pair independently of unchanged legacy ranges', () => {
    expect(() =>
      assertGenericDateRanges(
        templates,
        { resolvedAt: '2026-09-01T09:00:00.000Z' },
        {
          ...legacyRange,
          firstRespondedAt: new Date('2026-09-01T10:00:00.000Z'),
        },
      ),
    ).toThrow('global.invalidDateRange');

    expect(() =>
      assertGenericDateRanges(
        templates,
        { resolvedAt: '2026-09-01T11:00:00.000Z' },
        {
          ...legacyRange,
          firstRespondedAt: new Date('2026-09-01T10:00:00.000Z'),
        },
      ),
    ).not.toThrow();
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
