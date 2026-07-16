import { describe, expect, it } from 'vitest'
import type { EntityGroupItem, EntityItem, EntityRouteItem } from '@/entity/entity'
import {
  getEffectiveRouteGroupHandle,
  getEntityNavigationGroupHandles,
  getEntityRoutesForNavigationGroup,
  matchesNavigationSearch,
  normalizeNavigationText,
  sortNavigationGroups,
  toggleNavigationHandle,
} from './saplingNavigation.utils'

describe('saplingNavigation utils', () => {
  it('normalizes nested search values and matches a query', () => {
    expect(normalizeNavigationText([' Tickets ', 42])).toBe('tickets 42')
    expect(matchesNavigationSearch('ticket', 'My Ticket', ['other'])).toBe(true)
    expect(matchesNavigationSearch('missing', 'My Ticket')).toBe(false)
  })

  it('sorts groups by configured order and translated label', () => {
    const groups = [
      { handle: 'b', sortOrder: 10 },
      { handle: 'a', sortOrder: 10 },
      { handle: 'first', sortOrder: 1 },
    ] as EntityGroupItem[]
    expect(sortNavigationGroups(groups, (handle) => handle).map((group) => group.handle)).toEqual([
      'first',
      'a',
      'b',
    ])
  })

  it('resolves route group overrides and group-specific routes', () => {
    const routes = [
      { route: 'ticket', group: 'service' },
      { route: 'ticket/all' },
      { route: '' },
    ] as EntityRouteItem[]
    const entity = { handle: 'ticket', group: 'work', routes } as EntityItem

    expect(getEffectiveRouteGroupHandle(entity, routes[0])).toBe('service')
    expect(getEntityRoutesForNavigationGroup(entity, 'work')).toEqual([routes[1]])
    expect([...getEntityNavigationGroupHandles(entity)]).toEqual(['service', 'work'])
  })

  it('toggles expanded handles without mutating the input', () => {
    const handles = ['one']
    expect(toggleNavigationHandle(handles, 'two')).toEqual(['one', 'two'])
    expect(toggleNavigationHandle(handles, 'one')).toEqual([])
    expect(handles).toEqual(['one'])
  })
})
