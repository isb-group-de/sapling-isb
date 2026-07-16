import type { LocationQuery } from 'vue-router'
import type { SortItem } from '@/entity/structure'

export type SaplingTableRouteState = {
  filter: unknown
  search: string
  sortBy: SortItem[]
  page: number
  itemsPerPage: number | null
}

export type SaplingTableUrlState = {
  search: string
  page: number
  itemsPerPage: number
  defaultItemsPerPage: number
  sortBy: SortItem[]
  filter: Record<string, unknown> | null
}

export function readSaplingTableRouteState(
  query: LocationQuery,
  enabled: boolean,
): SaplingTableRouteState {
  if (!enabled) {
    return { filter: null, search: '', sortBy: [], page: 1, itemsPerPage: null }
  }

  return {
    filter: parseFilter(firstQueryValue(query.filter)),
    search: firstQueryValue(query.search) ?? '',
    sortBy: parseSortBy(firstQueryValue(query.sortBy)),
    page: parsePositiveInteger(firstQueryValue(query.page)) ?? 1,
    itemsPerPage: parsePositiveInteger(firstQueryValue(query.itemsPerPage)),
  }
}

export function replaceSaplingTableUrlState(state: SaplingTableUrlState, enabled: boolean): void {
  if (!enabled || typeof window === 'undefined') {
    return
  }

  const params = new URLSearchParams(window.location.search)
  setOptionalParam(params, 'search', state.search.trim() || null)
  setOptionalParam(params, 'page', state.page > 1 ? String(state.page) : null)
  setOptionalParam(
    params,
    'itemsPerPage',
    state.itemsPerPage !== state.defaultItemsPerPage ? String(state.itemsPerPage) : null,
  )
  setOptionalParam(params, 'sortBy', state.sortBy.length > 0 ? JSON.stringify(state.sortBy) : null)
  setOptionalParam(
    params,
    'filter',
    state.filter && Object.keys(state.filter).length > 0 ? JSON.stringify(state.filter) : null,
  )

  const queryString = params.toString()
  const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}${window.location.hash}`
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl)
  }
}

function firstQueryValue(value: LocationQuery[string]): string | null {
  const candidate = Array.isArray(value) ? value[0] : value
  return typeof candidate === 'string' ? candidate : null
}

function parseFilter(value: string | null): unknown {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function parseSortBy(value: string | null): SortItem[] {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter(
        (item): item is SortItem =>
          item != null &&
          typeof item === 'object' &&
          'key' in item &&
          typeof item.key === 'string' &&
          item.key.length > 0,
      )
      .map((item) => ({ key: item.key, order: item.order === 'desc' ? 'desc' : 'asc' }))
  } catch {
    return []
  }
}

function parsePositiveInteger(value: string | null): number | null {
  const parsed = value ? Number.parseInt(value, 10) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function setOptionalParam(params: URLSearchParams, key: string, value: string | null): void {
  if (value) {
    params.set(key, value)
  } else {
    params.delete(key)
  }
}
