import { NotFoundException } from '@nestjs/common';
import type { EntityManager } from '@mikro-orm/core';
import { ProfilePictureService } from './profile-picture.service';
import { DocumentService } from './document.service';
import { DocumentItem } from '../../entity/DocumentItem';
import { PersonItem } from '../../entity/PersonItem';
import * as storage from './document-storage.util';

jest.mock('uuid', () => ({ v4: jest.fn() }));
jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));

describe('ProfilePictureService', () => {
  const person = { handle: 42 } as PersonItem;
  const document = {
    handle: 7,
    filename: 'photo.png',
    mimetype: 'image/png',
    path: 'opaque-file',
    entity: { handle: 'person' },
    reference: '42',
    type: { handle: 'profilePicture' },
  } as DocumentItem;

  function setup() {
    const em = {
      find: jest.fn().mockResolvedValue([document]),
      findOne: jest.fn().mockResolvedValue(document),
      remove: jest.fn(),
      flush: jest.fn().mockResolvedValue(undefined),
      transactional: jest.fn(),
    };
    em.transactional.mockImplementation(
      (operation: (tx: typeof em) => Promise<void>) => operation(em),
    );
    const documents = {
      uploadDocument: jest.fn().mockResolvedValue(document),
      downloadDocument: jest
        .fn()
        .mockResolvedValue({ document, filePath: 'safe-path' }),
    };
    const events = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new ProfilePictureService(
      em as unknown as EntityManager,
      documents as unknown as DocumentService,
      events as never,
    );
    return { em, documents, events, service };
  }

  afterEach(() => jest.restoreAllMocks());

  it('lists only the authenticated person’s profile type with stable ordering and safe metadata', async () => {
    const { service, em } = setup();
    const result = await service.list(person);
    expect(em.find).toHaveBeenCalledWith(
      DocumentItem,
      {
        entity: { handle: 'person' },
        reference: '42',
        type: { handle: 'profilePicture' },
        mimetype: {
          $in: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        },
      },
      { orderBy: { createdAt: 'DESC', handle: 'DESC' } },
    );
    expect(result).toEqual([
      {
        handle: 7,
        filename: 'photo.png',
        mimetype: 'image/png',
        description: null,
        createdAt: null,
      },
    ]);
  });

  it('uses the existing document upload with the current person and fixed type', async () => {
    const { service, documents } = setup();
    const file = { originalname: 'photo.png' } as Express.Multer.File;
    const result = await service.upload(person, file);
    expect(documents.uploadDocument).toHaveBeenCalledWith(
      file,
      'person',
      '42',
      'profilePicture',
      person,
    );
    expect(result).not.toHaveProperty('path');
  });

  it.each(['download', 'remove'] as const)(
    'scopes %s by person, reference and type before touching storage',
    async (operation) => {
      const { service, em, documents } = setup();
      em.findOne.mockResolvedValue(null);
      await expect(service[operation](person, 8)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(em.findOne).toHaveBeenCalledWith(DocumentItem, {
        handle: 8,
        entity: { handle: 'person' },
        reference: '42',
        type: { handle: 'profilePicture' },
      });
      expect(documents.downloadDocument).not.toHaveBeenCalled();
      expect(em.remove).not.toHaveBeenCalled();
    },
  );

  it('refuses to serve a non-image reclassified as a profile picture', async () => {
    const { service, em, documents } = setup();
    em.findOne.mockResolvedValue({ ...document, mimetype: 'text/html' });
    await expect(service.download(person, 7)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(documents.downloadDocument).not.toHaveBeenCalled();
  });

  it('deletes the binary only after the metadata transaction commits and records the deletion', async () => {
    const { service, em, events } = setup();
    const calls: string[] = [];
    em.transactional.mockImplementation(
      async (operation: (tx: typeof em) => Promise<void>) => {
        await operation(em);
        calls.push('commit');
      },
    );
    const cleanup = jest
      .spyOn(storage, 'deleteStoredDocumentFile')
      .mockImplementation(async () => {
        calls.push('file');
      });
    await service.remove(person, 7);
    expect(calls).toEqual(['commit', 'file']);
    expect(cleanup).toHaveBeenCalledWith({
      entityHandle: 'person',
      storedPath: 'opaque-file',
    });
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceHandle: 7,
        entityHandle: 'document',
        operation: 'afterDelete',
        actor: person,
      }),
    );
  });

  it('keeps the file when committing the metadata deletion fails', async () => {
    const { service, em } = setup();
    em.transactional.mockRejectedValue(new Error('database failure'));
    const cleanup = jest
      .spyOn(storage, 'deleteStoredDocumentFile')
      .mockResolvedValue();
    await expect(service.remove(person, 7)).rejects.toThrow('database failure');
    expect(cleanup).not.toHaveBeenCalled();
  });
});
