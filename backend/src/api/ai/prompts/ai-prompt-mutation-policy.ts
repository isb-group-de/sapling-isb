import { ForbiddenException } from '@nestjs/common';
import type { PersonItem } from '../../../entity/PersonItem';

/** Also enforced on internal generic/MCP paths, not just the HTTP guard. */
export function assertPromptMutation(
  entity: string,
  operation: 'create' | 'update' | 'delete',
  user: PersonItem,
  data: Record<string, unknown> = {},
): void {
  if (
    ['aiChatSession', 'aiAgentRun', 'inboundEmail'].includes(entity) &&
    Object.hasOwn(data, 'promptManifest')
  )
    throw new ForbiddenException('ai.promptManagedPublicationRequired');
  if (!['aiPromptTemplate', 'aiPromptVersion'].includes(entity)) return;
  const administrator = Array.from(user.roles ?? []).some(
    (role) => role.isAdministrator === true,
  );
  if (
    !administrator ||
    entity === 'aiPromptVersion' ||
    operation !== 'update' ||
    Object.keys(data).some(
      (key) => !['title', 'description', 'draft'].includes(key),
    )
  ) {
    throw new ForbiddenException('ai.promptManagedPublicationRequired');
  }
}

export function assertPromptRead(
  entity: string,
  user: PersonItem | null | undefined,
): void {
  if (
    ['aiPromptTemplate', 'aiPromptVersion'].includes(entity) &&
    !Array.from(user?.roles ?? []).some((role) => role.isAdministrator === true)
  )
    throw new ForbiddenException('global.permissionDenied');
}
