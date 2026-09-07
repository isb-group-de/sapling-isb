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
