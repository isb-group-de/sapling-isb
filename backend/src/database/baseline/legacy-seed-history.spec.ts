import manifest from './manifest.json';
import { validateLegacySeedHistory } from './legacy-seed-history';
import type { SeedDataset } from '../seeder/seed-catalog';

const historyFor = (dataset: SeedDataset) =>
  manifest.legacySeeds[dataset].map((row) => ({
    entityHandle: row.entity,
    scriptName: row.script,
    isSuccess: true,
  }));

describe('Legacy seed history adoption', () => {
  it.each<SeedDataset>(['production', 'demonstration'])(
    'accepts the original %s history',
    (dataset) => {
      expect(validateLegacySeedHistory(historyFor(dataset), dataset)).toEqual(
        [],
      );
    },
  );

  it('accepts the reported combined history while retaining demo requirements', () => {
    const history = [
      ...historyFor('production'),
      ...historyFor('demonstration'),
    ];
    expect(validateLegacySeedHistory(history, 'demonstration')).toEqual([
      'aiProviderModel:aiProviderModelData_005.json',
      'translation:translationData_085.json',
      'translation:translationData_086.json',
    ]);
    expect(validateLegacySeedHistory(history, 'production')).toEqual([
      'aiAgent:aiAgentData_003.json',
    ]);
  });

  it('rejects a missing required seed even with all other-dataset seeds present', () => {
    expect(() =>
      validateLegacySeedHistory(historyFor('production'), 'demonstration'),
    ).toThrow('Missing successful seeds (1): aiAgent:aiAgentData_003.json');
  });

  it.each([true, false])(
    'accepts unknown extra history with success=%s',
    (isSuccess) => {
      const history = [
        ...historyFor('demonstration'),
        {
          entityHandle: 'translation',
          scriptName: 'translationData_999.json',
          isSuccess,
        },
      ];
      expect(validateLegacySeedHistory(history, 'demonstration')).toEqual([
        'translation:translationData_999.json',
      ]);
    },
  );

  it('accepts unsuccessful additional known seeds', () => {
    const history = [
      ...historyFor('production'),
      {
        entityHandle: 'aiAgent',
        scriptName: 'aiAgentData_003.json',
        isSuccess: false,
      },
    ];
    expect(validateLegacySeedHistory(history, 'production')).toEqual([
      'aiAgent:aiAgentData_003.json',
    ]);
  });

  it('reports a required seed with no successful attempt and the dataset', () => {
    const history = historyFor('demonstration');
    history[0].isSuccess = false;
    expect(() => validateLegacySeedHistory(history, 'demonstration')).toThrow(
      `Missing successful seeds (1): ${history[0].entityHandle}:${history[0].scriptName}`,
    );
    expect(() => validateLegacySeedHistory(history, 'demonstration')).toThrow(
      'DB_DATA_SEEDER=demonstration',
    );
  });

  it('accepts a successful retry after an earlier failure', () => {
    const history = historyFor('demonstration');
    history.push({ ...history[0], isSuccess: false });
    expect(validateLegacySeedHistory(history, 'demonstration')).toEqual([]);
  });
});
