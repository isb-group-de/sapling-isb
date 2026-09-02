<template>
  <section class="sapling-section-panel sapling-panel-shell customer360__panel">
    <div class="customer360__panel-title">
      <h2>{{ t(`customer360.section.${section}`) }}</h2>
      <span v-if="result">{{ result.meta.total }}</span>
    </div>
    <div
      v-if="filters.length || showClosedFilter"
      class="customer360__related-filters"
      :aria-label="t('filter.filter')"
    >
      <div v-for="filter in filters" :key="filter.key" class="customer360__filter-group">
        <small>{{ filter.label }}</small>
        <span class="customer360__filter-options">
          <button
            v-for="option in filter.options"
            :key="String(option.handle)"
            type="button"
            :class="[
              'customer360__filter-chip',
              isSelected(filter.key, option.handle) ? 'customer360__filter-chip--selected' : '',
            ]"
            :disabled="loading"
            :aria-pressed="isSelected(filter.key, option.handle)"
            @click="emit('toggleFilter', { groupKey: filter.key, handle: option.handle })"
          >
            <VIcon v-if="option.color" icon="mdi-circle" :color="option.color" size="10" />
            <i v-else-if="option.icon" :class="['mdi', option.icon]" />
            {{ option.label }}
          </button>
        </span>
      </div>
      <div v-if="showClosedFilter" class="customer360__filter-group">
        <small>{{ t('filter.filter') }}</small>
        <span class="customer360__filter-options">
          <button
            type="button"
            :class="[
              'customer360__filter-chip',
              includeClosed ? 'customer360__filter-chip--selected' : '',
            ]"
            :disabled="loading"
            :aria-pressed="includeClosed"
            @click="emit('toggleClosed')"
          >
            <i class="mdi mdi-archive-outline" />
            {{ closedLabel() }}
          </button>
        </span>
      </div>
    </div>
    <div
      v-if="loading && !result"
      class="sapling-empty-state-panel sapling-empty-state-panel--compact customer360__empty"
    >
      {{ t('global.loading') }}
    </div>
    <div v-else-if="result?.data.length" class="customer360__related">
      <button
        v-for="item in result.data"
        :key="String(item.handle)"
        type="button"
        class="sapling-panel-shell-muted customer360__related-card"
        @click="emit('open', result.entityHandle, item.handle as string | number)"
      >
        <template
          v-for="presentation in [relatedPresentation(section, item)]"
          :key="`${String(item.handle)}:${presentation.title}`"
        >
          <span class="customer360__related-header">
            <span class="customer360__related-title">
              <small v-if="presentation.eyebrow" class="sapling-label">{{
                presentation.eyebrow
              }}</small>
              <strong>{{ presentation.title }}</strong>
            </span>
            <span v-if="presentation.badges.length" class="customer360__related-badges">
              <span
                v-for="badge in presentation.badges"
                :key="`${badge.tone}:${badge.text}`"
                :class="['customer360__status-badge', `customer360__status-badge--${badge.tone}`]"
              >
                {{ badge.text }}
              </span>
            </span>
          </span>
          <span v-if="presentation.description" class="customer360__related-description">
            {{ presentation.description }}
          </span>
          <span v-if="presentation.details.length" class="customer360__related-details">
            <span
              v-for="detail in presentation.details"
              :key="`${detail.label}:${detail.value}`"
              class="customer360__related-detail"
            >
              <small
                ><i v-if="detail.icon" :class="['mdi', detail.icon]" />{{ detail.label }}</small
              >
              <strong>{{ detail.value }}</strong>
            </span>
          </span>
          <span v-if="presentation.items.length" class="customer360__related-items">
            <span v-for="value in presentation.items" :key="value">{{ value }}</span>
          </span>
        </template>
      </button>
    </div>
    <div
      v-else
      class="sapling-empty-state-panel sapling-empty-state-panel--compact customer360__empty"
    >
      {{ t('customer360.noEntries') }}
    </div>
    <button
      v-if="result && result.meta.page < result.meta.totalPages"
      class="customer360__load-more"
      @click="emit('loadMore')"
    >
      {{ t('customer360.loadMore') }}
    </button>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type {
  SaplingChipFilterGroup,
  SaplingChipFilterSelection,
  SaplingFilterHandle,
} from '@/components/filter/saplingWorkFilter.types'
import type {
  Customer360RelatedResult,
  Customer360Section,
} from '@/services/api.customer360.service'
import { useCustomer360RelatedPresentation } from './customer360RelatedPresentation'

const props = withDefaults(
  defineProps<{
    section: Customer360Section
    recordHandle: string
    result?: Customer360RelatedResult
    loading?: boolean
    filters?: SaplingChipFilterGroup[]
    selectedFilters?: SaplingChipFilterSelection
    showClosedFilter?: boolean
    includeClosed?: boolean
  }>(),
  {
    result: undefined,
    loading: false,
    filters: () => [],
    selectedFilters: () => ({}),
    showClosedFilter: false,
    includeClosed: false,
  },
)
const emit = defineEmits<{
  (event: 'loadMore'): void
  (event: 'open', entityHandle: string, recordHandle: string | number): void
  (event: 'toggleFilter', value: { groupKey: string; handle: SaplingFilterHandle }): void
  (event: 'toggleClosed'): void
}>()
const { t } = useI18n()
const { relatedPresentation, closedLabel } = useCustomer360RelatedPresentation(
  () => props.recordHandle,
)

function isSelected(groupKey: string, handle: SaplingFilterHandle): boolean {
  return props.selectedFilters[groupKey]?.includes(handle) === true
}
</script>
