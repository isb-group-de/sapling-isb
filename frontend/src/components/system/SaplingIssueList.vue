<template>
  <v-col cols="12" md="6">
    <section
      class="sapling-stack-xl sapling-work-stream sapling-issue-stream"
      :class="`sapling-issue-stream--${status}`"
    >
      <SaplingSurface
        as="header"
        class="sapling-section-header sapling-work-stream__header sapling-issue-stream__header"
      >
        <div class="sapling-work-stream__header-copy sapling-issue-stream__header-copy">
          <div class="sapling-work-stream__eyebrow sapling-issue-stream__eyebrow">
            <v-icon :icon="streamIcon" size="18" />
            <span>{{ $t(statusLabelKey) }}</span>
          </div>
          <h2 class="sapling-section-title sapling-work-stream__title sapling-issue-stream__title">
            {{ $t(titleKey) }}
          </h2>
        </div>

        <v-chip :color="statusChipColor" size="small" variant="tonal">
          <v-skeleton-loader v-if="isLoading" type="text" width="28" />
          <span v-else>{{ issues.length }}</span>
        </v-chip>
      </SaplingSurface>

      <div
        v-if="isLoading"
        class="sapling-stack-md sapling-work-stream__loading sapling-issue-stream__loading"
      >
        <SaplingSurface
          v-for="item in 4"
          :key="item"
          :as="VSkeletonLoader"
          class="sapling-work-stream__skeleton sapling-issue-stream__skeleton"
          type="list-item"
        />
      </div>

      <SaplingSurface
        v-else-if="!issues.length"
        class="sapling-empty-state-panel sapling-empty-state-panel--large sapling-work-stream__empty sapling-issue-stream__empty"
      >
        <v-icon :icon="streamIcon" size="34" />
        <p>{{ $t(emptyStateKey) }}</p>
      </SaplingSurface>

      <div v-else class="sapling-stack-md sapling-work-stream__list sapling-issue-stream__list">
        <SaplingSurface
          v-for="issue in issues"
          :key="`${cardPrefix}-${issue.id}`"
          as="article"
          class="sapling-work-card sapling-issue-card"
        >
          <button
            type="button"
            class="sapling-work-card__summary sapling-issue-card__summary"
            :aria-expanded="isIssueExpanded(issue.id)"
            :aria-controls="issueDetailsId(issue.id)"
            @click="toggleIssue(issue.id)"
          >
            <v-icon
              :icon="isIssueExpanded(issue.id) ? 'mdi-chevron-up' : 'mdi-chevron-down'"
              size="20"
              class="sapling-work-card__summary-icon"
            />
            <span class="sapling-work-card__summary-copy">
              <span class="sapling-work-card__summary-heading">
                <span class="sapling-work-card__title sapling-issue-card__title">
                  {{ issue.title }}
                </span>
                <span class="sapling-work-card__summary-badges">
                  <v-chip
                    v-if="resolveIssueType(issue)"
                    :color="resolveIssueType(issue) === 'bug' ? 'error' : 'primary'"
                    size="x-small"
                    variant="tonal"
                    class="sapling-work-card__type"
                  >
                    {{
                      $t(resolveIssueType(issue) === 'bug' ? 'issue.typeBug' : 'issue.typeFeature')
                    }}
                  </v-chip>
                  <v-chip
                    :color="statusChipColor"
                    size="x-small"
                    variant="tonal"
                    class="sapling-work-card__status"
                  >
                    {{ $t(statusLabelKey) }}
                  </v-chip>
                </span>
              </span>
              <span class="sapling-work-card__summary-details">
                <span class="sapling-work-card__origin">
                  {{
                    resolveIssueReporter(issue)
                      ? $t('issue.openedByAt', {
                          reporter: resolveIssueReporter(issue),
                          date: formatDateTime(issue.created_at),
                        })
                      : $t('issue.openedAt', { date: formatDateTime(issue.created_at) })
                  }}
                </span>
                <span class="sapling-work-card__duration">
                  <v-icon icon="mdi-clock-outline" size="18" />
                  <span class="sapling-work-card__duration-copy">
                    <span class="sapling-work-card__duration-prefix">
                      {{
                        $t(
                          status === 'open'
                            ? 'issue.openDurationPrefix'
                            : 'issue.closedDurationPrefix',
                        )
                      }}&nbsp;
                    </span>
                    <span
                      v-for="(unit, index) in issueDurationUnits(issue)"
                      :key="unit.name"
                      class="sapling-work-card__duration-unit"
                    >
                      {{ index ? ', ' : '' }}{{ unit.value }}
                      {{
                        $t(`issue.duration${unit.name}${unit.value === 1 ? 'Singular' : 'Plural'}`)
                      }}
                    </span>
                  </span>
                </span>
              </span>
            </span>
          </button>

          <div
            v-if="isIssueExpanded(issue.id)"
            :id="issueDetailsId(issue.id)"
            class="sapling-stack-lg sapling-work-card__content sapling-issue-card__content"
          >
            <section
              class="sapling-stack-md sapling-work-card__description sapling-issue-card__description"
            >
              <div class="sapling-label">{{ $t('issue.description') }}</div>
              <div class="sapling-work-card__markdown sapling-issue-card__markdown">
                <SaplingMarkdownContent :source="issue.body || $t('issue.noDescription')" />
              </div>
            </section>

            <div class="sapling-work-card__meta">
              <v-chip
                color="primary"
                size="small"
                variant="tonal"
                prepend-icon="mdi-calendar-plus-outline"
                class="sapling-work-card__timestamp"
                :title="$t('issue.createdAt')"
              >
                {{ formatDateTime(issue.created_at) }}
              </v-chip>
              <v-chip
                color="info"
                size="small"
                variant="tonal"
                prepend-icon="mdi-update"
                class="sapling-work-card__timestamp"
                :title="$t('issue.updatedAt')"
              >
                {{ formatDateTime(issue.updated_at) }}
              </v-chip>

              <div
                v-if="resolveAdditionalLabels(issue).length"
                class="sapling-chip-row sapling-work-card__labels sapling-issue-card__labels"
              >
                <v-chip
                  v-for="label in resolveAdditionalLabels(issue)"
                  :key="label.name"
                  size="x-small"
                  variant="flat"
                  class="sapling-work-card__label sapling-issue-card__label"
                  v-css-vars="resolveLabelStyle(label.color)"
                >
                  {{ label.name }}
                </v-chip>
              </div>

              <div
                v-if="issue.assignees.length"
                class="sapling-chip-row sapling-work-card__assignee-list sapling-issue-card__assignee-list"
              >
                <a
                  v-for="assignee in issue.assignees"
                  :key="assignee.login"
                  :href="assignee.html_url"
                  rel="noopener"
                  class="sapling-work-card__assignee sapling-issue-card__assignee"
                >
                  <v-avatar size="22">
                    <img :src="assignee.avatar_url" :alt="assignee.login" />
                  </v-avatar>
                  <span>{{ assignee.login }}</span>
                </a>
              </div>

              <v-btn
                :href="issue.html_url"
                rel="noopener"
                icon="mdi-open-in-app"
                variant="text"
                size="x-small"
              />
            </div>

            <section
              v-if="issue.comments.length"
              class="sapling-work-card__comments sapling-issue-card__comments"
            >
              <button
                type="button"
                class="sapling-work-card__comments-toggle"
                :aria-expanded="areCommentsExpanded(issue.id)"
                :aria-controls="issueCommentsId(issue.id)"
                @click="toggleComments(issue.id)"
              >
                <span>
                  <v-icon icon="mdi-comment-text-multiple-outline" size="18" />
                  {{ $t('issue.comments') }}
                  <v-chip size="x-small" variant="tonal">{{ issue.comments.length }}</v-chip>
                </span>
                <v-icon
                  :icon="areCommentsExpanded(issue.id) ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                  size="20"
                />
              </button>

              <div
                v-if="areCommentsExpanded(issue.id)"
                :id="issueCommentsId(issue.id)"
                class="sapling-stack-md sapling-work-card__comment-list"
              >
                <article
                  v-for="comment in issue.comments"
                  :key="comment.id"
                  class="sapling-work-card__comment sapling-issue-card__comment"
                >
                  <header class="sapling-row-between-md sapling-work-card__comment-header">
                    <a
                      v-if="comment.user.html_url"
                      :href="comment.user.html_url"
                      rel="noopener"
                      class="sapling-work-card__comment-author"
                    >
                      <v-avatar size="28">
                        <img
                          v-if="comment.user.avatar_url"
                          :src="comment.user.avatar_url"
                          :alt="comment.user.login"
                        />
                        <v-icon v-else icon="mdi-account-circle-outline" size="22" />
                      </v-avatar>
                      <span>{{ comment.user.login || $t('issue.commentUnknownAuthor') }}</span>
                    </a>
                    <div v-else class="sapling-work-card__comment-author">
                      <v-avatar size="28">
                        <v-icon icon="mdi-account-circle-outline" size="22" />
                      </v-avatar>
                      <span>{{ comment.user.login || $t('issue.commentUnknownAuthor') }}</span>
                    </div>

                    <div class="sapling-row-xs sapling-work-card__comment-meta">
                      <span>{{ formatDateTime(comment.created_at) }}</span>
                      <v-btn
                        :href="comment.html_url"
                        rel="noopener"
                        icon="mdi-open-in-app"
                        variant="text"
                        size="x-small"
                      />
                    </div>
                  </header>

                  <div class="sapling-work-card__markdown sapling-work-card__comment-markdown">
                    <SaplingMarkdownContent :source="comment.body || $t('issue.noCommentBody')" />
                  </div>
                </article>
              </div>
            </section>
          </div>
        </SaplingSurface>
      </div>
    </section>
  </v-col>
