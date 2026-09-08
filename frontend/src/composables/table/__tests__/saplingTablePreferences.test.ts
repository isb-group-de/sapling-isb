import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { EntityTemplate } from '@/entity/structure'
import {
  getActiveGroupField,
  getGroupIdentity,
  getChangedGroupFields,
  getRowDeadlineState,
  isGroupTemplate,
  readTablePreferences,
  useTablePreferences,
} from '../saplingTablePreferences'

const field = (
  name: string,
  type = 'date',
  extra: Partial<EntityTemplate> = {},
): EntityTemplate => ({
  name,
  key: name,
  type,
  options: ['isDeadline'],
  ...extra,
})
afterEach(() => vi.useRealTimers())

describe('table presentation preferences', () => {
  it('repeats every nested heading when a parent changes, but only changed levels within a group', () => {
    const fields = ['status', 'priority']
    expect(getChangedGroupFields({ status: 'open', priority: 1 }, undefined, fields)).toEqual(
      fields,
    )
    expect(
      getChangedGroupFields(
        { status: 'closed', priority: 1 },
        { status: 'open', priority: 1 },
        fields,
      ),
    ).toEqual(fields)
    expect(
      getChangedGroupFields(
        { status: 'open', priority: 2 },
        { status: 'open', priority: 1 },
        fields,
      ),
    ).toEqual(['priority'])
    expect(
      getChangedGroupFields(
        { status: 'open', priority: 1 },
        { status: 'open', priority: 1 },
        fields,
      ),
    ).toEqual([])
  })

  it('defaults safely and ignores malformed stored data', () => {
    localStorage.setItem('sapling.table.preferences.broken', '{broken')
    expect(readTablePreferences('broken')).toEqual({
      rowDeadlineFields: [],
      showGrouping: false,
      groupField: '',
    })
    localStorage.setItem(
      'sapling.table.preferences.broken',
      JSON.stringify({ rowDeadlineFields: ['due', 5, 'due'], showGrouping: 'yes', groupField: {} }),
    )
    expect(readTablePreferences('broken')).toEqual({
      rowDeadlineFields: ['due'],
      showGrouping: false,
      groupField: '',
    })
  })

  it('persists per entity, shares live settings and switches entity without leaking preferences', () => {
    const entity = ref('preferences-a')
    const prefs = useTablePreferences(entity)
    expect(prefs.value.showGrouping).toBe(false)
    prefs.value = { rowDeadlineFields: ['due'], showGrouping: true, groupField: 'status' }
    expect(readTablePreferences(entity.value)).toEqual(prefs.value)
    expect(useTablePreferences(ref(entity.value)).value).toEqual(prefs.value)
    entity.value = 'preferences-b'
    expect(prefs.value.rowDeadlineFields).toEqual([])
  })

  it('uses date and datetime thresholds, gives overdue precedence and excludes unreadable fields', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 8, 12))
    const templates = [
      field('date'),
      field('time', 'datetime'),
      field('hidden', 'date', {
        fieldAccess: { allowRead: false } as EntityTemplate['fieldAccess'],
      }),
    ]
    const item = {
      date: '2026-09-08',
      time_date: '2026-09-08',
      time_time: '11:00',
      hidden: '2020-01-01',
    }
    expect(getRowDeadlineState(item, templates, ['date'])).toBe('upcoming')
    expect(getRowDeadlineState(item, templates, ['date', 'time'])).toBe('past')
    expect(getRowDeadlineState(item, templates, ['hidden'])).toBe('default')
    expect(getRowDeadlineState({ date: 'invalid' }, templates, ['date'])).toBe('default')
    expect(getRowDeadlineState(item, templates, [])).toBe('default')
  })

  it('never activates saved grouping for embedded tables or unsupported fields', () => {
    const templates = [field('status', 'string')]
    const prefs = { rowDeadlineFields: [], showGrouping: true, groupField: 'status' }
    expect(getActiveGroupField(prefs, templates, false)).toBe('')
    expect(getActiveGroupField(prefs, templates, true)).toBe('status')
    expect(getActiveGroupField({ ...prefs, showGrouping: false }, templates, true)).toBe('')
    expect(getActiveGroupField(prefs, [], true)).toBe('')
    expect(isGroupTemplate(field('many', 'string', { isReference: true, kind: 'm:n' }))).toBe(false)
    expect(isGroupTemplate(field('computed', 'string', { isPersistent: false }))).toBe(false)
    expect(getGroupIdentity({ handle: 4, title: 'A' })).toBe(
      getGroupIdentity({ handle: 4, title: 'B' }),
    )
    expect(getGroupIdentity(false)).not.toBe(getGroupIdentity(null))
  })
})
