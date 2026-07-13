import { describe, expect, it } from '@jest/globals';
import {
  areChangeLogValuesEqual,
  buildChangeLogDetails,
} from './generic-change-log.util';

describe('generic-change-log.util', () => {
  it('treats null, undefined, and empty strings as equal for change-log details', () => {
    expect(areChangeLogValuesEqual(null, '')).toBe(true);
    expect(areChangeLogValuesEqual(undefined, '')).toBe(true);
    expect(areChangeLogValuesEqual('   ', null)).toBe(true);
    expect(areChangeLogValuesEqual({ mobile: null }, { mobile: '' })).toBe(
      true,
    );
  });

  it('does not create details for empty-value transitions', () => {
    expect(
      buildChangeLogDetails(
        'update',
        {
          handle: 1,
          mobile: null,
          name: 'Bauer IT Solutions',
          phone: '',
        },
        {
          handle: 1,
          mobile: '',
          name: 'Bauer IT Solutions 1',
          phone: undefined,
        },
      ),
    ).toEqual([
      {
        property: 'name',
        oldValue: 'Bauer IT Solutions',
        newValue: 'Bauer IT Solutions 1',
      },
    ]);
  });
});
