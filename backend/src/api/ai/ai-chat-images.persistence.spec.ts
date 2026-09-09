import { beforeEach, describe, expect, it, jest } from '@jest/globals';
jest.mock('node:fs/promises', () => ({ readFile: jest.fn() }));
import { readFile } from 'node:fs/promises';
import { AiChatPersistenceService } from './ai-chat-persistence.service';
import { chatMessageImages } from './ai-chat-images.utils';
import type { AiChatMessageItem } from '../../entity/AiChatMessageItem';

describe('owned image history', () => {
  const user = { handle: 42 } as never;
  const session = { handle: 7 } as never;
  const attachment = {
    handle: 9,
    message: { handle: 2 },
    document: { entity: { handle: 'aiChatAttachment' }, path: 'opaque.png' },
  };
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1cAAAAASUVORK5CYII=',
    'base64',
  );
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(readFile).mockResolvedValue(png);
  });

  it('reloads images using owned attachment rows and leaves stored context untouched', async () => {
    const find = jest.fn(async (..._args: unknown[]) => [attachment]);
    const service = new AiChatPersistenceService({ find } as never);
    const message = {
      handle: 2,
      role: 'user',
      content: 'question',
      contextPayload: { documentHandle: 9999 },
    } as unknown as AiChatMessageItem;
    const history = await service.prepareVisionHistory(
      [message],
      session,
      user,
      true,
    );
    expect(find).toHaveBeenCalledWith(
      expect.anything(),
      {
        session: { handle: 7 },
        person: { handle: 42 },
        message: { handle: { $in: [2] } },
        purpose: 'vision',
      },
      expect.anything(),
    );
    expect(chatMessageImages.get(history[0]!)).toEqual([
      { mimeType: 'image/png', data: png.toString('base64') },
    ]);
    expect(chatMessageImages.get(message)).toBeUndefined();
    expect(message.contextPayload).toEqual({ documentHandle: 9999 });
  });
  it('rejects a non-vision model before reading any stored image', async () => {
    const service = new AiChatPersistenceService({
      find: jest.fn(async () => [attachment]),
    } as never);
    await expect(
      service.prepareVisionHistory(
        [{ handle: 2, role: 'user' } as AiChatMessageItem],
        session,
        user,
        false,
      ),
    ).rejects.toThrow('ai.chatVisionRequired');
    expect(readFile).not.toHaveBeenCalled();
  });
  it('does not resolve a preview belonging to another person', async () => {
    const findOne = jest.fn(async (..._args: unknown[]) => null);
    const service = new AiChatPersistenceService({ findOne } as never);
    await expect(service.findOwnedChatImage(9, user)).rejects.toThrow(
      'ai.chatAttachmentNotFound',
    );
    expect(findOne).toHaveBeenCalledWith(
      expect.anything(),
      { handle: 9, person: { handle: 42 }, purpose: 'vision' },
      expect.anything(),
    );
  });
});
