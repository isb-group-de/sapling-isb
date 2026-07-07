<template>
  <v-dialog v-if="dialog" v-model="dialog" persistent class="sapling-dialog-large">
    <SaplingDialogCard class="sapling-inbox-dialog" :tilt="false" :close="closeDialog">
      <SaplingDialogShell
        fill-shell
        body-class="sapling-dialog-fill-body sapling-dialog-transparent-loaders sapling-inbox-dialog__body sapling-scrollable"
        :show-divider="false"
      >
        <template #hero>
          <SaplingDialogHero
            v-if="isLoading"
            class="sapling-inbox-dialog__hero"
            loading
            :loading-stats-count="1"
            :stats-columns="1"
            stats-layout="compact"
          />
          <SaplingDialogHero
            v-else
            class="sapling-inbox-dialog__hero"
            :eyebrow="$t('navigation.inbox')"
            :title="$t('inbox.heroTitle')"
            :stats-columns="1"
            stats-layout="compact"
          >
            <template #stats>
              <div class="sapling-inbox-hero-summary">
                <div class="sapling-inbox-hero-summary__total">
                  <span class="sapling-dialog-hero__stat-label">{{ $t('system.total') }}</span>
                  <strong class="sapling-dialog-hero__stat-value">{{ overviewCount }}</strong>
                </div>
                <div class="sapling-inbox-hero-summary__types">
                  <span
                    v-for="stat in heroStats"
                    :key="stat.label"
                    class="sapling-inbox-hero-summary__type"
                    :title="stat.label"
                    :aria-label="`${stat.label}: ${stat.value}`"
                  >
                    <v-icon size="17">{{ stat.icon }}</v-icon>
                    <strong>{{ stat.value }}</strong>
                  </span>
                </div>
              </div>
            </template>
          </SaplingDialogHero>
        </template>

        <template #body>
          <div
            class="sapling-stack-xl sapling-dialog-fill-content sapling-attention-content sapling-inbox-dialog__content"
          >
            <template v-if="isLoading">
              <section
                class="sapling-responsive-grid sapling-attention-summary-grid sapling-inbox-summary-grid"
              >
                <v-skeleton-loader
                  v-for="item in 5"
                  :key="item"
                  class="sapling-attention-loading-summary sapling-inbox-loading-summary"
                  elevation="12"
                  type="article"
                />
              </section>

              <section
                class="sapling-card-board sapling-card-board--collapse-lg sapling-inbox-board"
              >
                <v-skeleton-loader
                  v-for="item in 5"
                  :key="item"
                  class="sapling-attention-loading-section sapling-inbox-loading-section glass-panel"
                  elevation="12"
                  type="article, article"
                />
              </section>
            </template>

            <template v-else>
              <section
                class="sapling-responsive-grid sapling-attention-summary-grid sapling-inbox-summary-grid"
              >
                <SaplingInboxSummaryCard
                  v-for="card in summaryCards"
                  :key="card.key"
                  :card="card"
                />
              </section>

              <section
                class="sapling-attention-view-switch sapling-inbox-view-switch sapling-panel-shell-muted"
              >
                <v-btn-toggle
                  v-model="activeView"
                  class="sapling-toolbar-group sapling-attention-view-switch__toggle sapling-inbox-view-switch__toggle"
                  color="primary"
                  divided
                  mandatory
                >
                  <v-btn
                    value="overview"
                    class="sapling-attention-view-switch__button sapling-inbox-view-switch__button glass-panel"
                  >
                    <span
                      class="sapling-attention-view-switch__label sapling-inbox-view-switch__button-label"
                    >
                      <v-icon icon="mdi-view-dashboard-outline" size="18" />
                      <span>{{ $t('navigation.inbox') }}</span>
                    </span>
                    <span
                      class="sapling-attention-view-switch__count sapling-attention-view-switch__count--idle sapling-inbox-view-switch__count sapling-inbox-view-switch__count--idle"
                    >
                      {{ overviewCount }}
                    </span>
                  </v-btn>
                  <v-btn
                    value="notifications"
                    class="sapling-attention-view-switch__button sapling-inbox-view-switch__button glass-panel"
                  >
                    <span
                      class="sapling-attention-view-switch__label sapling-inbox-view-switch__button-label"
                    >
                      <v-icon icon="mdi-bell-outline" size="18" />
                      <span>{{ $t('navigation.inboxNotification') }}</span>
                    </span>
                    <span
                      :class="[
                        'sapling-attention-view-switch__count',
                        'sapling-inbox-view-switch__count',
                        hasUnreadNotifications
                          ? 'sapling-attention-view-switch__count--alert sapling-inbox-view-switch__count--alert'
                          : 'sapling-attention-view-switch__count--idle sapling-inbox-view-switch__count--idle',
                      ]"
                    >
                      {{ notificationEntries.length }}
                    </span>
                  </v-btn>
                </v-btn-toggle>
              </section>

              <template v-if="activeView === 'overview'">
                <section
                  v-if="!hasOverviewItems"
                  class="sapling-empty-state-panel sapling-empty-state-panel--large glass-panel"
                >
                  <div
                    class="sapling-empty-state-panel__icon sapling-empty-state-panel__icon--success"
                  >
                    <v-icon icon="mdi-check-circle-outline" size="42" />
                  </div>
                  <h3 class="sapling-empty-state-panel__title">
                    {{ $t('inbox.allCaughtUpTitle') }}
                  </h3>
                  <p class="sapling-empty-state-panel__text">{{ $t('inbox.allCaughtUp') }}</p>
                </section>

                <section
                  v-else
                  class="sapling-card-board sapling-card-board--collapse-lg sapling-inbox-board"
                >
                  <SaplingInboxSection
                    v-for="section in sections"
                    :key="section.key"
                    :section="section"
                    @open="openEntry"
                    @dismiss="dismissEntry"
                  />
                </section>
              </template>

              <template v-else>
                <section
                  v-if="!hasNotificationItems"
                  class="sapling-empty-state-panel sapling-empty-state-panel--large glass-panel"
                >
                  <div
                    class="sapling-empty-state-panel__icon sapling-empty-state-panel__icon--success"
                  >
                    <v-icon icon="mdi-check-circle-outline" size="42" />
                  </div>
                  <h3 class="sapling-empty-state-panel__title">
                    {{ $t('inbox.allCaughtUpTitle') }}
                  </h3>
                  <p class="sapling-empty-state-panel__text">{{ $t('inbox.allCaughtUp') }}</p>
                </section>

                <section v-else class="sapling-section-panel glass-panel">
                  <div class="sapling-section-header">
                    <div
                      class="sapling-row-md sapling-attention-panel__title-row sapling-inbox-notification-panel__title-row"
                    >
                      <div
                        class="sapling-icon-tile sapling-icon-tile--sm sapling-icon-tile--info-soft"
                      >
                        <v-icon icon="mdi-bell-outline" size="18" />
                      </div>
                      <h3 class="sapling-section-title">
                        {{ $t('navigation.inboxNotification') }}
                      </h3>
                    </div>
                    <v-chip size="small" variant="tonal" color="info">
                      {{ sortedNotificationEntries.length }}
                    </v-chip>
                  </div>

                  <div class="sapling-section-stack sapling-section-stack--md">
                    <SaplingInboxEntryCard
                      v-for="entry in sortedNotificationEntries"
                      :key="entry.id"
                      :entry="entry"
                      expanded
                      @open="openEntry"
                      @dismiss="dismissEntry"
                    />
                  </div>
                </section>
              </template>
            </template>
          </div>
        </template>

        <template #actions>
          <SaplingActionClose :close="closeDialog" />
        </template>
      </SaplingDialogShell>
    </SaplingDialogCard>
  </v-dialog>
