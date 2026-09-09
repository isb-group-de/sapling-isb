import { describe, expect, it, jest } from '@jest/globals';
jest.mock('../import/import.service', () => ({ ImportService: class {} }));
jest.mock('../document/document.service', () => ({
  DocumentService: class {},
}));
jest.mock('./ai-provider-registry.service', () => ({
  AiProviderRegistryService: class {},
}));
import { AiChatMediaService } from './ai-chat-media.service';

describe('chat image uploads', () => {
  const buffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1cAAAAASUVORK5CYII=',
    'base64',
  );
  const file = {
    buffer,
    mimetype: 'text/plain',
    originalname: 'screen.png',
  } as Express.Multer.File;
  function setup(supportsVision = true) {
    const document = { handle: 3, reference: '' };
    const em = {
      create: jest.fn((_entity: unknown, value: object) => ({
        ...value,
        handle: 4,
      })),
      persist: jest.fn(),
      flush: jest.fn(async () => {}),
    };
    const uploadDocument = jest.fn(async (...args: unknown[]) => {
      void args;
      return document;
    });
    const analyzeCsv = jest.fn();
    const findOwnedSession = jest.fn(async (...args: unknown[]) => {
      void args;
      return { handle: 7 };
    });
    const service = new AiChatMediaService(
      em as never,
      { uploadDocument } as never,
      {
        resolveRuntimeTarget: jest.fn(async () => ({
          model: { supportsVision },
        })),
      } as never,
      { analyzeCsv } as never,
      {
        requireManagedUser: jest.fn(async () => ({ handle: 42 })),
        findOwnedSession,
      } as never,
    );
    return {
      service,
      document,
      em,
      uploadDocument,
      analyzeCsv,
      findOwnedSession,
    };
  }
  it('persists a normal user image without invoking the administrator import pipeline', async () => {
    const fixture = setup();
    const user = { handle: 42 } as never;
    const result = await fixture.service.createChatImageAttachment(file, user, {
      sessionHandle: 7,
      modelHandle: 'vision',
    });
    expect(fixture.findOwnedSession).toHaveBeenCalledWith(7, user);
    expect(fixture.uploadDocument).toHaveBeenCalledWith(
      expect.objectContaining({ mimetype: 'image/png' }),
      'aiChatAttachment',
      '',
      'document',
      { handle: 42 },
    );
    expect(result.attachment).toMatchObject({
      handle: 4,
      purpose: 'vision',
      mimeType: 'image/png',
      byteLength: buffer.length,
      importBatch: null,
      session: 7,
    });
    expect(fixture.document.reference).toBe('4');
    expect(fixture.analyzeCsv).not.toHaveBeenCalled();
  });
  it('rejects text-only models without creating documents or attachments', async () => {
    const fixture = setup(false);
    await expect(
      fixture.service.createChatImageAttachment(file, {} as never),
    ).rejects.toThrow('ai.chatVisionRequired');
    expect(fixture.uploadDocument).not.toHaveBeenCalled();
    expect(fixture.em.persist).not.toHaveBeenCalled();
  });
});
