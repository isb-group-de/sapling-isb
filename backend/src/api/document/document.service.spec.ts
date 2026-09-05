import type { EntityManager } from '@mikro-orm/core';
import * as fs from 'fs';
import { DocumentItem } from '../../entity/DocumentItem';
import { DocumentTypeItem } from '../../entity/DocumentTypeItem';
import { EntityItem } from '../../entity/EntityItem';
import { PersonItem } from '../../entity/PersonItem';
import * as mailAttachmentUtil from './document-mail-attachment.util';
import { DocumentService } from './document.service';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-guid'),
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('DocumentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(fs.existsSync).mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['mail.EML', '', 'document', 'email'],
    ['mail.MSG', 'application/octet-stream', 'document', 'email'],
    ['report.pdf', '', 'document', 'document'],
    ['image.png', 'image/png', 'document', 'document'],
    ['archive.zip', 'application/octet-stream', 'document', 'document'],
    ['recording.webm', 'audio/webm', 'document', 'document'],
    ['recording.webm', 'audio/webm', 'aiChatAudio', 'aiChatAudio'],
    ['mail.eml', 'message/rfc822', 'email', 'email'],
  ])(
    'classifies %s uploaded as %s with type %s before recording its event',
    async (filename, mimetype, requestedType, expectedType) => {
      const entity = { handle: 'ticket' } as EntityItem;
      const em = {
        findOne: jest.fn(
          async (
            model: typeof EntityItem | typeof DocumentTypeItem,
            where: { handle: string },
          ) => (model === EntityItem ? entity : { handle: where.handle }),
        ),
        persist: jest.fn((documents: DocumentItem[]) => {
          documents[0].handle = 1;
        }),
        flush: jest.fn(async () => undefined),
      } as unknown as EntityManager;
      const automationEvents = {
        record: jest.fn(async (options: Record<string, unknown>) => {
          void options;
          return null;
        }),
      };
      jest
        .spyOn(mailAttachmentUtil, 'extractEmlAttachments')
        .mockResolvedValue([]);
      jest
        .spyOn(mailAttachmentUtil, 'extractMsgAttachments')
        .mockReturnValue([]);

      const result = await new DocumentService(
        em,
        automationEvents as never,
      ).uploadDocument(
        {
          buffer: Buffer.from('content'),
          originalname: filename,
          mimetype,
        } as Express.Multer.File,
        'ticket',
        '123',
        requestedType,
        { handle: 42 } as PersonItem,
      );

      expect(result.type.handle).toBe(expectedType);
      expect(em.persist).toHaveBeenCalledWith([
        expect.objectContaining({ type: { handle: expectedType } }),
      ]);
      expect(automationEvents.record.mock.calls[0]?.[0]).toMatchObject({
        entityHandle: 'document',
        operation: 'afterInsert',
        newSnapshot: {
          type: { handle: expectedType },
          entity: { handle: 'ticket' },
          reference: '123',
        },
      });
    },
  );

  it('returns only images linked to the exact requested record without storage paths', async () => {
    const documents = [
      {
        handle: 7,
        filename: 'step-one.png',
        mimetype: 'image/png',
        description: 'Step one',
        path: 'private-storage-name',
        createdAt: new Date('2026-09-01T08:00:00.000Z'),
      },
      {
        handle: 8,
        filename: 'manual.pdf',
        mimetype: 'application/pdf',
        description: 'Manual',
      },
      {
        handle: 9,
        filename: 'step-two.jpg',
        mimetype: 'image/jpeg',
      },
    ] as DocumentItem[];
    const em = {
      find: jest.fn(async () => documents),
    } as unknown as EntityManager;

    const result = await new DocumentService(em).findReferencedImages(
      'ticket',
      '218',
    );

    expect(em.find).toHaveBeenCalledWith(
      DocumentItem,
      {
        entity: { handle: 'ticket' },
        reference: '218',
      },
      { orderBy: { createdAt: 'DESC' } },
    );
    expect(result).toEqual([
      {
        handle: 7,
        filename: 'step-one.png',
        mimetype: 'image/png',
        description: 'Step one',
        createdAt: new Date('2026-09-01T08:00:00.000Z'),
      },
      {
        handle: 9,
        filename: 'step-two.jpg',
        mimetype: 'image/jpeg',
        description: null,
        createdAt: null,
      },
    ]);
    expect(result[0]).not.toHaveProperty('path');
  });

  it('stores non-inline EML attachments beside the original document', async () => {
    const entity = { handle: 'ticket' } as EntityItem;
    const emailType = { handle: 'email' } as DocumentTypeItem;
    const documentType = { handle: 'document' } as DocumentTypeItem;
    const persisted: DocumentItem[][] = [];
    const em = {
      findOne: jest.fn(
        async (
          model: typeof EntityItem | typeof DocumentTypeItem,
          where: { handle: string },
        ) => {
          if (model === EntityItem) return entity;
          if (where.handle === 'email') return emailType;
          if (where.handle === 'document') return documentType;
          return null;
        },
      ),
      persist: jest.fn((documents: DocumentItem[]) => {
        documents.forEach((document, index) => {
          document.handle = index + 1;
        });
        persisted.push(documents);
      }),
      flush: jest.fn(async () => undefined),
    } as unknown as EntityManager;
    const automationEvents = {
      record: jest.fn(async (options: Record<string, unknown>) => {
        void options;
        return null;
      }),
    };
    const rawMessage = Buffer.from(
      [
        'From: sender@example.com',
        'To: receiver@example.com',
        'MIME-Version: 1.0',
        'Content-Type: multipart/mixed; boundary="outer"',
        '',
        '--outer',
        'Content-Type: text/plain',
        '',
        'Hello',
        '--outer',
        'Content-Type: application/pdf; name="report.pdf"',
        'Content-Disposition: attachment; filename="report.pdf"',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from('pdf-content').toString('base64'),
        '--outer--',
        '',
      ].join('\r\n'),
    );

    const result = await new DocumentService(
      em,
      automationEvents as never,
    ).uploadDocument(
      {
        buffer: rawMessage,
        originalname: 'message.eml',
        mimetype: 'application/octet-stream',
        size: rawMessage.length,
      } as Express.Multer.File,
      'ticket',
      '123',
      'document',
      { handle: 42 } as PersonItem,
      'E-Mail',
    );

    expect(result).toMatchObject({
      filename: 'message.eml',
      mimetype: 'message/rfc822',
      reference: '123',
      type: emailType,
    });
    expect(persisted[0]).toHaveLength(2);
    expect(persisted[0][1]).toMatchObject({
      filename: 'report.pdf',
      mimetype: 'application/pdf',
      description: 'report.pdf',
      reference: '123',
      entity,
      type: documentType,
      person: { handle: 42 },
    });
    expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    expect(em.flush).toHaveBeenCalledTimes(1);
    expect(automationEvents.record.mock.calls[0]?.[0]).toMatchObject({
      entityHandle: 'document',
      sourceHandle: 1,
      operation: 'afterInsert',
      newSnapshot: {
        type: { handle: 'email' },
        entity: { handle: 'ticket' },
        reference: '123',
      },
    });
    expect(automationEvents.record.mock.calls[1]?.[0]).toMatchObject({
      sourceHandle: 2,
      newSnapshot: {
        type: { handle: 'document' },
      },
    });
  });

  it('stores extracted MSG attachments using the same document link', async () => {
    const entity = { handle: 'ticket' } as EntityItem;
    const emailType = { handle: 'email' } as DocumentTypeItem;
    const documentType = { handle: 'document' } as DocumentTypeItem;
    const persisted: DocumentItem[][] = [];
    const em = {
      findOne: jest.fn(
        async (
          model: typeof EntityItem | typeof DocumentTypeItem,
          where: { handle: string },
        ) => {
          if (model === EntityItem) return entity;
          if (where.handle === 'email') return emailType;
          if (where.handle === 'document') return documentType;
          return null;
        },
      ),
      persist: jest.fn((documents: DocumentItem[]) =>
        persisted.push(documents),
      ),
      flush: jest.fn(async () => undefined),
    } as unknown as EntityManager;
    jest.spyOn(mailAttachmentUtil, 'extractMsgAttachments').mockReturnValue([
      {
        filename: 'agenda.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('pdf-content'),
      },
    ]);

    const result = await new DocumentService(em).uploadDocument(
      {
        buffer: Buffer.from('msg-content'),
        originalname: 'message.msg',
        mimetype: 'application/octet-stream',
        size: 11,
      } as Express.Multer.File,
      'ticket',
      '123',
      'document',
      { handle: 42 } as PersonItem,
      'E-Mail',
    );

    expect(result.mimetype).toBe('application/vnd.ms-outlook');
    expect(result.type).toBe(emailType);
    expect(mailAttachmentUtil.extractMsgAttachments).toHaveBeenCalledWith(
      Buffer.from('msg-content'),
    );
    expect(persisted[0]).toHaveLength(2);
    expect(persisted[0][1]).toMatchObject({
      filename: 'agenda.pdf',
      reference: '123',
      entity,
      type: documentType,
      person: { handle: 42 },
    });
  });
});
