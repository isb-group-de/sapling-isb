import * as fs from 'fs';
import { EmailDeliveryItem } from '../../entity/EmailDeliveryItem';
import { MailAttachment } from './mail-delivery.util';

export function buildMimeMessage(
  delivery: EmailDeliveryItem,
  attachments: MailAttachment[],
  plainTextBody: string,
  senderEmail?: string,
): string {
  const mixedBoundary = `mixed_${Date.now()}`;
  const alternativeBoundary = `alt_${Date.now()}`;
  const relatedBoundary = `related_${Date.now()}`;
  const inline = attachments.filter((attachment) => attachment.contentId);
  const regular = attachments.filter((attachment) => !attachment.contentId);
  const bodyType = inline.length
    ? `multipart/related; boundary="${relatedBoundary}"`
    : `multipart/alternative; boundary="${alternativeBoundary}"`;
  const headers = [
    ...(senderEmail ? [`From: ${senderEmail}`] : []),
    `To: ${delivery.toRecipients.join(', ')}`,
    ...(delivery.ccRecipients?.length
      ? [`Cc: ${delivery.ccRecipients.join(', ')}`]
      : []),
    ...(delivery.bccRecipients?.length
      ? [`Bcc: ${delivery.bccRecipients.join(', ')}`]
      : []),
    `Subject: ${encodeMimeHeader(delivery.subject)}`,
    'MIME-Version: 1.0',
    regular.length > 0
      ? `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`
      : `Content-Type: ${bodyType}`,
    '',
    '',
  ];

  const alternativeBody = [
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    plainTextBody,
    '',
    `--${alternativeBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    delivery.bodyHtml,
    '',
    `--${alternativeBoundary}--`,
    '',
  ].join('\r\n');

  const body = inline.length
    ? [
        `--${relatedBoundary}`,
        `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
        '',
        alternativeBody,
        ...inline.map((attachment) =>
          renderAttachment(attachment, relatedBoundary),
        ),
        `--${relatedBoundary}--`,
        '',
      ].join('\r\n')
    : alternativeBody;
  if (regular.length === 0) {
    return `${headers.join('\r\n')}${body}`;
  }

  const parts = [`--${mixedBoundary}`, `Content-Type: ${bodyType}`, '', body];

  for (const attachment of regular) {
    parts.push(renderAttachment(attachment, mixedBoundary));
  }

  parts.push(`--${mixedBoundary}--`, '');

  return `${headers.join('\r\n')}${parts.join('\r\n')}`;
}

function renderAttachment(
  attachment: MailAttachment,
  boundary: string,
): string {
  const content = fs.readFileSync(attachment.filePath).toString('base64');
  return [
    `--${boundary}`,
    `Content-Type: ${attachment.mimetype}; name="${escapeMimeValue(attachment.filename)}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: ${attachment.contentId ? 'inline' : 'attachment'}; filename="${escapeMimeValue(attachment.filename)}"`,
    ...(attachment.contentId ? [`Content-ID: <${attachment.contentId}>`] : []),
    '',
    content.match(/.{1,76}/g)?.join('\r\n') ?? '',
    '',
  ].join('\r\n');
}

function encodeMimeHeader(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function escapeMimeValue(value: string): string {
  return value.replace(/"/g, '');
}
