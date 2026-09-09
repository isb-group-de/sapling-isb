import 'reflect-metadata';
import type { SaplingKanbanMetadata } from './entity-metadata.types';

const SAPLING_KANBAN_METADATA_KEY = 'sapling:kanban';

export function SaplingKanban(metadata: SaplingKanbanMetadata) {
  return function (target: object, propertyKey: string | symbol) {
    Reflect.defineMetadata(
      SAPLING_KANBAN_METADATA_KEY,
      {
        columnField: metadata.columnField.trim(),
        scopeOpenField: metadata.scopeOpenField?.trim() || undefined,
        scopeOpenValue:
          typeof metadata.scopeOpenValue === 'boolean'
            ? metadata.scopeOpenValue
            : undefined,
        recordScopeOpenField:
          metadata.recordScopeOpenField?.trim() || undefined,
        recordScopeOpenValue:
          typeof metadata.recordScopeOpenValue === 'boolean'
            ? metadata.recordScopeOpenValue
            : undefined,
        cardSubtitleFields: normalizeKanbanFieldList(
          metadata.cardSubtitleFields,
        ),
        cardMetaFields: normalizeKanbanFieldList(metadata.cardMetaFields),
        cardFooterFields: normalizeKanbanFieldList(metadata.cardFooterFields),
        columnDescriptionField:
          metadata.columnDescriptionField?.trim() || undefined,
      } satisfies SaplingKanbanMetadata,
      target,
      propertyKey,
    );
  };
}

export function getSaplingKanban(
  target: object,
  propertyKey: string | symbol,
): SaplingKanbanMetadata | null {
  const metadata = Reflect.getMetadata(
    SAPLING_KANBAN_METADATA_KEY,
    target,
    propertyKey,
  ) as Partial<SaplingKanbanMetadata> | null;

  if (!metadata || typeof metadata.columnField !== 'string') {
    return null;
  }

  const columnField = metadata.columnField.trim();
  if (!columnField) {
    return null;
  }

  return {
    columnField,
    scopeOpenField:
      typeof metadata.scopeOpenField === 'string'
        ? metadata.scopeOpenField.trim() || undefined
        : undefined,
    scopeOpenValue:
      typeof metadata.scopeOpenValue === 'boolean'
        ? metadata.scopeOpenValue
        : undefined,
    recordScopeOpenField:
      typeof metadata.recordScopeOpenField === 'string'
        ? metadata.recordScopeOpenField.trim() || undefined
        : undefined,
    recordScopeOpenValue:
      typeof metadata.recordScopeOpenValue === 'boolean'
        ? metadata.recordScopeOpenValue
        : undefined,
    cardSubtitleFields: normalizeKanbanFieldList(metadata.cardSubtitleFields),
    cardMetaFields: normalizeKanbanFieldList(metadata.cardMetaFields),
    cardFooterFields: normalizeKanbanFieldList(metadata.cardFooterFields),
    columnDescriptionField:
      typeof metadata.columnDescriptionField === 'string'
        ? metadata.columnDescriptionField.trim() || undefined
        : undefined,
  };
}

function normalizeKanbanFieldList(fields?: string[]): string[] | undefined {
  const normalizedFields = Array.isArray(fields)
    ? fields.map((field) => field.trim()).filter(Boolean)
    : [];

  return normalizedFields.length > 0 ? normalizedFields : undefined;
}
