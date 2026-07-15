/**
 * Represents a favorite item for a person and entity.
 */
export interface SaplingGenericItem {
  // Generic entity payloads intentionally carry heterogeneous backend values.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}
