import { describe, expect, it } from '@jest/globals';
import { KpiTimeframePlanner } from './kpi-timeframe-planner';

describe('KpiTimeframePlanner', () => {
  const planner = new KpiTimeframePlanner();
  const now = new Date(2026, 6, 16, 12, 0, 0, 0);

  it('builds current and previous month ranges', () => {
    expect(planner.getTimeRange('MONTH', now)).toEqual({
      start: new Date(2026, 6, 1),
      end: new Date(2026, 7, 0, 23, 59, 59, 999),
    });
    expect(planner.getPreviousTimeRange('MONTH', now)).toEqual({
      start: new Date(2026, 5, 1),
      end: new Date(2026, 6, 0, 23, 59, 59, 999),
    });
  });

  it('creates twelve rolling month buckets for a yearly sparkline', () => {
    const buckets = planner.getSparklineBuckets('YEAR', 'MONTH', now);

    expect(buckets).toHaveLength(12);
    expect(buckets[0]).toMatchObject({ key: '2025-8', label: '08/2025' });
    expect(buckets[11]).toMatchObject({ key: '2026-7', label: '07/2026' });
    expect(buckets[11].createPoint(42)).toMatchObject({
      month: 7,
      year: 2026,
      value: 42,
    });
  });

  it('returns no buckets for unsupported timeframe combinations', () => {
    expect(planner.getSparklineBuckets('DAY', 'MONTH', now)).toEqual([]);
  });
});
