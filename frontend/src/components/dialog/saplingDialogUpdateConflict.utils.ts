import type { SaplingGenericItem } from '@/entity/entity'
import type { GenericUpdateConflictField } from '@/services/api.generic.service'

export type UpdateConflictSource = 'current' | 'attempted'

export function buildUpdateConflictResolutionPayload(
  fields: GenericUpdateConflictField[],
  selectedSources: Record<string, UpdateConflictSource>,
): SaplingGenericItem {
  const payload: SaplingGenericItem = {}

  fields.forEach((field) => {
    if (selectedSources[field.property] === 'attempted') {
      payload[field.property] = field.attemptedValue
    }
  })

  return payload
}
