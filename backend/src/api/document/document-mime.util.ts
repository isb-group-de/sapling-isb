import * as path from 'path';

const MIME_TYPE_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.eml': 'message/rfc822',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.msg': 'application/vnd.ms-outlook',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.webm': 'video/webm',
};

/**
 * Browsers frequently upload mail files with an empty or generic MIME type.
 * Normalize the formats Sapling can preview from each individual filename so
 * multi-file uploads retain the correct metadata for every document.
 */
export function resolveUploadedDocumentMimeType(
  filename: string,
  uploadedMimeType?: string,
): string {
  const extension = path.extname(filename).toLowerCase();
  const inferredMimeType = MIME_TYPE_BY_EXTENSION[extension];

  if (inferredMimeType) {
    return inferredMimeType;
  }

  const normalizedUploadedMimeType = uploadedMimeType?.trim().toLowerCase();
  return normalizedUploadedMimeType || 'application/octet-stream';
}

/**
 * Multer exposes multipart filenames as Latin-1 in some browser/server
 * combinations even though browsers send UTF-8 bytes. Decode that reversible
 * mojibake while preserving filenames that are already valid Unicode.
 */
export function resolveUploadedDocumentFilename(filename: string): string {
  const utf8Candidate = Buffer.from(filename, 'latin1').toString('utf8');
  return utf8Candidate.includes('\uFFFD') ? filename : utf8Candidate;
}