</template>

<script lang="ts" setup>
// #region Imports
import { VSkeletonLoader } from 'vuetify/components'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { SaplingIssue, SaplingIssueStatus } from '@/composables/system/useSaplingIssue'
import SaplingMarkdownContent from '@/components/common/SaplingMarkdownContent.vue'
import SaplingSurface from '@/components/common/SaplingSurface.vue'
// #endregion

// #region Props
interface SaplingIssueListProps {
  issues: SaplingIssue[]
  isLoading: boolean
  titleKey: string
  status: SaplingIssueStatus
  cardPrefix: string
}

const props = defineProps<SaplingIssueListProps>()

const expandedIssues = ref(new Set<number>())
const expandedComments = ref(new Set<number>())
const currentTime = ref(Date.now())
let durationTimer: ReturnType<typeof setInterval> | undefined
const statusLabelKey = computed(() => (props.status === 'open' ? 'issue.open' : 'issue.closed'))
const emptyStateKey = computed(() =>
  props.status === 'open' ? 'issue.noOpenIssues' : 'issue.noClosedIssues',
)
const streamIcon = computed(() =>
  props.status === 'open' ? 'mdi-progress-wrench' : 'mdi-check-all',
)
const statusChipColor = computed(() => (props.status === 'open' ? 'success' : 'secondary'))

