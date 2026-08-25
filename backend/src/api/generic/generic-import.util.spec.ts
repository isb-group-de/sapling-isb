import { describe, expect, it } from '@jest/globals';
import type { EntityTemplateDto } from '../template/dto/entity-template.dto';
import {
  extractImportHandle,
  normalizeImportRow,
  omitImportHandle,
} from './generic-import.util';

describe('generic-import.util', () => {
  it('extracts every non-empty string or numeric import handle', () => {
    expect(extractImportHandle({ handle: 12 })).toBe(12);
    expect(extractImportHandle({ handle: 0 })).toBe(0);
    expect(extractImportHandle({ handle: '12' })).toBe('12');
    expect(extractImportHandle({ handle: ' 12 ' })).toBe('12');
    expect(extractImportHandle({ handle: 'zeppelin-42' })).toBe('zeppelin-42');
    expect(extractImportHandle({ handle: 'neu' })).toBe('neu');
    expect(extractImportHandle({ handle: '' })).toBeNull();
    expect(extractImportHandle({ handle: '   ' })).toBeNull();
    expect(extractImportHandle({ handle: null })).toBeNull();
  });

  it('normalizes phone fields while importing rows', () => {
    const template = [
      {
        name: 'phone',
        type: 'string',
        options: ['isPhone'],
      },
    ] as EntityTemplateDto[];

    expect(normalizeImportRow(template, { phone: '0170 / 1234567' })).toEqual({
      phone: '+49 170 123 456 7',
    });
    expect(normalizeImportRow(template, { phone: '491701234567' })).toEqual({
      phone: '+49 170 123 456 7',
    });
    expect(normalizeImportRow(template, { phone: '+49 1234567891' })).toEqual({
      phone: '+49 123 456 789 1',
    });
  });

  it('keeps the import handle as routing identity instead of writable data', () => {
    const payload = { handle: 12, name: 'Acme' };

    expect(omitImportHandle(payload)).toEqual({ name: 'Acme' });
    expect(payload).toEqual({ handle: 12, name: 'Acme' });
  });
});
