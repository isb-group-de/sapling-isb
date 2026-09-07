import { computed, ref, watch, type Ref } from 'vue'
import {
  compareInboxEntriesByDate,
  type InboxEntry,
  type InboxSection,
  type InboxSectionKey,
  type InboxSummaryCard,
} from './saplingInbox.utils'

export function useSaplingInboxWorkspace(
  sections: Ref<InboxSection[]>,
  notifications: Ref<InboxEntry[]>,
  cards: Ref<InboxSummaryCard[]>,
) {
  const view = ref<'overview' | 'notifications'>('overview')
  const category = ref<InboxSummaryCard['key'] | null>(null)
  const period = ref<InboxSectionKey | 'all'>('all')
  const search = ref<string | null>('')
  const selectedId = ref<string | null>(null)
  const page = ref(1)
  const pageSize = 30
  const tasks = computed(() => sections.value.flatMap((section) => section.items))
  const source = computed(() => (view.value === 'overview' ? tasks.value : notifications.value))
  const categoryCards = computed(() =>
    cards.value.map((card) => ({
      ...card,
      count: source.value.filter((entry) => matchesCategory(entry, card.key)).length,
    })),
  )
  const categoryEntries = computed(() =>
    source.value.filter((entry) => !category.value || matchesCategory(entry, category.value)),
  )
  const periodCounts = computed(() =>
    sections.value.map((section) => ({
      ...section,
      count: section.items.filter(
        (entry) => !category.value || matchesCategory(entry, category.value),
      ).length,
    })),
  )
  const filteredEntries = computed(() => {
    const periodIds =
      view.value === 'overview' && period.value !== 'all'
        ? new Set(
            sections.value
              .find((section) => section.key === period.value)
              ?.items.map((entry) => entry.id),
          )
        : null
    const terms = (search.value ?? '').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
    return categoryEntries.value
      .filter((entry) => {
        if (periodIds && !periodIds.has(entry.id)) return false
        const text = [
          entry.title,
          entry.description,
          entry.contextLabel,
          entry.statusLabel,
          entry.dateText,
          ...entry.supportLabels,
        ]
          .join(' ')
          .toLocaleLowerCase()
        return terms.every((term) => text.includes(term))
      })
      .sort((left, right) =>
        view.value === 'notifications'
          ? (right.dateValue?.getTime() ?? 0) - (left.dateValue?.getTime() ?? 0) ||
            left.title.localeCompare(right.title)
          : compareInboxEntriesByDate(left, right),
      )
  })
  const pageCount = computed(() => Math.max(1, Math.ceil(filteredEntries.value.length / pageSize)))
  const visibleEntries = computed(() =>
    filteredEntries.value.slice((page.value - 1) * pageSize, page.value * pageSize),
  )
  const selectedEntry = computed(
    () =>
      visibleEntries.value.find((entry) => entry.id === selectedId.value) ??
      visibleEntries.value[0] ??
      null,
  )
  const hasFilters = computed(
    () =>
      category.value !== null ||
      (search.value ?? '').trim() !== '' ||
      (view.value === 'overview' && period.value !== 'all'),
  )

  watch(
    [view, category, period, search],
    () => {
      page.value = 1
      selectedId.value = null
    },
    { flush: 'sync' },
  )
  watch(
    pageCount,
    (count) => {
      page.value = Math.min(page.value, count)
    },
    { flush: 'sync' },
  )

  function toggleCategory(key: InboxSummaryCard['key']) {
    category.value = category.value === key ? null : key
  }
  function resetFilters() {
    category.value = null
    period.value = 'all'
    search.value = ''
  }
  return {
    view,
    category,
    period,
    search,
    selectedId,
    page,
    pageCount,
    tasks,
    source,
    categoryCards,
    categoryEntries,
    periodCounts,
    filteredEntries,
    visibleEntries,
    selectedEntry,
    hasFilters,
    toggleCategory,
    resetFilters,
  }
}

function matchesCategory(entry: InboxEntry, category: InboxSummaryCard['key']) {
  return (entry.kind === 'notification' ? entry.sourceEntity : entry.kind) === category
}