onMounted(() => {
  durationTimer = setInterval(() => {
    currentTime.value = Date.now()
  }, 60_000)
})

onUnmounted(() => {
  if (durationTimer) {
    clearInterval(durationTimer)
  }
})
// #endregion

// #region Methods
function isIssueExpanded(issueId: number) {
  return expandedIssues.value.has(issueId)
}

function areCommentsExpanded(issueId: number) {
  return expandedComments.value.has(issueId)
}

function toggleIssue(issueId: number) {
  const nextExpandedIssues = new Set(expandedIssues.value)

  if (nextExpandedIssues.has(issueId)) {
    nextExpandedIssues.delete(issueId)
    const nextExpandedComments = new Set(expandedComments.value)
    nextExpandedComments.delete(issueId)
    expandedComments.value = nextExpandedComments
  } else {
    nextExpandedIssues.add(issueId)
  }

  expandedIssues.value = nextExpandedIssues
}

function toggleComments(issueId: number) {
  const nextExpandedComments = new Set(expandedComments.value)

  if (nextExpandedComments.has(issueId)) {
    nextExpandedComments.delete(issueId)
  } else {
    nextExpandedComments.add(issueId)
  }

  expandedComments.value = nextExpandedComments
}

function issueDetailsId(issueId: number) {
  return `${props.cardPrefix}-issue-${issueId}-details`
}

