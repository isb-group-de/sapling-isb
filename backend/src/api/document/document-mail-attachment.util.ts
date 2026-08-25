import PostalMime from 'postal-mime';
import MsgReader from '@kenjiuno/msgreader';
import {
  resolveUploadedDocumentFilename,
  resolveUploadedDocumentMimeType,
} from './document-mime.util';

export type ExtractedMailAttachment = {
  filename: string;
  mimetype: string;
  buffer: Buffer;
};

/**
 * Extracts user-visible attachments from an RFC 822 message. Inline MIME parts
 * remain part of the original EML so signature images do not clutter the
 * linked document list.
 */
export async function extractEmlAttachments(
  rawMessage: Buffer,
): Promise<ExtractedMailAttachment[]> {
  const email = await PostalMime.parse(rawMessage, {
    attachmentEncoding: 'arraybuffer',
    rfc822Attachments: true,
  });

  return email.attachments
    .filter(
      (attachment) =>
        attachment.disposition !== 'inline' && Boolean(attachment.content),
    )
    .map((attachment, index) => ({
      filename: resolveUploadedDocumentFilename(
        attachment.filename || `attachment-${index + 1}`,
      ).slice(0, 256),
      mimetype: attachment.mimeType || 'application/octet-stream',
      buffer: attachmentContentToBuffer(attachment.content),
    }));
}

/** Extracts attachments Outlook marks as visible from a compound MSG file. */
export function extractMsgAttachments(
  rawMessage: Buffer,
): ExtractedMailAttachment[] {
  const reader = new MsgReader(Uint8Array.from(rawMessage).buffer);
  const message = reader.getFileData();

  if (message.error) {
    throw new Error(message.error);
  }

  return (message.attachments ?? []).flatMap((attachmentInfo, index) => {
    if (attachmentInfo.attachmentHidden) {
      return [];
    }

    const attachment = reader.getAttachment(attachmentInfo);
    const filename = resolveUploadedDocumentFilename(
      attachment.fileName ||
        attachmentInfo.fileName ||
        attachmentInfo.fileNameShort ||
        `attachment-${index + 1}`,
    ).slice(0, 256);

    return [
      {
        filename,
        mimetype: resolveUploadedDocumentMimeType(
          filename,
          attachmentInfo.attachMimeTag,
        ),
        buffer: Buffer.from(attachment.content),
      },
    ];
  });
}

function attachmentContentToBuffer(
  content: ArrayBuffer | Uint8Array | string,
): Buffer {
  if (typeof content === 'string') {
    return Buffer.from(content, 'utf8');
  }

  if (content instanceof ArrayBuffer) {
    return Buffer.from(content);
  }

  return Buffer.from(content.buffer, content.byteOffset, content.byteLength);
}
