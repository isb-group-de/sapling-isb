import { EntityManager } from '@mikro-orm/core';
import { BadRequestException } from '@nestjs/common';
import { DocumentItem } from '../../entity/DocumentItem';
import { getDocumentStorageFilePath } from '../document/document-storage.util';
import { MailAttachment } from './mail-delivery.util';

export function normalizeMailImageEmbeds(markdown: string): string {
  return markdown.replace(
    /\{\{sapling-image:(\d+)(?:\|([^}]*))?\}\}/g,
    (_match, handle: string, label: string | undefined) =>
      `![${(label ?? '').replace(/[\[\]\\\r\n]/g, ' ')}](sapling-document:${handle})`,
  );
}

/** Resolve only image references belonging to the mail's authorized record. */
export async function resolveMailInlineImages(
  em: EntityManager,
  bodyHtml: string,
  entityHandle: string,
  reference?: string | number,
): Promise<{ bodyHtml: string; attachments: MailAttachment[] }> {
  const pattern = /(<img\s+src=")sapling-document:(\d+)(")/g;
  const handles = [
    ...new Set(
      Array.from(bodyHtml.matchAll(pattern), (match) => Number(match[2])),
    ),
  ];
  if (!handles.length) return { bodyHtml, attachments: [] };
  if (reference == null)
    throw new BadRequestException('mail.checkUnavailableAttachments');
  const documents = await em.find(
    DocumentItem,
    {
      handle: { $in: handles },
      entity: { handle: entityHandle },
      reference: String(reference),
    },
    { populate: ['entity'] },
  );
  if (
    documents.length !== handles.length ||
    documents.some(
      (document) =>
        document.entity.handle !== entityHandle ||
        document.reference !== String(reference) ||
        !document.mimetype.startsWith('image/'),
    )
  ) {
    throw new BadRequestException('mail.checkUnavailableAttachments');
  }
  return {
    bodyHtml: bodyHtml.replace(pattern, '$1cid:sapling-image-$2@sapling$3'),
    attachments: documents.map((document) => ({
      handle: document.handle!,
      filename: document.filename,
      mimetype: document.mimetype,
      filePath: getDocumentStorageFilePath(
        document.entity.handle,
        document.path,
      ),
      contentId: `sapling-image-${document.handle}@sapling`,
    })),
  };
}
