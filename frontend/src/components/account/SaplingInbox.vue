<template>
  <SaplingDialog
    v-if="dialog"
    v-model="dialog"
    persistent
    size="3xl"
    :height="SAPLING_DIALOG_HEIGHT.xl"
    @keydown.esc.stop.prevent="closeDialog"
  >
    <SaplingDialogCard
      class="sapling-dialog-card--fill sapling-inbox-workspace-dialog"
      data-tutorial="inbox-dialog"
      :tilt="false"
      :close="closeDialog"
    >
      <SaplingDialogShell
        fill-shell
        body-class="sapling-inbox-workspace-dialog__body"
        :show-divider="false"
      >
        <template #hero>
          <SaplingDialogHero v-if="isLoading" class="sapling-inbox-dialog__hero" loading />
          <SaplingDialogHero
            v-else
            class="sapling-inbox-dialog__hero"
            :eyebrow="$t('navigation.inbox')"
            :title="$t('inbox.heroTitle')"
          />
        </template>

        <template #body>
          <v-skeleton-loader v-if="isLoading" type="article, list-item-three-line@5" />
          <v-alert
            v-else-if="streamError"
            type="error"
            variant="tonal"
            :title="$t('navigation.inbox')"
            :text="$t(streamError)"
          />
          <SaplingInboxWorkspace
            v-else
            :sections="sections"
            :notifications="notificationEntries"
            :cards="summaryCards"
            :overdue-event-count="overdueEventCount"
            :dismiss="dismissEntry"
            @open="openEntry"
            @change-log="openEntryChangeLog"
            @complete-events="openCompleteEventsDialog"
          />
        </template>

        <template #actions>
          <SaplingActionClose :close="closeDialog" />
        </template>
      </SaplingDialogShell>
    </SaplingDialogCard>
  </SaplingDialog>

  <SaplingDialogConfirm
    v-model="completeEventsDialog"
    :eyebrow="$t('navigation.inbox')"
    :title="$t('inbox.completeEventsTitle')"
    :subtitle="$t('inbox.completeEventsSubtitle')"
    :close-disabled="isCompletingEvents"
    @escape="closeCompleteEventsDialog"
    @enter="completeOverdueEvents"
  >
    <template #body>
      <div class="sapling-stack-lg">
        <SaplingFieldDateType
          v-model="completeEventsCutoffDate"
          :label="$t('inbox.completeEventsCutoffLabel')"
          :disabled="isCompletingEvents"
          :rules="[validateCompleteEventsCutoff]"
        />
        <v-alert
          type="warning"
          variant="tonal"
          icon="mdi-calendar-check-outline"
          :text="$t('inbox.completeEventsSeriesWarning')"
        />
        <v-alert
          type="info"
          variant="tonal"
          icon="mdi-information-outline"
          :text="
            completeEventsCandidateCount > 0
              ? $t('inbox.completeEventsCandidateCount', {
                  count: completeEventsCandidateCount,
                })
              : $t('inbox.completeEventsNoCandidates')
          "
        />
      </div>
    </template>
    <template #actions>
      <SaplingActionBar>
        <template #leading>
          <v-btn
            variant="text"
            prepend-icon="mdi-close"
            :disabled="isCompletingEvents"
            @click="closeCompleteEventsDialog"
          >
            {{ $t('global.cancel') }}
          </v-btn>
        </template>
        <template #trailing>
          <v-btn
            color="warning"
            append-icon="mdi-calendar-check-outline"
            :disabled="completeEventsCandidateCount === 0 || isCompletingEvents"
            :loading="isCompletingEvents"
            @click="completeOverdueEvents"
          >
            {{ $t('inbox.completeEventsConfirm') }}
          </v-btn>
        </template>
      </SaplingActionBar>
    </template>
  </SaplingDialogConfirm>
</template>

<script setup lang="ts">
//#region Import
import { useSaplingInbox } from '@/composables/account/useSaplingInbox'
import SaplingActionClose from '@/components/actions/SaplingActionClose.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import SaplingDialogHero from '@/components/common/SaplingDialogHero.vue'
import SaplingDialogShell from '@/components/common/SaplingDialogShell.vue'
import SaplingDialogConfirm from '@/components/dialog/SaplingDialogConfirm.vue'
import SaplingFieldDateType from '@/components/dialog/fields/SaplingFieldDateType.vue'
import SaplingActionBar from '@/components/actions/SaplingActionBar.vue'
import SaplingInboxWorkspace from '@/components/account/inbox/SaplingInboxWorkspace.vue'
import { SAPLING_DIALOG_HEIGHT } from '@/constants/dialog.constants'
//#endregion

//#region Composable
const emit = defineEmits<{
  (event: 'close'): void
}>()

const {
  isLoading,
  streamError,
  dialog,
  notificationEntries,
  summaryCards,
  sections,
  openEntry,
  openEntryChangeLog,
  dismissEntry,
  closeDialog,
  overdueEventCount,
  completeEventsDialog,
  completeEventsCutoffDate,
  completeEventsCandidateCount,
  isCompletingEvents,
  openCompleteEventsDialog,
  closeCompleteEventsDialog,
  validateCompleteEventsCutoff,
  completeOverdueEvents,
} = useSaplingInbox(emit)
//#endregion
</script>
