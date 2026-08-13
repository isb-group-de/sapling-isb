<template>
  <aside class="sapling-fill-shell sapling-event-context">
    <SaplingSurface
      data-tutorial="calendar-context-switcher"
      as="section"
      class="sapling-section-panel sapling-panel-shell sapling-event-context__switcher"
    >
      <v-btn-toggle
        v-model="activePanel"
        class="sapling-segmented-toggle sapling-event-context__toggle"
        color="primary"
        density="comfortable"
        divided
        mandatory
        variant="outlined"
      >
        <v-btn value="filter" class="sapling-event-context__toggle-button">
          <v-icon start>mdi-filter-variant</v-icon>
          {{ $t('filter.filter') }}
        </v-btn>

        <v-btn value="agenda" class="sapling-event-context__toggle-button">
          <v-icon start>mdi-calendar-today</v-icon>
          {{ $t('event.today') }}
        </v-btn>
      </v-btn-toggle>

      <div class="sapling-row-xs sapling-row-wrap sapling-event-context__summary">
        <template v-if="activePanel === 'filter'">
          <span
            >{{ selectedPeoples.length + selectedChipFilterCount }}
            {{ $t('global.selected') }}</span
          >
          <span>{{ filterSummaryLabel }}</span>
        </template>

        <template v-else>
          <span>{{ upcomingEvents.length }} {{ $t('navigation.event') }}</span>
          <span>{{ $t('event.today') }}</span>
        </template>
      </div>
    </SaplingSurface>

    <SaplingWorkFilterPanel
      v-if="activePanel === 'filter' && !isMobileFilterLayout"
      data-tutorial="calendar-filter-panel"
      class="sapling-event-context__panel"
      :chip-filters="chipFilters"
      :selected-chip-filters="selectedChipFilters"
      @update:selected-chip-filters="emit('updateSelectedChipFilters', $event)"
      @update:selected-peoples="emit('updateSelectedPeoples', $event)"
    />

    <SaplingEventPeoplePanel
      v-else-if="activePanel === 'filter'"
      class="sapling-event-context__panel"
      :selected-peoples="selectedPeoples"
      :selected-people-preview="selectedPeoplePreview"
      :selected-people-overflow-count="selectedPeopleOverflowCount"
      @open-filter="emit('openFilter')"
    />

    <SaplingEventAgendaPanel
      v-else
      data-tutorial="calendar-agenda"
      class="sapling-event-context__panel"
      :upcoming-events="upcomingEvents"
      @open-event="emit('openEvent', $event)"
    />
  </aside>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { CalendarEvent } from 'vuetify/lib/components/VCalendar/types.mjs'
import { useI18n } from 'vue-i18n'
import SaplingSurface from '@/components/common/SaplingSurface.vue'
import SaplingEventAgendaPanel from '@/components/event/SaplingEventAgendaPanel.vue'
import SaplingEventPeoplePanel from '@/components/event/SaplingEventPeoplePanel.vue'
import SaplingWorkFilterPanel from '@/components/filter/SaplingWorkFilterPanel.vue'
import type {
  SaplingChipFilterGroup,
  SaplingChipFilterSelection,
} from '@/components/filter/saplingWorkFilter.types'
import type {
  EventAgendaItem,
  SelectedPersonPreviewItem,
} from '@/composables/event/useSaplingEventPresentation'

const props = defineProps<{
  isMobileFilterLayout: boolean
  upcomingEvents: EventAgendaItem[]
  chipFilters: SaplingChipFilterGroup[]
  selectedChipFilters: SaplingChipFilterSelection
  selectedChipFilterCount: number
  selectedPeoples: number[]
  selectedPeoplePreview: SelectedPersonPreviewItem[]
  selectedPeopleOverflowCount: number
}>()

type ContextPanelKey = 'filter' | 'agenda'

const emit = defineEmits<{
  (event: 'updateSelectedPeoples', value: string[]): void
  (event: 'updateSelectedChipFilters', value: SaplingChipFilterSelection): void
  (event: 'openFilter'): void
  (event: 'openEvent', value: CalendarEvent): void
}>()

const { t } = useI18n()
const activePanel = ref<ContextPanelKey>('agenda')
const filterSummaryLabel = computed(() =>
  [
    t('navigation.person'),
    t('navigation.company'),
    ...props.chipFilters.map((filter) => filter.label),
  ]
    .filter(Boolean)
    .join(', '),
)

function handleTutorialPanel(event: Event) {
  const panel = (event as CustomEvent<ContextPanelKey>).detail
  if (panel === 'agenda' || panel === 'filter') {
    activePanel.value = panel
  }
}

onMounted(() => window.addEventListener('sapling:calendar-tutorial-panel', handleTutorialPanel))
onBeforeUnmount(() =>
  window.removeEventListener('sapling:calendar-tutorial-panel', handleTutorialPanel),
)
</script>
