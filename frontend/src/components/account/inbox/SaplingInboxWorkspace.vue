<template>
  <div class="sapling-inbox-workspace">
    <div class="sapling-inbox-workspace__toolbar">
      <div class="sapling-chip-row" :aria-label="$t('navigation.inbox')">
        <v-btn
          :variant="view === 'overview' ? 'flat' : 'text'"
          :prepend-icon="view === 'overview' ? 'mdi-check' : undefined"
          color="primary"
          :aria-pressed="view === 'overview'"
          @click="view = 'overview'"
        >
          {{ $t('inbox.openTasks') }} · {{ tasks.length }}
        </v-btn>
        <v-btn
          :variant="view === 'notifications' ? 'flat' : 'text'"
          :prepend-icon="view === 'notifications' ? 'mdi-check' : undefined"
          color="primary"
          :aria-pressed="view === 'notifications'"
          @click="view = 'notifications'"
        >
          {{ $t('navigation.inboxNotification') }} · {{ notifications.length }}
        </v-btn>
      </div>
      <v-text-field
        v-model="search"
        class="sapling-inbox-workspace__search"
        :label="$t('inbox.searchEntries')"
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
        density="compact"
        hide-details
        clearable
        @click:clear="search = ''"
      />
    </div>

    <div class="sapling-inbox-workspace__categories" :aria-label="$t('inbox.filterCategory')">
      <SaplingInboxSummaryCard
        v-for="card in categoryCards"
        :key="card.key"
        :card="card"
        :active="category === card.key"
        @select="toggleCategory"
      />
    </div>

    <div
      v-if="view === 'overview'"
      class="sapling-inbox-workspace__periods"
      :aria-label="$t('inbox.filterPeriod')"
    >
      <v-btn
        size="small"
        :variant="period === 'all' ? 'flat' : 'text'"
        :prepend-icon="period === 'all' ? 'mdi-check' : undefined"
        color="primary"
        :aria-pressed="period === 'all'"
        @click="period = 'all'"
      >
        {{ $t('inbox.allTasks') }} · {{ categoryEntries.length }}
      </v-btn>
      <v-btn
        v-for="section in periodCounts"
        :key="section.key"
        size="small"
        :color="section.tone"
        :variant="period === section.key ? 'flat' : 'text'"
        :prepend-icon="period === section.key ? 'mdi-check' : undefined"
        :aria-pressed="period === section.key"
        @click="period = section.key"
      >
        {{ $t(section.titleKey) }} · {{ section.count }}
      </v-btn>
    </div>

    <div class="sapling-inbox-workspace__result-bar">
      <span role="status">{{
        $t('inbox.resultCount', { count: filteredEntries.length, total: source.length })
      }}</span>
      <v-btn
        v-if="hasFilters"
        size="small"
        variant="text"
        prepend-icon="mdi-filter-off-outline"
        @click="resetFilters"
        >{{ $t('inbox.resetFilters') }}</v-btn
      >
      <v-btn
        v-if="showCompleteEvents"
        size="small"
        variant="text"
        color="warning"
        prepend-icon="mdi-calendar-check-outline"
        @click="$emit('complete-events')"
      >
        {{ $t('inbox.completeEventsAction') }}
      </v-btn>
    </div>

    <div
      v-if="filteredEntries.length === 0"
      class="sapling-empty-state-panel sapling-empty-state-panel--large"
    >
      <v-icon
        :icon="source.length ? 'mdi-filter-off-outline' : 'mdi-check-circle-outline'"
        size="40"
      />
      <h3>{{ $t(source.length ? 'inbox.noMatchesTitle' : 'inbox.allCaughtUpTitle') }}</h3>
      <p>{{ $t(source.length ? 'inbox.noMatches' : 'inbox.allCaughtUp') }}</p>
      <v-btn v-if="hasFilters" variant="tonal" @click="resetFilters">{{
        $t('inbox.resetFilters')
      }}</v-btn>
    </div>

    <div v-else class="sapling-inbox-workspace__panes">
      <section class="sapling-inbox-workspace__list-pane" :aria-label="$t('inbox.entryList')">
        <div class="sapling-inbox-workspace__list sapling-scrollable">
          <button
            v-for="entry in visibleEntries"
            :key="entry.id"
            type="button"
            class="sapling-inbox-workspace__row"
            :class="{ 'sapling-inbox-workspace__row--selected': selectedEntry?.id === entry.id }"
            :aria-pressed="selectedEntry?.id === entry.id"
            :aria-label="`${$t(entry.kindLabelKey)}: ${entry.title}, ${entry.dateText || $t('inbox.unplanned')}`"
            @click="selectedId = entry.id"
          >
            <v-icon :icon="entry.icon" :color="entry.accentColor || 'primary'" size="20" />
            <span class="sapling-inbox-workspace__row-copy">
              <span class="sapling-inbox-workspace__row-meta">
                <span>{{ $t(entry.kindLabelKey) }}</span>
                <span>{{ entry.dateText || $t('inbox.unplanned') }}</span>
              </span>
              <strong>{{ entry.title }}</strong>
              <span class="sapling-inbox-workspace__excerpt">{{
                entry.description || $t('inbox.noDescription')
              }}</span>
              <span class="sapling-inbox-workspace__row-meta">
                {{
                  [entry.contextLabel, entry.statusLabel, ...entry.supportLabels]
                    .filter(Boolean)
                    .join(' · ')
                }}
              </span>
            </span>
          </button>
        </div>
        <v-pagination
          v-if="pageCount > 1"
          v-model="page"
          :length="pageCount"
          :total-visible="5"
          density="compact"
        />
      </section>

      <section
        v-if="selectedEntry"
        class="sapling-inbox-workspace__detail"
        :aria-label="$t('inbox.entryDetails')"
      >
        <div class="sapling-inbox-workspace__detail-content sapling-scrollable">
          <div class="sapling-inbox-workspace__detail-header">
            <span class="sapling-row-md"
              ><v-icon :icon="selectedEntry.icon" color="primary" />{{
                $t(selectedEntry.kindLabelKey)
              }}</span
            >
            <span>{{ selectedEntry.dateText || $t('inbox.unplanned') }}</span>
          </div>
          <h3>{{ selectedEntry.title }}</h3>
          <div class="sapling-chip-row">
            <v-chip
              v-if="selectedEntry.contextLabel"
              size="small"
              :color="selectedEntry.contextColor || 'primary'"
              >{{ selectedEntry.contextLabel }}</v-chip
            >
            <v-chip
              v-if="selectedEntry.statusLabel"
              size="small"
              :color="selectedEntry.statusColor || 'primary'"
              >{{ selectedEntry.statusLabel }}</v-chip
            >
            <v-chip
              v-for="label in selectedEntry.supportLabels"
              :key="label"
              size="small"
              variant="outlined"
              >{{ label }}</v-chip
            >
          </div>
          <SaplingMarkdownContent
            class="sapling-inbox-workspace__description"
            :source="
              selectedEntry.descriptionMarkdown ||
              selectedEntry.description ||
              $t('inbox.noDescription')
            "
          />
        </div>
        <v-alert
          v-if="dismissError"
          type="error"
          variant="tonal"
          :text="$t('inbox.markReadFailed')"
        />
        <div class="sapling-inbox-workspace__detail-actions">
          <v-btn
            color="primary"
            variant="flat"
            append-icon="mdi-arrow-top-right"
            @click="$emit('open', selectedEntry)"
            >{{ $t('inbox.openEntry') }}</v-btn
          >
          <v-btn
            v-if="
              selectedEntry.kind === 'notification' &&
              selectedEntry.sourceEntity &&
              selectedEntry.referenceHandle
            "
            variant="text"
            prepend-icon="mdi-history"
            @click="$emit('change-log', selectedEntry)"
            >{{ $t('global.changeLog') }}</v-btn
          >
          <v-btn
            v-if="selectedEntry.dismissible"
            variant="outlined"
            color="primary"
            prepend-icon="mdi-check"
            :loading="dismissingId === selectedEntry.id"
            :disabled="dismissingId !== null"
            @click="markRead(selectedEntry)"
            >{{ $t('inbox.markRead') }}</v-btn
          >
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import SaplingInboxSummaryCard from './SaplingInboxSummaryCard.vue'
import SaplingMarkdownContent from '@/components/common/SaplingMarkdownContent.vue'
import { useSaplingInboxWorkspace } from '@/composables/account/useSaplingInboxWorkspace'
import type {
  InboxEntry,
  InboxSection,
  InboxSummaryCard,
} from '@/composables/account/saplingInbox.utils'

const props = defineProps<{
  sections: InboxSection[]
  notifications: InboxEntry[]
  cards: InboxSummaryCard[]
  overdueEventCount: number
  dismiss: (entry: InboxEntry) => Promise<void>
}>()
defineEmits<{
  open: [entry: InboxEntry]
  'change-log': [entry: InboxEntry]
  'complete-events': []
}>()
const {
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
} = useSaplingInboxWorkspace(
  toRef(props, 'sections'),
  toRef(props, 'notifications'),
  toRef(props, 'cards'),
)
const showCompleteEvents = computed(
  () =>
    view.value === 'overview' &&
    period.value === 'overdue' &&
    (!category.value || category.value === 'event') &&
    !(search.value ?? '').trim() &&
    props.overdueEventCount > 0,
)
const dismissingId = ref<string | null>(null)
const dismissError = ref(false)
async function markRead(entry: InboxEntry) {
  if (dismissingId.value) return
  dismissingId.value = entry.id
  dismissError.value = false
  try {
    await props.dismiss(entry)
  } catch {
    dismissError.value = true
  } finally {
    dismissingId.value = null
  }
}
</script>
