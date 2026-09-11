import { describe, expect, it } from '@jest/globals';
import type { EventItem } from '../entity/EventItem';
import {
  normalizeOutlookAvailabilityMappings,
  resolveOutlookShowAs,
} from './outlook-availability.utils';

const event = {
  isOutlookAvailable: false,
  status: { handle: 'confirmed' },
  type: { handle: 'onsite' },
  category: { handle: 'customer' },
} as EventItem;

describe('Outlook availability mappings', () => {
  it('normalizes configured handles and removes incomplete mappings', () => {
    expect(
      normalizeOutlookAvailabilityMappings([
        {
          eventStatusHandle: ' confirmed ',
          eventTypeHandle: ' ',
          eventCategoryHandle: null,
          showAs: 'tentative',
        },
        {
          eventStatusHandle: null,
          eventTypeHandle: null,
          eventCategoryHandle: null,
          showAs: 'busy',
        },
        {
          eventTypeHandle: 'onsite',
          showAs: 'invalid' as never,
        },
      ]),
    ).toEqual([
      {
        eventStatusHandle: 'confirmed',
        eventTypeHandle: null,
        eventCategoryHandle: null,
        showAs: 'tentative',
      },
    ]);
  });

  it('uses busy when no mapping matches', () => {
    expect(resolveOutlookShowAs(event, [])).toBe('busy');
  });

  it('uses the most specific matching mapping and keeps row order as tie breaker', () => {
    expect(
      resolveOutlookShowAs(event, [
        { eventStatusHandle: 'confirmed', showAs: 'tentative' },
        { eventTypeHandle: 'onsite', showAs: 'workingElsewhere' },
        {
          eventStatusHandle: 'confirmed',
          eventTypeHandle: 'onsite',
          showAs: 'oof',
        },
      ]),
    ).toBe('oof');

    expect(
      resolveOutlookShowAs(event, [
        { eventStatusHandle: 'confirmed', showAs: 'tentative' },
        { eventTypeHandle: 'onsite', showAs: 'workingElsewhere' },
      ]),
    ).toBe('tentative');
  });

  it('lets the explicit available checkbox override every mapping', () => {
    expect(
      resolveOutlookShowAs(
        { ...event, isOutlookAvailable: true } as EventItem,
        [{ eventStatusHandle: 'confirmed', showAs: 'busy' }],
      ),
    ).toBe('free');
  });
});
