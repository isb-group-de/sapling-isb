import type { EntityManager } from '@mikro-orm/core';
import * as fs from 'fs';
import { BadRequestException } from '@nestjs/common';
import { DocumentService } from './document.service';
import { DocumentItem } from '../../entity/DocumentItem';
import { PersonItem } from '../../entity/PersonItem';

jest.mock('uuid', () => ({ v4: () => 'profile-guid' }));
jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  promises: { unlink: jest.fn().mockResolvedValue(undefined) },
}));

describe('Profile pictures through the shared document upload', () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6pY0AAAAASUVORK5CYII=',
    'base64',
  );
  const person = { handle: 42 } as PersonItem;
  const file = {
    originalname: 'renamed.pdf',
    mimetype: 'application/pdf',
    buffer: png,
  } as Express.Multer.File;
  function setup() {
    const em = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(person)
        .mockResolvedValueOnce({ handle: 'person' })
        .mockResolvedValueOnce({ handle: 'profilePicture' }),
      persist: jest.fn((documents: DocumentItem[]) => {
        documents[0].handle = 7;
      }),
      flush: jest.fn().mockResolvedValue(undefined),
    };
    return { em, service: new DocumentService(em as unknown as EntityManager) };
  }
  beforeEach(() => jest.clearAllMocks());

  it('stores actual image MIME and the ordinary person reference regardless of extension', async () => {
    const { service, em } = setup();
    const result = await service.uploadDocument(
      file,
      'person',
      '42',
      'profilePicture',
      person,
    );
    expect(result).toMatchObject({
      mimetype: 'image/png',
      filename: 'renamed.pdf',
      reference: '42',
      type: { handle: 'profilePicture' },
      person: { handle: 42 },
    });
    expect(em.persist).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('profile-guid'),
      png,
    );
  });

  it('rejects invalid bytes before any persistence or file writes', async () => {
    const { service, em } = setup();
    await expect(
      service.uploadDocument(
        { ...file, buffer: Buffer.from('<svg/>') },
        'person',
        '42',
        'profilePicture',
        person,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(em.findOne).not.toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('does not allow profile pictures on other entity types', async () => {
    const { service } = setup();
    await expect(
      service.uploadDocument(file, 'ticket', '42', 'profilePicture', person),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('removes the new binary if the database rejects the upload', async () => {
    const { service, em } = setup();
    em.flush.mockRejectedValue(new Error('database unavailable'));
    await expect(
      service.uploadDocument(file, 'person', '42', 'profilePicture', person),
    ).rejects.toThrow('database unavailable');
    expect(fs.promises.unlink).toHaveBeenCalledWith(
      expect.stringContaining('profile-guid'),
    );
  });
});