</template>

<script setup lang="ts">
//#region Import
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSaplingInbox, type InboxEntry } from '@/composables/account/useSaplingInbox'
import SaplingActionClose from '@/components/actions/SaplingActionClose.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingDialogHero from '@/components/common/SaplingDialogHero.vue'
import SaplingDialogShell from '@/components/common/SaplingDialogShell.vue'
import SaplingInboxEntryCard from '@/components/account/inbox/SaplingInboxEntryCard.vue'
import SaplingInboxSection from '@/components/account/inbox/SaplingInboxSection.vue'
import SaplingInboxSummaryCard from '@/components/account/inbox/SaplingInboxSummaryCard.vue'
//#endregion

//#region Composable
const emit = defineEmits<{
  (event: 'close'): void
}>()

const { t } = useI18n()
const activeView = ref<'overview' | 'notifications'>('overview')

const {
  isLoading,
  dialog,
  notificationEntries,
  ticketEntries,
  taskEntries,
  salesOpportunityEntries,
  effortEstimateEntries,
  internalCaseEntries,
  summaryCards,
  sections,
  openEntry,
  dismissEntry,
  closeDialog,
} = useSaplingInbox(emit)

const overviewCount = computed(
  () =>
    ticketEntries.value.length +
    taskEntries.value.length +
    salesOpportunityEntries.value.length +
    effortEstimateEntries.value.length +
    internalCaseEntries.value.length,
)
const hasOverviewItems = computed(() => overviewCount.value > 0)
const hasUnreadNotifications = computed(() => notificationEntries.value.length > 0)
const sortedNotificationEntries = computed<InboxEntry[]>(() =>
  [...notificationEntries.value].sort((left, right) => {
    const leftTime = left.dateValue?.getTime() ?? Number.MIN_SAFE_INTEGER
    const rightTime = right.dateValue?.getTime() ?? Number.MIN_SAFE_INTEGER

    if (leftTime !== rightTime) {
      return rightTime - leftTime
    }

    return left.title.localeCompare(right.title)
  }),
)
const hasNotificationItems = computed(() => sortedNotificationEntries.value.length > 0)

