import { describe, expect, it, jest } from '@jest/globals';
import { HttpStatus } from '@nestjs/common';
import { TemplateController } from './template.controller';

describe('TemplateController', () => {
  it('returns an ETag and answers matching conditional requests with 304', async () => {
    const templates = [{ name: 'title' }];
    const controller = new TemplateController(
      { getEntityTemplate: jest.fn(() => templates) } as never,
      {
        appendCustomFieldTemplates: jest.fn(() => Promise.resolve(templates)),
      } as never,
    );
    const headers = new Map<string, string>();
    const response = {
      setHeader: jest.fn((name: string, value: string) =>
        headers.set(name, value),
      ),
      status: jest.fn(),
    };

    await expect(
      controller.getEntityTemplate(
        'ticket',
        { headers: {} } as never,
        response as never,
      ),
    ).resolves.toEqual(templates);

    const etag = headers.get('ETag');
    expect(etag).toBeTruthy();
    expect(headers.get('Cache-Control')).toBe('private, no-cache');

    await expect(
      controller.getEntityTemplate(
        'ticket',
        { headers: { 'if-none-match': etag } } as never,
        response as never,
      ),
    ).resolves.toBeUndefined();
    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_MODIFIED);
  });
});
