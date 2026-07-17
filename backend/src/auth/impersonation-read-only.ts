import { SetMetadata } from '@nestjs/common';

export const IMPERSONATION_READ_ONLY_KEY = 'impersonation:read-only';

/**
 * Marks a non-GET route as read-only so it remains available while an
 * administrator is impersonating another user.
 *
 * Only use this for handlers that cannot mutate application or external
 * state. The impersonation guard otherwise rejects every non-read HTTP method.
 */
export function ImpersonationReadOnly() {
  return SetMetadata(IMPERSONATION_READ_ONLY_KEY, true);
}
