import { describe, expect, it } from '@jest/globals';
import {
  AI_CHAT_IMAGE_MAX_BYTES,
  assertChatImageSupport,
  buildOpenAiImageContent,
  chatMessageImages,
  validateChatImage,
} from './ai-chat-images.utils';
import { sanitizeModel } from './ai-response.utils';
import type { AiChatMessageItem } from '../../entity/AiChatMessageItem';

describe('chat image inputs', () => {
  it('exposes the configured vision capability in the client model catalog', () => {
    expect(
      sanitizeModel({ supportsVision: true } as never).supportsVision,
    ).toBe(true);
    expect(sanitizeModel({} as never).supportsVision).toBe(false);
  });
  it('enforces image capability and count for submitted attachments', () => {
    const images = [{ purpose: 'vision' }] as never;
    expect(() => assertChatImageSupport(images, false)).toThrow(
      'ai.chatVisionRequired',
    );
    expect(() =>
      assertChatImageSupport(
        Array(6).fill({ purpose: 'vision' }) as never,
        true,
      ),
    ).toThrow('ai.chatImageCountLimit');
    expect(() => assertChatImageSupport(images, true)).not.toThrow();
    expect(() =>
      assertChatImageSupport([{ purpose: 'importAnalysis' }] as never, false),
    ).not.toThrow();
  });
  it('rejects SVG, disguised text, empty and oversized uploads', () => {
    for (const buffer of [
      Buffer.from('<svg/>'),
      Buffer.from('not an image'),
      Buffer.alloc(0),
      Buffer.alloc(AI_CHAT_IMAGE_MAX_BYTES + 1),
    ]) {
      expect(() =>
        validateChatImage({
          buffer,
          mimetype: 'image/png',
        } as Express.Multer.File),
      ).toThrow('ai.chatImageInvalid');
    }
  });
  it('detects image bytes independently of the client MIME type', () => {
    const buffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1cAAAAASUVORK5CYII=',
      'base64',
    );
    expect(
      validateChatImage({
        buffer,
        mimetype: 'text/plain',
      } as Express.Multer.File),
    ).toBe('image/png');
  });
  it('builds provider-specific multipart content without serializing binary data on messages', () => {
    const message = {
      role: 'user',
      content: 'Read screenshot',
    } as AiChatMessageItem;
    chatMessageImages.set(message, [
      { mimeType: 'image/png', data: 'aGVsbG8=' },
    ]);
    expect(buildOpenAiImageContent(message, message.content, true)).toEqual([
      { type: 'input_text', text: 'Read screenshot' },
      {
        type: 'input_image',
        image_url: 'data:image/png;base64,aGVsbG8=',
        detail: 'auto',
      },
    ]);
    expect(buildOpenAiImageContent(message, message.content)).toEqual([
      { type: 'text', text: 'Read screenshot' },
      {
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,aGVsbG8=' },
      },
    ]);
    expect(JSON.stringify(message)).not.toContain('aGVsbG8=');
    expect(
      buildOpenAiImageContent({ ...message } as AiChatMessageItem, 'text only'),
    ).toBe('text only');
  });
});