const heroStats = computed(() => [
  {
    label: t('navigation.effortEstimate'),
    value: effortEstimateEntries.value.length,
    icon: 'mdi-clipboard-text-clock-outline',
  },
  { label: t('navigation.ticket'), value: ticketEntries.value.length, icon: 'mdi-ticket-outline' },
  { label: t('navigation.event'), value: taskEntries.value.length, icon: 'mdi-calendar-star' },
  {
    label: t('navigation.salesOpportunity'),
    value: salesOpportunityEntries.value.length,
    icon: 'mdi-cash-multiple',
  },
  {
    label: t('navigation.internalCase'),
    value: internalCaseEntries.value.length,
    icon: 'mdi-clipboard-text-outline',
  },
])
//#endregion
</script>

<style scoped>
.sapling-inbox-dialog__hero :deep(.sapling-dialog-hero__stats) {
  grid-template-columns: minmax(0, 1fr);
  min-width: min(420px, 100%);
}

.sapling-inbox-hero-summary {
  display: flex;
  align-items: stretch;
  gap: var(--sapling-gap-sm);
  min-width: 0;
}

.sapling-inbox-hero-summary__total,
.sapling-inbox-hero-summary__type {
  border: 1px solid var(--sapling-surface-border);
  border-radius: var(--sapling-radius-sm);
  background: rgba(var(--v-theme-surface), 0.18);
  box-shadow: var(--sapling-inset-highlight);
}

.sapling-inbox-hero-summary__total {
  display: flex;
  min-width: 92px;
  flex-direction: column;
  justify-content: center;
  gap: var(--sapling-gap-xs);
  padding: var(--sapling-gap-sm) var(--sapling-gap-md);
}

.sapling-inbox-hero-summary__types {
  display: grid;
  grid-template-columns: repeat(5, minmax(42px, 1fr));
  gap: var(--sapling-gap-xs);
  min-width: 0;
}

.sapling-inbox-hero-summary__type {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sapling-gap-xs);
  min-height: var(--sapling-panel-min-height-sm);
  padding: var(--sapling-gap-xs) var(--sapling-gap-sm);
}

.sapling-inbox-hero-summary__type strong {
  line-height: 1;
}

@media (max-width: 640px) {
  .sapling-inbox-dialog__hero :deep(.sapling-dialog-hero__stats) {
    display: none;
  }
}
</style>
