import { BadRequestException } from '@nestjs/common';
import {
  PROFILE_PICTURE_MAX_BYTES,
  validateProfilePicture,
} from './profile-picture.util';

describe('profile picture validation', () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6pY0AAAAASUVORK5CYII=',
    'base64',
  );
  it('recognizes image bytes even if multipart metadata is wrong', () => {
    expect(
      validateProfilePicture({
        buffer: png,
        mimetype: 'text/plain',
        originalname: 'photo.txt',
      } as Express.Multer.File),
    ).toBe('image/png');
  });
  it.each([
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    Buffer.from('<html>not a photo</html>'),
    Buffer.alloc(0),
    Buffer.alloc(PROFILE_PICTURE_MAX_BYTES + 1),
    png.subarray(0, 10),
  ])(
    'rejects invalid, truncated or oversized files despite an image MIME type',
    (buffer) => {
      expect(() =>
        validateProfilePicture({
          buffer,
          mimetype: 'image/png',
        } as Express.Multer.File),
      ).toThrow(BadRequestException);
    },
  );
  it('rejects missing multipart files', () => {
    expect(() => validateProfilePicture()).toThrow(BadRequestException);
  });
});
