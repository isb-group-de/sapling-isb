import { BadRequestException } from '@nestjs/common';

export const PROFILE_PICTURE_TYPE = 'profilePicture';
export const PROFILE_PICTURE_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_PICTURE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

/** Check file signatures rather than trusting multipart MIME types or extensions. */
export function validateProfilePicture(file?: Express.Multer.File): string {
  const data = file?.buffer;
  if (!data?.length || data.length > PROFILE_PICTURE_MAX_BYTES) {
    throw new BadRequestException('account.profilePictureInvalid');
  }
  if (
    data.length >= 24 &&
    data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) &&
    data.toString('ascii', 12, 16) === 'IHDR'
  )
    return 'image/png';
  if (
    data.length >= 4 &&
    data[0] === 0xff &&
    data[1] === 0xd8 &&
    data[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (
    data.length >= 13 &&
    ['GIF87a', 'GIF89a'].includes(data.toString('ascii', 0, 6))
  ) {
    return 'image/gif';
  }
  if (
    data.length >= 20 &&
    data.toString('ascii', 0, 4) === 'RIFF' &&
    data.toString('ascii', 8, 12) === 'WEBP' &&
    ['VP8 ', 'VP8L', 'VP8X'].includes(data.toString('ascii', 12, 16))
  )
    return 'image/webp';
  throw new BadRequestException('account.profilePictureInvalid');
}
