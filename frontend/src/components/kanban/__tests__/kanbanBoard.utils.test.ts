import { describe, expect, it } from 'vitest'
import type { EntityTemplate } from '@/entity/structure'
import {
  buildKanbanOrderBy,
  formatKanbanDisplayValue,
  getKanbanColumnIcon,
  getKanbanColumnStyle,
  getKanbanRelationHandle,
  getKanbanRelationHandleNumber,
  isExpectedKanbanValue,
  normalizeKanbanFilterHandles,
} from '../kanbanBoard.utils'

describe('Kanban board utilities', () => {
  it('builds deterministic ordering from preferred and decorated fields', () => {
    const templates = [
      { name: 'updatedAt' },
      { name: 'sortOrder' },
      { name: 'title', options: ['isOrderASC'] },
    ] as EntityTemplate[]

    expect(buildKanbanOrderBy(templates, ['updatedAt'])).toEqual({
      updatedAt: 'DESC',
      sortOrder: 'ASC',
      title: 'ASC',
    })
    expect(buildKanbanOrderBy([])).toEqual({ handle: 'ASC' })
  })

  it('compares configured open values across boolean and serialized values', () => {
    expect(isExpectedKanbanValue(true)).toBe(true)
    expect(isExpectedKanbanValue('true')).toBe(true)
    expect(isExpectedKanbanValue('false', false)).toBe(true)
    expect(isExpectedKanbanValue(null, false)).toBe(true)
  })

  it('provides stable column color and icon fallbacks', () => {
    expect(getKanbanColumnStyle({ color: '#2563eb' })).toEqual({
      '--sapling-kanban-column-color': '#2563eb',
    })
    expect(getKanbanColumnStyle({})).toEqual({
      '--sapling-kanban-column-color': '#607d8b',
    })
    expect(getKanbanColumnIcon({})).toBe('mdi-ray-start-arrow')
  })

  it('normalizes nested relation handles without coercing invalid values', () => {
    expect(getKanbanRelationHandle({ handle: { handle: 42 } })).toBe('42')
    expect(getKanbanRelationHandleNumber({ handle: '7' })).toBe(7)
    expect(Number.isNaN(getKanbanRelationHandleNumber(null))).toBe(true)
  })

  it('drops invalid work-filter handles', () => {
    expect(normalizeKanbanFilterHandles(['7', 'invalid', '9'])).toEqual([7, 9])
  })

  it('formats primitive and generic fallback display values', () => {
    expect(formatKanbanDisplayValue(42)).toBe('42')
    expect(formatKanbanDisplayValue({ title: 'Open' })).toBe('Open')
    expect(formatKanbanDisplayValue(null)).toBe('')
  })
})
