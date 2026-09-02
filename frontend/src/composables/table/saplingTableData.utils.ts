import ApiGenericService, { type FilterQuery } from '@/services/api.generic.service'
import type { ColumnFilterItem, EntityTemplate } from '@/entity/structure'
import type { SaplingGenericItem } from '@/entity/entity'
import {
  buildTableFilter,
  isFilterableTableColumn,
  isTextSearchableTemplate,
} from '@/utils/saplingTableUtil'

export function buildRouteSearchFilterCandidates(
  search: string,
  entityTemplates: EntityTemplate[],
  searchFieldNames?: string[],
): FilterQuery[] {
  const normalizedSearch = search.trim()
  if (!normalizedSearch) {
    return []
  }

  const currentSearchFilter = buildTableFilter({ search, entityTemplates, searchFieldNames })
  const allowedSearchFieldNames = searchFieldNames ? new Set(searchFieldNames) : null
  const searchableTemplates = entityTemplates
    .filter(isFilterableTableColumn)
    .filter(isTextSearchableTemplate)
    .filter(
      (template) => allowedSearchFieldNames === null || allowedSearchFieldNames.has(template.name),
    )
  const legacySearchFilter: FilterQuery = searchableTemplates.length
    ? {
        $or: searchableTemplates.map((template) => ({
          [template.name]: { $ilike: `%${normalizedSearch}%` },
        })),
      }
    : {}

  return [currentSearchFilter, legacySearchFilter]
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ERR_CANCELED'
  )
}

export function isOpenChipReferenceTemplate(template: EntityTemplate): boolean {
  return (
    template.kind === 'm:1' &&
    Boolean(template.referenceName) &&
    template.options?.includes('isChip') === true
  )
}

export async function buildDefaultOpenChipColumnFilter(
  template: EntityTemplate,
): Promise<{ key: string; value: ColumnFilterItem } | null> {
  const referenceName = template.referenceName
  if (!referenceName) {
    return null
  }

  let referenceItems: SaplingGenericItem[]
  try {
    referenceItems = await ApiGenericService.findAll<SaplingGenericItem>(referenceName)
  } catch {
    return null
  }

  if (!referenceItems.some((item) => typeof item.isOpen === 'boolean')) {
    return null
  }

  const openItems = referenceItems.filter((item) => item.isOpen !== false)
  if (openItems.length === referenceItems.length) {
    return null
  }

  const relationItems = openItems
    .map((item): SaplingGenericItem | null => {
      const value = item.handle
      return typeof value === 'string' || typeof value === 'number' ? { handle: value } : null
    })
    .filter((item): item is SaplingGenericItem => item !== null)

  return {
    key: template.key ?? template.name,
    value: {
      operator: 'eq',
      value: '',
      relationItems:
        relationItems.length > 0 ? relationItems : [{ handle: '__sapling_empty_chip_filter__' }],
    },
  }
}
