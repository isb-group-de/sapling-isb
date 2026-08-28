import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@mikro-orm/core', () => ({
  DeferMode: {
    INITIALLY_DEFERRED: 'deferred',
    INITIALLY_IMMEDIATE: 'immediate',
  },
  EntityManager: class EntityManager {},
  Type: class Type {},
}));

jest.mock('../../entity/global/entity.registry', () => ({
  ENTITY_MAP: { ticket: class TicketEntity {} },
}));
jest.mock('../../entity/EmailTemplateItem', () => ({
  EmailTemplateItem: class EmailTemplateItem {},
}));
jest.mock('../../entity/PersonItem', () => ({
  PersonItem: class PersonItem {},
}));
jest.mock('../../entity/EmailDeliveryItem', () => ({
  EmailDeliveryItem: class EmailDeliveryItem {},
}));
jest.mock('../../entity/EmailDeliveryStatusItem', () => ({
  EmailDeliveryStatusItem: class EmailDeliveryStatusItem {},
}));
jest.mock('../../entity/EntityItem', () => ({
  EntityItem: class EntityItem {},
}));
jest.mock('../../entity/DocumentItem', () => ({
  DocumentItem: class DocumentItem {},
}));
jest.mock('../../entity/PersonSessionItem', () => ({
  PersonSessionItem: class PersonSessionItem {},
}));

import { NotFoundException } from '@nestjs/common';
import { MailService } from './mail.service';

function getValue(
  context: Record<string, unknown>,
  expression: string,
): unknown {
  return expression
    .split('.')
    .reduce<unknown>(
      (current, key) =>
        typeof current === 'object' && current !== null
          ? (current as Record<string, unknown>)[key]
          : undefined,
      context,
    );
}

function createMessageTemplateServiceMock(
  context: Record<string, unknown> = {},
) {
  return {
    buildContext: jest
      .fn<(...args: unknown[]) => Promise<Record<string, unknown>>>()
      .mockResolvedValue(context),
    replaceRecipients: jest
      .fn<(input: string[] | string | undefined) => string[]>()
      .mockImplementation((input) => {
        if (!input) {
          return [];
        }
        return Array.isArray(input) ? input : input.split(/[;,]/);
      }),
    replacePlaceholders: jest
      .fn<
        (template: string, templateContext: Record<string, unknown>) => string
      >()
      .mockImplementation((template, templateContext) =>
        template.replace(
          /\{\{\s*([^}]+?)\s*\}\}/g,
          (_match, expression: string) => {
            const value = getValue(templateContext, expression.trim());
            return ['string', 'number', 'boolean'].includes(typeof value)
              ? String(value)
              : '';
          },
        ),
      ),
    stripMarkdown: jest.fn((markdown: string) => markdown),
  };
}

