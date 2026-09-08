import { describe, expect, it, jest } from '@jest/globals';
jest.mock('../../entity/PersonItem', () => ({
  PersonItem: class PersonItem {},
}));
jest.mock('../../entity/EmailSignatureItem', () => ({
  EmailSignatureItem: class EmailSignatureItem {},
}));
jest.mock('../../entity/EntityItem', () => ({
  EntityItem: class EntityItem {},
}));
jest.mock('../../entity/EmailTemplateItem', () => ({
  EmailTemplateItem: class EmailTemplateItem {},
}));
jest.mock('../template/message-template.service', () => ({
  MessageTemplateService: class MessageTemplateService {},
}));
import { MailRenderingService } from './mail-rendering.service';
import { EmailSignatureItem } from '../../entity/EmailSignatureItem';

describe('MailRenderingService signatures', () => {
  it('preserves editor image embeds through placeholder rendering and preview', async () => {
    const em = {
      findOne: async () => ({ handle: 'ticket' }),
      find: async () => [
        {
          handle: 42,
          entity: { handle: 'ticket' },
          reference: '7',
          filename: 'image.png',
          mimetype: 'image/png',
          path: 'image',
        },
      ],
    };
    const renderer = new MailRenderingService({
      buildContext: async () => ({}),
      replaceRecipients: (value: string[]) => value ?? [],
      replacePlaceholders: (value: string) => value.replace(/\{\{.*?\}\}/g, ''),
    } as never);
    const result = await renderer.previewEmail(
      em as never,
      {
        entityHandle: 'ticket',
        itemHandle: 7,
        signatureMode: 'none',
        bodyMarkdown: 'Before {{sapling-image:42|Screenshot}} after',
      },
      {} as never,
    );
    expect(result.bodyHtml).toContain(
      'Before <img src="sapling-document:42" alt="Screenshot" /> after',
    );
    expect(result.unresolvedPlaceholders).toEqual([]);
  });
  it('reports empty placeholders in subject, body, signature and recipients before they disappear', async () => {
    const em = {
      findOne: jest.fn(async (entity: unknown) =>
        entity === EmailSignatureItem
          ? { handle: 12, bodyMarkdown: '{{signatureName}}' }
          : { handle: 'ticket' },
      ),
      findOneOrFail: jest.fn(async () => ({
        handle: 7,
        emailSignatureRotation: true,
      })),
    };
    const renderer = new MailRenderingService({
      buildContext: async () => ({}),
      replaceRecipients: (value: string[]) => value ?? [],
      replacePlaceholders: (value: string) =>
        value.replace(/\{\{.*?\}\}/g, (token) =>
          token === '{{count}}' ? '0' : '',
        ),
    } as never);
    const result = await renderer.previewEmail(
      em as never,
      {
        entityHandle: 'ticket',
        signatureMode: 'rotation',
        signatureHandle: 12,
        subject: '{{name}}',
        bodyMarkdown: '{{name}} {{date | date}} {{count}}',
        to: ['{{email}}'],
      },
      { handle: 7 } as never,
    );
    expect(result.unresolvedPlaceholders).toEqual([
      '{{name}}',
      '{{date | date}}',
      '{{signatureName}}',
      '{{email}}',
    ]);
    expect(result.bodyMarkdown).not.toContain('{{');
  });
  it('appends and renders the signature once without mutating the editable body', async () => {
    const signature = {
      handle: 12,
      bodyMarkdown: 'Grüße aus Bonn\n\n**{{currentUser.firstName}}**',
    };
    const em = {
      findOne: jest.fn(async (entity: unknown) =>
        entity === EmailSignatureItem ? signature : { handle: 'ticket' },
      ),
      findOneOrFail: jest.fn(async () => ({
        handle: 7,
        emailSignatureRotation: true,
      })),
    };
    const renderer = new MailRenderingService({
      buildContext: async () => ({}),
      replaceRecipients: (value: string[]) => value ?? [],
      replacePlaceholders: (value: string) =>
        value.replace('{{currentUser.firstName}}', 'Ada'),
    } as never);
    const dto = {
      entityHandle: 'ticket',
      signatureMode: 'rotation' as const,
      signatureHandle: 12,
      bodyMarkdown: 'Hallo!',
      to: ['recipient@example.test'],
    };
    const first = await renderer.previewEmail(em as never, dto, {
      handle: 7,
    } as never);
    const second = await renderer.previewEmail(em as never, dto, {
      handle: 7,
    } as never);
    expect(first.bodyMarkdown).toBe('Hallo!\n\nGrüße aus Bonn\n\n**Ada**');
    expect(first.bodyHtml).toContain('<strong>Ada</strong>');
    expect(second.bodyMarkdown).toBe(first.bodyMarkdown);
    expect(first.signatureHandle).toBe(12);
    expect(dto.bodyMarkdown).toBe('Hallo!');
  });
});
