export const PUBLIC_GENERIC_READ_ENTITY_HANDLES = new Set([
  'translation',
  'entity',
  'entityGroup',
]);

export function isPublicGenericReadEntity(entityHandle: string): boolean {
  return PUBLIC_GENERIC_READ_ENTITY_HANDLES.has(entityHandle);
}