describe('MailService facade', () => {
  it('persists automation provenance and deduplication data on the delivery', async () => {
    let persistedDelivery: Record<string, unknown> | undefined;
    const flush = jest.fn<() => Promise<void>>().mockResolvedValue();
    const em = {
      findOne: jest.fn(
        (_entityClass: unknown, query: { handle: string | number }) => {
          if (query.handle === 'ticket') {
            return { handle: 'ticket' };
          }
          if (query.handle === 'pending') {
            return { handle: 'pending' };
          }
          return null;
        },
      ),
      persist: jest.fn((delivery: Record<string, unknown>) => {
        persistedDelivery = delivery;
        return { flush };
      }),
      findOneOrFail: jest.fn(() => persistedDelivery),
    };
    const rendering = {
      previewEmail: jest
        .fn<(...args: unknown[]) => Promise<Record<string, unknown>>>()
        .mockResolvedValue({
          to: ['customer@example.test'],
          cc: [],
          bcc: [],
          subject: 'Status update',
          bodyMarkdown: 'Ready',
          bodyHtml: '<p>Ready</p>',
          attachmentHandles: [],
        }),
    };
    const providerSession = {
      resolveRequestedSender: jest
        .fn<(...args: unknown[]) => Promise<Record<string, unknown>>>()
        .mockResolvedValue({
          email: 'agent@example.test',
          provider: 'azure',
          source: 'personal',
        }),
    };
    const customerAssociation = {
      resolve: jest
        .fn<(...args: unknown[]) => Promise<Record<string, unknown>>>()
        .mockResolvedValue({ company: null, person: null }),
    };
    const service = new MailService(
      em as never,
      {} as never,
      createMessageTemplateServiceMock() as never,
      { add: jest.fn() } as never,
      rendering as never,
      undefined,
      providerSession as never,
      undefined,
      customerAssociation as never,
    );
    const subscription = { handle: 12 };

    await service.sendEmail(
      {
        entityHandle: 'ticket',
        itemHandle: 101,
        to: ['customer@example.test'],
      },
      { handle: 42, type: { handle: 'azure' } } as never,
      {
        subscription: subscription as never,
        deduplicationKey: '12:ticket:101',
      },
    );

    expect(persistedDelivery).toMatchObject({
      subscription,
      automationDeduplicationKey: '12:ticket:101',
      referenceHandle: '101',
    });
    expect(flush).toHaveBeenCalled();
  });

  it('renders rich markdown in previewEmail', async () => {
    const em = {
      findOne: jest.fn(
        (_entityClass: unknown, query: { handle: string | number }) =>
          query.handle === 'ticket' ? { handle: 'ticket' } : null,
      ),
    };
    const service = new MailService(
      em as never,
      {} as never,
      createMessageTemplateServiceMock({
        handle: 42,
        title: 'Launch Plan',
        owner: { name: 'Ada' },
      }) as never,
      { add: jest.fn() } as never,
    );

    const preview = await service.previewEmail(
      {
        entityHandle: 'ticket',
        itemHandle: 42,
        to: ['team@example.com'],
        subject: 'Update {{ title }}',
        bodyMarkdown: [
          '# {{ title }}',
          '',
          '- [x] Ready',
          '- [ ] Pending',
          '',
          '| Name | Owner |',
          '| --- | --- |',
          '| Demo | {{ owner.name }} |',
          '',
          '```ts',
          'const ready = true;',
          '```',
          '',
          '[Open](https://example.com)',
        ].join('\n'),
      },
      { handle: 1 } as never,
    );

    expect(preview.subject).toBe('Update Launch Plan');
    expect(preview.bodyHtml).toContain('<h1>Launch Plan</h1>');
    expect(preview.bodyHtml).toContain('type="checkbox"');
    expect(preview.bodyHtml).toContain('<table>');
    expect(preview.bodyHtml).toContain(
      '<code class="language-ts">const ready = true;',
    );
    expect(preview.bodyHtml).toContain('target="_blank"');
    expect(preview.bodyHtml).toContain('noopener noreferrer');
  });

  it('throws when the preview entity does not exist', async () => {
    const service = new MailService(
      {
        findOne: jest.fn<() => Promise<null>>().mockResolvedValue(null),
      } as never,
      {} as never,
      createMessageTemplateServiceMock() as never,
      { add: jest.fn() } as never,
    );

    await expect(
      service.previewEmail(
        { entityHandle: 'missing', to: ['team@example.com'] },
        { handle: 1 } as never,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('persists provider diagnostics when dispatch fails', async () => {
    const providerError = {
      statusCode: 403,
      body: { error: { code: 'ErrorSendAsDenied' } },
      headers: { 'request-id': 'req-123' },
      message: 'Send as denied',
    };
    const delivery = {
      handle: 15,
      provider: 'azure',
      attachmentHandles: [],
      requestPayload: {
        from: 'support@example.com',
        senderSource: 'configured',
      },
      createdBy: {
        session: { accessToken: 'token', refreshToken: 'refresh' },
      },
    };
    const flush = jest.fn<() => Promise<void>>().mockResolvedValue();
    const fork = {
      findOne: jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValueOnce(delivery)
        .mockResolvedValueOnce({ handle: 'failed' }),
      flush,
    };
    const transport = {
      loadAttachments: jest
        .fn<() => Promise<unknown[]>>()
        .mockResolvedValue([]),
      send: jest.fn<() => Promise<never>>().mockRejectedValue(providerError),
      getRequestedSenderEmail: jest.fn(() => 'support@example.com'),
      getRequestedSenderSource: jest.fn(() => 'configured'),
    };
    const service = new MailService(
      { fork: jest.fn(() => fork) } as never,
      {} as never,
      createMessageTemplateServiceMock() as never,
      { add: jest.fn() } as never,
      undefined,
      undefined,
      undefined,
      transport as never,
    );

    await expect(service.dispatchDelivery(15)).rejects.toEqual(providerError);
    expect(delivery).toMatchObject({
      responseStatusCode: 403,
      responseBody: {
        message: 'Send as denied',
        senderEmail: 'support@example.com',
        senderSource: 'configured',
        providerError: { error: { code: 'ErrorSendAsDenied' } },
      },
      responseHeaders: { 'request-id': 'req-123' },
      status: { handle: 'failed' },
    });
    expect((delivery as { completedAt?: Date }).completedAt).toBeInstanceOf(
      Date,
    );
    expect(flush).toHaveBeenCalled();
  });
});
