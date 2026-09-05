import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { DocumentItem } from '../../entity/DocumentItem';
import * as uuid from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { EntityManager } from '@mikro-orm/core';
import { EntityItem } from '../../entity/EntityItem';
import { DocumentTypeItem } from '../../entity/DocumentTypeItem';
import { PersonItem } from '../../entity/PersonItem';
import {
  resolveUploadedDocumentDescription,
  resolveUploadedDocumentFilename,
  resolveUploadedDocumentMimeType,
} from './document-mime.util';
import {
  extractEmlAttachments,
  extractMsgAttachments,
} from './document-mail-attachment.util';
import {
  getDocumentStorageDirectory,
  getDocumentStorageFilePath,
} from './document-storage.util';
import { AutomationEventService } from '../automation/automation-event.service';

export interface ReferencedImageDocument {
  handle: number;
  filename: string;
  mimetype: string;
  description: string | null;
  createdAt: Date | null;
}

/**
 * @class
 * @version         1.0
 * @author          Martin Rosbund
 * @summary         Service for document operations, including upload and download logic.
 *
 * @property        {EntityManager} em  Entity manager for database operations
 *
 * @method          uploadDocument     Uploads a document for a given entity and reference
 * @method          downloadDocument   Downloads a document by handle
 */
@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  /**
   * Entity manager for database operations.
   * @type {EntityManager}
   */
  constructor(
    private readonly em: EntityManager,
    @Optional()
    private readonly automationEvents?: AutomationEventService,
  ) {}

  async findReferencedImages(
    entityHandle: string,
    reference: string,
  ): Promise<ReferencedImageDocument[]> {
    const documents = await this.em.find(
      DocumentItem,
      {
        entity: { handle: entityHandle },
        reference,
      },
      { orderBy: { createdAt: 'DESC' } },
    );

    return documents
      .filter((document) => document.mimetype.startsWith('image/'))
      .map((document) => ({
        handle: document.handle,
        filename: document.filename,
        mimetype: document.mimetype,
        description: document.description ?? null,
        createdAt: document.createdAt ?? null,
      }));
  }

  /**
   * Uploads a document for a given entity and reference.
   * @param {Express.Multer.File} file Uploaded file
   * @param {string} entityHandle Name of the entity
   * @param {string} reference Reference handle
   * @param {string} typeHandle Type handle for the document
   * @param {PersonItem} currentUser Current user object
   * @param {string} description Optional description
   * @returns Uploaded DocumentItem
   */
  async uploadDocument(
    file: Express.Multer.File,
    entityHandle: string,
    reference: string,
    typeHandle: string,
    currentUser: PersonItem,
    description?: string,
  ): Promise<DocumentItem> {
    const entity = await this.em.findOne(EntityItem, { handle: entityHandle });
    if (!entity) throw new NotFoundException('global.entityNotFound');
    const filename = resolveUploadedDocumentFilename(file.originalname);
    const mimetype = resolveUploadedDocumentMimeType(filename, file.mimetype);
    const isEml = mimetype === 'message/rfc822';
    const isMsg = mimetype === 'application/vnd.ms-outlook';
    const type = await this.em.findOne(DocumentTypeItem, {
      handle:
        typeHandle === 'document' && (isEml || isMsg) ? 'email' : typeHandle,
    });
    if (!type) throw new NotFoundException('document.documentTypeNotFound');

    const storageDir = getDocumentStorageDirectory(entityHandle);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const document = this.createStoredDocument({
      buffer: file.buffer,
      filename,
      mimetype,
      description,
      reference,
      entity,
      type,
      currentUser,
      storageDir,
    });
    const documents = [document];

    if (isEml || isMsg) {
      try {
        const attachmentType = await this.em.findOne(DocumentTypeItem, {
          handle: 'document',
        });
        if (!attachmentType) {
          this.logger.warn(
            `Skipped mail attachment extraction because document type "document" is missing`,
          );
        } else {
          const attachments = isEml
            ? await extractEmlAttachments(file.buffer)
            : extractMsgAttachments(file.buffer);
          documents.push(
            ...attachments.map((attachment) =>
              this.createStoredDocument({
                buffer: attachment.buffer,
                filename: attachment.filename,
                mimetype: resolveUploadedDocumentMimeType(
                  attachment.filename,
                  attachment.mimetype,
                ),
                description: attachment.filename,
                reference,
                entity,
                type: attachmentType,
                currentUser,
                storageDir,
              }),
            ),
          );
        }
      } catch (error) {
        this.logger.warn(
          `Could not extract attachments from uploaded mail file "${document.filename}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    await this.runAtomic(async () => {
      this.em.persist(documents);
      await this.em.flush();
      for (const stored of documents) {
        await this.automationEvents?.record({
          entityHandle: 'document',
          sourceHandle: stored.handle,
          operation: 'afterInsert',
          actor: currentUser,
          newSnapshot: {
            handle: stored.handle,
            filename: stored.filename,
            mimetype: stored.mimetype,
            description: stored.description,
            reference: stored.reference,
            entity: { handle: entity.handle },
            type: { handle: stored.type.handle },
            person: { handle: currentUser.handle },
          },
        });
      }
    });
    return document;
  }

  private createStoredDocument(options: {
    buffer: Buffer;
    filename: string;
    mimetype: string;
    description?: string;
    reference: string;
    entity: EntityItem;
    type: DocumentTypeItem;
    currentUser: PersonItem;
    storageDir: string;
  }): DocumentItem {
    const guid = uuid.v4();
    fs.writeFileSync(path.join(options.storageDir, guid), options.buffer);

    const document = new DocumentItem();
    document.reference = options.reference;
    document.path = guid;
    document.filename = options.filename;
    document.mimetype = options.mimetype;
    document.length = options.buffer.length;
    document.description = resolveUploadedDocumentDescription(
      options.filename,
      options.description,
    );
    document.entity = options.entity;
    document.type = options.type;
    document.person = { handle: options.currentUser.handle } as PersonItem;
    return document;
  }

  private runAtomic<T>(operation: () => Promise<T>): Promise<T> {
    return typeof this.em.transactional === 'function'
      ? this.em.transactional(operation)
      : operation();
  }

  /**
   * Downloads a document by handle.
   * @param {number} handle Document handle
   * @param {PersonItem} currentUser Current user object
   * @returns Object containing file path and document item
   */
  async downloadDocument(
    handle: number,
    _currentUser: PersonItem,
  ): Promise<{ filePath: string; document: DocumentItem }> {
    void _currentUser;

    const document = await this.em.findOne(
      DocumentItem,
      { handle: handle },
      { populate: ['entity'] },
    );
    if (!document) throw new NotFoundException('document.documentNotFound');

    const filePath = getDocumentStorageFilePath(
      document.entity.handle,
      document.path,
    );

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('document.fileNotFound');
    }

    return { filePath, document };
  }
}
