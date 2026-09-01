import type { SaplingFormConfigPayload, SaplingTableHeaderItem } from '@/entity/structure'

export type SaplingTableColumnPlacement = 'before' | 'after'

export const SAPLING_TABLE_COLUMN_DRAG_TYPE = 'application/x-sapling-table-column'

export interface SaplingTableColumnMove {
  sourceKey: string
  targetKey: string
  placement: SaplingTableColumnPlacement
}

export interface SaplingTableViewSaveRequest {
  name: string
  orderedColumnKeys: string[]
  selectableColumnKeys: string[]
  complete: (saved: boolean) => void
}

export function reorderTableColumnKeys(
  columnKeys: string[],
  move: SaplingTableColumnMove,
): string[] {
  if (move.sourceKey === move.targetKey) {
    return [...columnKeys]
  }

  const sourceIndex = columnKeys.indexOf(move.sourceKey)
  const targetIndex = columnKeys.indexOf(move.targetKey)
  if (sourceIndex < 0 || targetIndex < 0) {
    return [...columnKeys]
  }

  const nextKeys = [...columnKeys]
  const [sourceKey] = nextKeys.splice(sourceIndex, 1)
  if (!sourceKey) {
    return nextKeys
  }

  const nextTargetIndex = nextKeys.indexOf(move.targetKey)
  nextKeys.splice(nextTargetIndex + (move.placement === 'after' ? 1 : 0), 0, sourceKey)
  return nextKeys
}

export function placeTableColumnKey(columnKeys: string[], move: SaplingTableColumnMove): string[] {
  if (
    !move.sourceKey ||
    move.sourceKey === move.targetKey ||
    !columnKeys.includes(move.targetKey)
  ) {
    return [...columnKeys]
  }

  const nextKeys = columnKeys.filter((key) => key !== move.sourceKey)
  const targetIndex = nextKeys.indexOf(move.targetKey)
  nextKeys.splice(targetIndex + (move.placement === 'after' ? 1 : 0), 0, move.sourceKey)
  return nextKeys
}

export function removeTableColumnKey(columnKeys: string[], columnKey: string): string[] {
  if (columnKeys.length <= 1 || !columnKeys.includes(columnKey)) {
    return [...columnKeys]
  }

  return columnKeys.filter((key) => key !== columnKey)
}

export function selectTableColumns<T extends SaplingTableHeaderItem>(
  headers: T[],
  columnKeys: string[],
): T[] {
  const headerByKey = new Map(headers.map((header) => [String(header.key), header]))
  return [...new Set(columnKeys)]
    .map((key) => headerByKey.get(key))
    .filter((header): header is T => Boolean(header))
}

export function applyTableColumnOrder<T extends SaplingTableHeaderItem>(
  headers: T[],
  columnKeys: string[],
): T[] {
  if (columnKeys.length === 0) {
    return headers
  }

  const headerByKey = new Map(headers.map((header) => [String(header.key), header]))
  const orderedHeaders = columnKeys
    .map((key) => headerByKey.get(key))
    .filter((header): header is T => Boolean(header))
  const orderedKeys = new Set(orderedHeaders.map((header) => String(header.key)))

  return [...orderedHeaders, ...headers.filter((header) => !orderedKeys.has(String(header.key)))]
}

export function buildPersonalTableViewConfig(
  entityHandle: string,
  sourceConfig: SaplingFormConfigPayload | null | undefined,
  orderedColumnKeys: string[],
  selectableColumnKeys: string[] = orderedColumnKeys,
): SaplingFormConfigPayload {
  const fields = Object.fromEntries(
    Object.entries(sourceConfig?.fields ?? {}).map(([fieldName, fieldConfig]) => [
      fieldName,
      { ...fieldConfig },
    ]),
  )

  ;[...new Set(selectableColumnKeys.filter(Boolean))].forEach((fieldName) => {
    fields[fieldName] = {
      ...(fields[fieldName] ?? {}),
      tableVisible: false,
      tableOrder: null,
    }
  })

  ;[...new Set(orderedColumnKeys.filter(Boolean))].forEach((fieldName, tableOrder) => {
    fields[fieldName] = {
      ...(fields[fieldName] ?? {}),
      tableVisible: true,
      tableOrder,
    }
  })

  return {
    ...(sourceConfig ?? {}),
    schema: 'sapling.form-config.v1',
    entityHandle,
    fields,
    groups: sourceConfig?.groups
      ? Object.fromEntries(
          Object.entries(sourceConfig.groups).map(([groupName, groupConfig]) => [
            groupName,
            { ...groupConfig },
          ]),
        )
      : undefined,
    layout: sourceConfig?.layout ? { ...sourceConfig.layout } : undefined,
    metadata: {
      ...(sourceConfig?.metadata ?? {}),
      tableOrderMode: 'absolute',
    },
  }
}
