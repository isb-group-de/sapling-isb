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
const DRAFT_PREFIX = 'sapling.dialogDrafts.v2.'

/** Restored panes are lazy: their drafts must still participate in close confirmation. */
export function getWorkspaceDraftKeys(personHandle: string, tabId: string): string[] {
  const keys: string[] = []
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (!key?.startsWith(DRAFT_PREFIX)) continue
      try {
        const entry: unknown = JSON.parse(window.localStorage.getItem(key) ?? 'null')
        if (!isRecord(entry) || entry.version !== 2 || !isDraftContext(entry.context)) continue
        if (entry.context.personHandle !== personHandle) continue
        const route = new URL(entry.context.route, 'http://sapling.local')
        if (route.searchParams.get('workspaceTab') === tabId) keys.push(key)
      } catch {
        // A damaged entry must not hide the remaining valid drafts.
      }
    }
  } catch {
    // Storage is optional; never prevent closing a pane because it is unavailable.
  }
  return keys
}

export function clearWorkspaceDrafts(personHandle: string, tabId: string): void {
  for (const key of getWorkspaceDraftKeys(personHandle, tabId)) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      /* Best-effort local cleanup. */
    }
  }
}

/** Filters and ?open= may change after the editor mounted; the workspace identity may not. */
function draftRoute(route: string): string {
  try {
    const url = new URL(route, 'http://sapling.local')
    const tab = url.searchParams.get('workspaceTab')
    return tab ? `${url.pathname}?workspaceTab=${encodeURIComponent(tab)}` : route
  } catch {
    return route
  }
}

function entryKey(surface: SaplingDialogDraftSurface, context: SaplingDialogDraftContext): string {
  return (
    DRAFT_PREFIX +
    encodeURIComponent(
      JSON.stringify([
        surface,
        context.personHandle,
        draftRoute(context.route),
        context.entityHandle,
        context.mode,
        context.recordHandle,
        context.parentEntityHandle,
        context.parentRecordHandle,
        context.detailHandle,
      ]),
    )
  )
}

function readEntry(
  surface: SaplingDialogDraftSurface,
  context: SaplingDialogDraftContext,
): SaplingDialogDraftEntry | null {
  try {
    const entry: unknown = JSON.parse(
      window.localStorage.getItem(entryKey(surface, context)) ?? 'null',
    )
    return isRecord(entry) &&
      entry.version === 2 &&
      isDraftContext(entry.context) &&
      isRecord(entry.values) &&
      typeof entry.savedAt === 'string'
      ? { context: entry.context, values: entry.values, savedAt: entry.savedAt }
      : null
  } catch {
    return null
  }
}

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
  const stored = readEntry(surface, context)
  const entry = stored ?? readStore()?.entries[surface]
  if (!entry || !contextsMatch(entry.context, context)) {
    return null
  }

  // Migrate only the matching legacy entry, and only remove it after a successful write.
  if (!stored) writeSaplingDialogDraft(surface, context, entry.values)
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

  const entry = {
    version: 2,
    context,
    values,
    savedAt: new Date().toISOString(),
  }

  try {
    // Separate keys avoid overwriting unrelated drafts, including across browser windows.
    window.localStorage.setItem(entryKey(surface, context), JSON.stringify(entry))
    clearLegacyDraft(surface, context)
  } catch {
    // Draft recovery must never interrupt editing when storage is unavailable
    // or the browser quota has been exhausted.
  }
}

export function clearSaplingDialogDraft(
  surface: SaplingDialogDraftSurface,
  context?: SaplingDialogDraftContext | null,
): void {
  if (!context || !canUseLocalStorage()) {
    return
  }

  const entry = readEntry(surface, context)
  try {
    if (entry && contextsMatch(entry.context, context)) {
      window.localStorage.removeItem(entryKey(surface, context))
    }
    clearLegacyDraft(surface, context)
  } catch {
    // Clearing one recovery entry must never interfere with other open editors.
  }
}

function clearLegacyDraft(
  surface: SaplingDialogDraftSurface,
  context: SaplingDialogDraftContext,
): void {
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
  return (
    entryKey('edit', left) === entryKey('edit', right) &&
    left.recordVersion === right.recordVersion &&
    left.detailVersion === right.detailVersion
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