function issueCommentsId(issueId: number) {
  return `${props.cardPrefix}-issue-${issueId}-comments`
}

function resolveIssueType(issue: SaplingIssue): 'bug' | 'feature' | null {
  const typeLabel = issue.labels.find((label) => {
    const normalizedName = label.name.trim().toLowerCase()
    return normalizedName === 'bug' || normalizedName === 'feature'
  })

  if (typeLabel) {
    return typeLabel.name.trim().toLowerCase() as 'bug' | 'feature'
  }

  const bodyType = issue.body.match(/(?:\*\*)?Type:(?:\*\*)?\s*(Bug|Feature)/i)?.[1]
  return bodyType ? (bodyType.toLowerCase() as 'bug' | 'feature') : null
}

/**
 * Reads the Sapling reporter from the metadata header added to issue descriptions.
 * Older GitHub issues without that header intentionally return no reporter.
 */
function resolveIssueReporter(issue: SaplingIssue): string | null {
  const reportedBy = issue.body.match(/^\s*(?:\*\*)?Reported by:(?:\*\*)?\s*(.+?)\s*$/im)?.[1]
  const login = issue.body.match(/^\s*(?:\*\*)?Login:(?:\*\*)?\s*`?([^`\r\n]+)`?\s*$/im)?.[1]
  const value = reportedBy || login

  return value ? value.trim().replace(/\\([\\`*_{}[\]()<>#+.!|])/g, '$1') : null
}

/**
 * Returns whole elapsed units between opening and now, or opening and closing.
 */
function issueDurationParts(issue: SaplingIssue) {
  const openedAt = new Date(issue.created_at).getTime()
  const closedAt = issue.closed_at ? new Date(issue.closed_at).getTime() : currentTime.value
  const totalMinutes =
    Number.isFinite(openedAt) && Number.isFinite(closedAt)
      ? Math.max(0, Math.floor((closedAt - openedAt) / 60_000))
      : 0

  return {
    days: Math.floor(totalMinutes / (24 * 60)),
    hours: Math.floor((totalMinutes % (24 * 60)) / 60),
    minutes: totalMinutes % 60,
  }
}

/**
 * Omits zero-value duration units while keeping a meaningful value for sub-minute tickets.
 */
function issueDurationUnits(issue: SaplingIssue) {
  const { days, hours, minutes } = issueDurationParts(issue)
  const units = [
    { name: 'Day', value: days },
    { name: 'Hour', value: hours },
    { name: 'Minute', value: minutes },
  ].filter((unit) => unit.value > 0)

  return units.length ? units : [{ name: 'Minute', value: 0 }]
}

function resolveAdditionalLabels(issue: SaplingIssue) {
  return issue.labels.filter((label) => {
    const normalizedName = label.name.trim().toLowerCase()
    return normalizedName !== 'bug' && normalizedName !== 'feature'
  })
}

/**
 * Formats GitHub timestamps for display in the expanded issue details.
 */
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

/**
 * Builds framework CSS variables for GitHub label chips with readable contrast.
 */
function resolveLabelStyle(value: string) {
  const backgroundColor = `#${value}`
  const red = parseInt(value.slice(0, 2), 16)
  const green = parseInt(value.slice(2, 4), 16)
  const blue = parseInt(value.slice(4, 6), 16)
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000

  return {
    '--sapling-issue-label-background': backgroundColor,
    '--sapling-issue-label-color': luminance > 160 ? '#102a43' : '#f8fafc',
  }
}
// #endregion
</script>
