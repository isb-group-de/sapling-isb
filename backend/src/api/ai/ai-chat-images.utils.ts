import { BadRequestException } from '@nestjs/common';
import type { AiChatMessageItem } from '../../entity/AiChatMessageItem';
import type { AiChatAttachmentItem } from '../../entity/AiChatAttachmentItem';
import {
  validateProfilePicture,
  PROFILE_PICTURE_MAX_BYTES,
} from '../document/profile-picture.util';

export const AI_CHAT_IMAGE_MAX_BYTES = PROFILE_PICTURE_MAX_BYTES;
export const AI_CHAT_IMAGE_MAX_COUNT = 5;
export type ChatImage = { mimeType: string; data: string };

// Binary inputs belong only to this runtime invocation, never to JSON payloads.
export const chatMessageImages = new WeakMap<AiChatMessageItem, ChatImage[]>();

export function assertChatImageSupport(
  attachments: AiChatAttachmentItem[],
  supportsVision: boolean,
) {
  const images = attachments.filter(
    (attachment) => attachment.purpose === 'vision',
  );
  if (images.length && !supportsVision)
    throw new BadRequestException('ai.chatVisionRequired');
  if (images.length > AI_CHAT_IMAGE_MAX_COUNT)
    throw new BadRequestException('ai.chatImageCountLimit');
}

export function validateChatImage(file?: Express.Multer.File): string {
  try {
    return validateProfilePicture(file);
  } catch {
    throw new BadRequestException('ai.chatImageInvalid');
  }
}

export function buildOpenAiImageContent(
  message: AiChatMessageItem,
  text: string,
  responses = false,
): string | Array<Record<string, unknown>> {
  const images =
    message.role === 'user' ? chatMessageImages.get(message) : undefined;
  if (!images?.length) return text;
  return [
    { type: responses ? 'input_text' : 'text', text },
    ...images.map((image) => {
      const url = `data:${image.mimeType};base64,${image.data}`;
      return responses
        ? { type: 'input_image', image_url: url, detail: 'auto' }
        : { type: 'image_url', image_url: { url } };
    }),
  ];
}
