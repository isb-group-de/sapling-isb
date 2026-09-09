import { AiChatSessionItem } from '../../entity/AiChatSessionItem';

export function completeAiChatSessionResponse(
  session: AiChatSessionItem,
  completedAt = new Date(),
): void {
  session.responseStatus = 'idle';
  session.responseActivityAt = completedAt;
  session.lastResponseAt = completedAt;
}
