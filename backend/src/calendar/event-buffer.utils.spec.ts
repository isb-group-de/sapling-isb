import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import {
  normalizeEventBufferDuration,
  normalizeEventBufferMutationPayload,
} from './event-buffer.utils';

describe('event buffer duration utilities', () => {
  it('normalizes quarter-hour values to database time strings', () => {
    expect(normalizeEventBufferDuration('00:00')).toBe('00:00:00');
    expect(normalizeEventBufferDuration('01:15')).toBe('01:15:00');
    expect(normalizeEventBufferDuration('23:45:00')).toBe('23:45:00');
  });

  it('rejects values outside the 15-minute grid', () => {
    expect(() => normalizeEventBufferDuration('00:10')).toThrow(
      BadRequestException,
    );
    expect(() => normalizeEventBufferDuration('24:00')).toThrow(
      BadRequestException,
    );
    expect(() => normalizeEventBufferDuration('01:15:30')).toThrow(
      BadRequestException,
    );
  });

  it('normalizes only event duration fields in mutation payloads', () => {
    expect(
      normalizeEventBufferMutationPayload('event', {
        title: 'Planning',
        preparationDuration: '00:30',
        followUpDuration: '01:00:00',
      }),
    ).toEqual({
      title: 'Planning',
      preparationDuration: '00:30:00',
      followUpDuration: '01:00:00',
    });
  });
});
