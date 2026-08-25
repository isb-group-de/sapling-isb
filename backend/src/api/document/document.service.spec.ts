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
      persist: jest.fn((documents: DocumentItem[]) =>
        persisted.push(documents),
      ),
      flush: jest.fn(async () => undefined),
    } as unknown as EntityManager;
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

    const result = await new DocumentService(em).uploadDocument(
      {
        buffer: rawMessage,
        originalname: 'message.eml',
        mimetype: 'application/octet-stream',
        size: rawMessage.length,
      } as Express.Multer.File,
      'ticket',
      '123',
      'email',
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
      'email',
      { handle: 42 } as PersonItem,
      'E-Mail',
    );

    expect(result.mimetype).toBe('application/vnd.ms-outlook');
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
