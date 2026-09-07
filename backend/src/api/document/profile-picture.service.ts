import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { DocumentItem } from '../../entity/DocumentItem';
import { PersonItem } from '../../entity/PersonItem';
import { DocumentService, ReferencedImageDocument } from './document.service';
import {
  deleteStoredDocumentFile,
  getDocumentStorageFilePath,
} from './document-storage.util';
import {
  PROFILE_PICTURE_MIME_TYPES,
  PROFILE_PICTURE_TYPE,
} from './profile-picture.util';
import { AutomationEventService } from '../automation/automation-event.service';

/** Self-service access is scoped to the authenticated person's document reference. */
@Injectable()
export class ProfilePictureService {
  constructor(
    private readonly em: EntityManager,
    private readonly documents: DocumentService,
    @Optional() private readonly automationEvents?: AutomationEventService,
  ) {}

  private scope(person: PersonItem) {
    return {
      entity: { handle: 'person' },
      reference: String(person.handle),
      type: { handle: PROFILE_PICTURE_TYPE },
    };
  }

  private metadata(document: DocumentItem): ReferencedImageDocument {
    return {
      handle: document.handle,
      filename: document.filename,
      mimetype: document.mimetype,
      description: document.description ?? null,
      createdAt: document.createdAt ?? null,
    };
  }

  async list(person: PersonItem): Promise<ReferencedImageDocument[]> {
    const documents = await this.em.find(
      DocumentItem,
      {
        ...this.scope(person),
        mimetype: { $in: PROFILE_PICTURE_MIME_TYPES },
      },
      { orderBy: { createdAt: 'DESC', handle: 'DESC' } },
    );
    return documents.map((document) => this.metadata(document));
  }

  async upload(
    person: PersonItem,
    file: Express.Multer.File,
  ): Promise<ReferencedImageDocument> {
    const document = await this.documents.uploadDocument(
      file,
      'person',
      String(person.handle),
      PROFILE_PICTURE_TYPE,
      person,
    );
    return this.metadata(document);
  }

  private async findOwned(person: PersonItem, handle: number) {
    const document = await this.em.findOne(DocumentItem, {
      ...this.scope(person),
      handle,
    });
    if (!document) throw new NotFoundException('document.documentNotFound');
    return document;
  }

  async download(person: PersonItem, handle: number) {
    const document = await this.findOwned(person, handle);
    if (!PROFILE_PICTURE_MIME_TYPES.includes(document.mimetype)) {
      throw new NotFoundException('document.documentNotFound');
    }
    return this.documents.downloadDocument(handle, person);
  }

  async remove(person: PersonItem, handle: number): Promise<void> {
    const document = await this.findOwned(person, handle);
    const descriptor = { entityHandle: 'person', storedPath: document.path };
    // Validate before deleting metadata; remove the file only after commit succeeds.
    getDocumentStorageFilePath(descriptor.entityHandle, descriptor.storedPath);
    await this.em.transactional(async (em) => {
      em.remove(document);
      await em.flush();
      await this.automationEvents?.record({
        entityHandle: 'document',
        sourceHandle: handle,
        operation: 'afterDelete',
        actor: person,
        oldSnapshot: {
          handle,
          filename: document.filename,
          mimetype: document.mimetype,
          reference: document.reference,
          entity: { handle: 'person' },
          type: { handle: PROFILE_PICTURE_TYPE },
        },
        newSnapshot: null,
      });
    });
    await deleteStoredDocumentFile(descriptor);
  }
}
