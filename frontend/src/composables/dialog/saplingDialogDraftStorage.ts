export type SaplingDialogDraftSurface = 'edit' | 'information' | 'phoneCall'

export interface SaplingDialogDraftContext {
  route: string
  personHandle: string
  entityHandle: string
  mode: string
  recordHandle: string
  recordVersion: string
  parentEntityHandle: string
  parentRecordHandle: string
  detailHandle: string
  detailVersion: string
}

interface SaplingDialogDraftEntry {
  context: SaplingDialogDraftContext
  values: Record<string, unknown>
  savedAt: string
}

interface SaplingDialogDraftStore {
  version: 1
  entries: Partial<Record<SaplingDialogDraftSurface, SaplingDialogDraftEntry>>
}

const STORAGE_KEY = 'sapling.dialogDrafts.v1'

export function getCurrentDialogDraftRoute(): string {
  if (typeof window === 'undefined') {
    return ''
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

export function normalizeDialogDraftIdentifier(value: unknown): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString()
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return ''
}

export function readSaplingDialogDraft(
  surface: SaplingDialogDraftSurface,
  context: SaplingDialogDraftContext,
): Record<string, unknown> | null {
  const entry = readStore()?.entries[surface]
  if (!entry || !contextsMatch(entry.context, context)) {
    return null
  }

  return { ...entry.values }
}

export function writeSaplingDialogDraft(
  surface: SaplingDialogDraftSurface,
  context: SaplingDialogDraftContext,
  values: Record<string, unknown>,
): void {
  if (!canUseLocalStorage()) {
    return
  }

  const store = readStore() ?? createEmptyStore()
  store.entries[surface] = {
    context,
    values,
    savedAt: new Date().toISOString(),
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Draft recovery must never interrupt editing when storage is unavailable
    // or the browser quota has been exhausted.
  }
}

export function clearSaplingDialogDraft(
  surface: SaplingDialogDraftSurface,
  context?: SaplingDialogDraftContext | null,
): void {
  if (!canUseLocalStorage()) {
    return
  }

  const store = readStore()
  const entry = store?.entries[surface]
  if (!store || !entry || (context && !contextsMatch(entry.context, context))) {
    return
  }

  delete store.entries[surface]

  try {
    if (Object.keys(store.entries).length === 0) {
      window.localStorage.removeItem(STORAGE_KEY)
      return
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Clearing a recovery aid is best-effort when browser storage is blocked.
  }
}

function createEmptyStore(): SaplingDialogDraftStore {
  return { version: 1, entries: {} }
}

function readStore(): SaplingDialogDraftStore | null {
  if (!canUseLocalStorage()) {
    return null
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.entries)) {
      return null
    }

    const entries: SaplingDialogDraftStore['entries'] = {}
    for (const surface of ['edit', 'information', 'phoneCall'] as const) {
      const entry = parsed.entries[surface]
      if (
        isRecord(entry) &&
        isDraftContext(entry.context) &&
        isRecord(entry.values) &&
        typeof entry.savedAt === 'string'
      ) {
        entries[surface] = {
          context: entry.context,
          values: entry.values,
          savedAt: entry.savedAt,
        }
      }
    }

    return { version: 1, entries }
  } catch {
    return null
  }
}

function contextsMatch(left: SaplingDialogDraftContext, right: SaplingDialogDraftContext): boolean {
  return (Object.keys(left) as Array<keyof SaplingDialogDraftContext>).every(
    (key) => left[key] === right[key],
  )
}

function isDraftContext(value: unknown): value is SaplingDialogDraftContext {
  if (!isRecord(value)) {
    return false
  }

  return [
    'route',
    'personHandle',
    'entityHandle',
    'mode',
    'recordHandle',
    'recordVersion',
    'parentEntityHandle',
    'parentRecordHandle',
    'detailHandle',
    'detailVersion',
  ].every((key) => typeof value[key] === 'string')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function canUseLocalStorage(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return typeof window.localStorage !== 'undefined'
  } catch {
    return false
  }
}
