import { parseTelemetryRepairArgs } from './telemetry-repair';

const valid = [
  '--environment',
  'server',
  '--from',
  '2026-09-03T13:17:00+02:00',
  '--to',
  '2026-09-06T10:00:00Z',
];
describe('telemetry repair arguments', () => {
  it('defaults to preview with explicit environment and time zone', () => {
    expect(parseTelemetryRepairArgs(valid)).toEqual({
      environment: 'server',
      from: new Date('2026-09-03T11:17:00Z'),
      to: new Date('2026-09-06T10:00:00Z'),
      apply: false,
    });
    expect(parseTelemetryRepairArgs([...valid, '--apply']).apply).toBe(true);
  });
  it.each([
    [],
    ['--apply'],
    [...valid, '--apply', '--apply'],
    [...valid, '--unknown'],
    [...valid, '--environment', 'second'],
    valid.map((value) => value.replace('+02:00', '')),
    valid.map((value) =>
      value === '2026-09-06T10:00:00Z' ? '2026-09-01T10:00:00Z' : value,
    ),
  ])(
    'rejects incomplete, ambiguous, or invalid arguments: %j',
    (...args: string[]) => {
      expect(() => parseTelemetryRepairArgs(args)).toThrow();
    },
  );
});
