import { KPIExecutor } from './kpi.executor';
import type { KpiItem } from '../../entity/KpiItem';

function createKpi(overrides: Partial<KpiItem> = {}): KpiItem {
  return {
    name: 'Test KPI',
    field: 'handle',
    aggregation: { handle: 'COUNT' },
    type: { handle: 'RATIO' },
    targetEntity: { handle: 'ticket' },
    secondaryAggregation: { handle: 'COUNT' },
    secondaryField: 'handle',
    formulaOperation: 'DIVIDE',
    formulaScale: 100,
    ...overrides,
  } as KpiItem;
}

describe('KPIExecutor formula and target calculations', () => {
  it('calculates a scaled ratio and exposes both operands', async () => {
    const executor = new KPIExecutor({} as never, createKpi());
    jest
      .spyOn(executor as never, 'aggregate' as never)
      .mockResolvedValueOnce(8 as never)
      .mockResolvedValueOnce(10 as never);

    await expect(executor.executeFormula({}, {})).resolves.toEqual({
      value: 80,
      primaryValue: 8,
      secondaryValue: 10,
      operation: 'DIVIDE',
      scale: 100,
      unit: null,
    });
  });

  it('returns no formula value when the denominator is zero', async () => {
    const executor = new KPIExecutor({} as never, createKpi());
    jest
      .spyOn(executor as never, 'aggregate' as never)
      .mockResolvedValueOnce(8 as never)
      .mockResolvedValueOnce(0 as never);

    expect((await executor.executeFormula({}, {})).value).toBeNull();
  });

  it('applies higher-is-better traffic-light thresholds', async () => {
    const executor = new KPIExecutor(
      {} as never,
      createKpi({
        type: { handle: 'TARGET' } as never,
        secondaryAggregation: undefined,
        secondaryField: undefined,
        formulaScale: 1,
        targetValue: 95,
        warningThreshold: 90,
        criticalThreshold: 80,
      }),
    );
    jest
      .spyOn(executor as never, 'aggregate' as never)
      .mockResolvedValueOnce(85 as never);

    const result = await executor.executeTarget({});
    expect(result.status).toBe('warning');
    expect(result.progressPercent).toBeCloseTo(89.47, 2);
  });

  it('marks a lower-is-better error count as critical at its limit', async () => {
    const executor = new KPIExecutor(
      {} as never,
      createKpi({
        type: { handle: 'TARGET' } as never,
        secondaryAggregation: undefined,
        secondaryField: undefined,
        formulaScale: 1,
        targetValue: 0,
        targetDirection: 'LOWER_IS_BETTER',
        warningThreshold: 5,
        criticalThreshold: 10,
      }),
    );
    jest
      .spyOn(executor as never, 'aggregate' as never)
      .mockResolvedValueOnce(10 as never);

    expect((await executor.executeTarget({})).status).toBe('critical');
  });
});
