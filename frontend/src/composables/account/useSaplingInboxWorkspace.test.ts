import { effectScope, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useSaplingInboxWorkspace } from './useSaplingInboxWorkspace'
import type { InboxEntry, InboxSection, InboxSummaryCard } from './saplingInbox.utils'

function entry(
  id: string,
  kind: InboxEntry['kind'] = 'ticket',
  extra: Partial<InboxEntry> = {},
): InboxEntry {
  return {
    id,
    kind,
    title: id,
    kindLabelKey: 'navigation.ticket',
    description: '',
    dateText: '',
    dateValue: new Date(2026, 8, 7),
    icon: 'mdi-ticket',
    supportLabels: [],
    route: '/ticket',
    ...extra,
  }
}
function setup() {
  const sections = ref([
    {
      key: 'today',
      items: [
        entry('today-ticket', 'ticket', {
          description: 'Customer request',
          supportLabels: ['Acme'],
        }),
        entry('today-event', 'event'),
      ],
    },
    { key: 'overdue', items: [entry('old-ticket', 'ticket', { dateValue: new Date(2026, 8, 1) })] },
    { key: 'unplanned', items: [entry('case', 'internalCase', { dateValue: null })] },
  ] as InboxSection[])
  const notifications = ref([
    entry('ticket-notice', 'notification', { sourceEntity: 'ticket' }),
    entry('event-notice', 'notification', {
      sourceEntity: 'event',
      dateValue: new Date(2026, 8, 8),
    }),
    entry('other-notice', 'notification', { sourceEntity: 'document' }),
  ])
  const cards = ref(
    ['ticket', 'event', 'effortEstimate', 'internalCase', 'salesOpportunity'].map((key) => ({
      key,
    })) as InboxSummaryCard[],
  )
  const scope = effectScope()
  const workspace = scope.run(() => useSaplingInboxWorkspace(sections, notifications, cards))!
  return { ...workspace, sections, notifications, stop: () => scope.stop() }
}

describe('inbox workspace filters and selection', () => {
  it('toggles each category on and off, including categories without results', () => {
    const w = setup()
    for (const [category, count] of [
      ['ticket', 2],
      ['event', 1],
      ['effortEstimate', 0],
      ['internalCase', 1],
      ['salesOpportunity', 0],
    ] as const) {
      w.toggleCategory(category)
      expect(w.filteredEntries.value).toHaveLength(count)
      expect(w.category.value).toBe(category)
      w.toggleCategory(category)
      expect(w.filteredEntries.value).toHaveLength(4)
    }
    w.stop()
  })
  it('combines category, day and search while retaining unfiltered counts', () => {
    const w = setup()
    w.toggleCategory('ticket')
    w.period.value = 'today'
    w.search.value = 'ACME request'
    expect(w.filteredEntries.value.map((item) => item.id)).toEqual(['today-ticket'])
    expect(w.source.value).toHaveLength(4)
    expect(w.categoryCards.value.find((card) => card.key === 'ticket')?.count).toBe(2)
    w.search.value = 'no match'
    expect(w.filteredEntries.value).toEqual([])
    expect(w.selectedEntry.value).toBeNull()
    w.resetFilters()
    expect(w.hasFilters.value).toBe(false)
    expect(w.filteredEntries.value).toHaveLength(4)
    w.search.value = null
    expect(w.filteredEntries.value).toHaveLength(4)
    w.stop()
  })
  it('uses source entity for notifications and ignores task periods in that view', () => {
    const w = setup()
    w.toggleCategory('ticket')
    w.period.value = 'overdue'
    w.view.value = 'notifications'
    expect(w.filteredEntries.value.map((item) => item.id)).toEqual(['ticket-notice'])
    expect(w.categoryCards.value.find((card) => card.key === 'ticket')?.count).toBe(1)
    w.toggleCategory('ticket')
    expect(w.filteredEntries.value[0]?.id).toBe('event-notice')
    expect(w.filteredEntries.value).toHaveLength(3)
    w.stop()
  })
  it('retains filters and valid selections on refresh, and repairs removed selections and pages', () => {
    const w = setup()
    w.view.value = 'notifications'
    w.toggleCategory('ticket')
    w.notifications.value = Array.from({ length: 65 }, (_, i) =>
      entry(`notice-${i}`, 'notification', { sourceEntity: 'ticket' }),
    )
    expect(w.visibleEntries.value).toHaveLength(30)
    w.page.value = 3
    expect(w.visibleEntries.value).toHaveLength(5)
    w.selectedId.value = w.visibleEntries.value[1]!.id
    const selected = w.selectedEntry.value!
    w.notifications.value = w.notifications.value.map((item) => ({
      ...item,
      description: 'Updated',
    }))
    expect(w.selectedEntry.value?.id).toBe(selected.id)
    expect(w.selectedEntry.value?.description).toBe('Updated')
    w.notifications.value = w.notifications.value.slice(0, 1)
    expect(w.page.value).toBe(1)
    expect(w.selectedEntry.value?.id).toBe('notice-0')
    expect(w.category.value).toBe('ticket')
    w.search.value = 'nothing'
    expect(w.selectedEntry.value).toBeNull()
    w.stop()
  })
})
