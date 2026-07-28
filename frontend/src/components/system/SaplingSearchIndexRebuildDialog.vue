<template>
  <SaplingDialogConfirm
    v-if="hasAccess"
    v-model="isOpen"
    size="medium"
    variant="danger"
    :eyebrow="t('global.searchIndexEyebrow')"
    :title="t('global.searchIndexRebuildTitle')"
    :subtitle="t('global.searchIndexRebuildDescription')"
    :close-disabled="false"
    @escape="closeDialog"
    @enter="startRebuild"
  >
    <template #body>
      <div class="sapling-stack-lg">
        <v-alert
          v-if="status.state === 'failed'"
          type="error"
          variant="tonal"
          :title="t('global.searchIndexRebuildFailed')"
          :text="status.error || t('global.searchIndexUnknownError')"
        />

        <v-alert
          v-else-if="status.state === 'completed'"
          type="success"
          variant="tonal"
          :title="t('global.searchIndexRebuildCompleted')"
          :text="t('global.searchIndexRebuildCompletedDescription')"
        />

        <div v-if="status.state === 'running'" class="sapling-stack-md">
          <div class="sapling-label">
            {{ t('global.searchIndexRebuildRunning') }}
          </div>
          <v-progress-linear
            color="primary"
            rounded
            :indeterminate="status.currentEntityTotal <= 0"
            :model-value="entityProgress"
          />
          <div class="text-body-2 text-medium-emphasis">
            {{
              status.currentEntityHandle
                ? t('global.searchIndexCurrentEntity', {
                    entity: status.currentEntityHandle,
                    processed: status.currentEntityProcessed,
                    total: status.currentEntityTotal,
                  })
                : t('global.searchIndexPreparing')
            }}
          </div>
        </div>

        <div class="sapling-responsive-grid sapling-responsive-grid--md">
          <div class="sapling-soft-panel">
            <div class="text-caption text-medium-emphasis">
              {{ t('global.searchIndexProcessedRecords') }}
            </div>
            <div class="text-h6">{{ status.processedRecords }}</div>
          </div>
          <div class="sapling-soft-panel">
            <div class="text-caption text-medium-emphasis">
              {{ t('global.searchIndexIndexedEntities') }}
            </div>
            <div class="text-h6">{{ status.indexedEntities }}</div>
          </div>
          <div class="sapling-soft-panel">
            <div class="text-caption text-medium-emphasis">
              {{ t('global.searchIndexIndexedItems') }}
            </div>
            <div class="text-h6">{{ status.indexedItems }}</div>
          </div>
          <div class="sapling-soft-panel">
            <div class="text-caption text-medium-emphasis">
              {{ t('global.searchIndexDuration') }}
            </div>
            <div class="text-h6">{{ formattedDuration }}</div>
          </div>
        </div>

        <v-alert type="warning" variant="tonal">
          {{ t('global.searchIndexRebuildWarning') }}
        </v-alert>
      </div>
    </template>

    <template #actions>
      <SaplingActionBar>
        <template #leading>
          <v-btn variant="text" prepend-icon="mdi-close" @click="closeDialog">
            {{ t('global.close') }}
          </v-btn>
        </template>
        <template #trailing>
          <v-btn
            color="error"
            append-icon="mdi-database-sync-outline"
            :loading="status.state === 'running'"
            :disabled="status.state === 'running' || requestPending"
            @click="startRebuild"
          >
            {{ t('global.searchIndexRebuild') }}
          </v-btn>
        </template>
      </SaplingActionBar>
    </template>
  </SaplingDialogConfirm>
</template>

<script lang="ts" setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingActionBar from '@/components/actions/SaplingActionBar.vue'
import SaplingDialogConfirm from '@/components/dialog/SaplingDialogConfirm.vue'
import { useSaplingSearchIndexRebuild } from '@/composables/system/useSaplingSearchIndexRebuild'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import ApiSearchIndexService, {
  type SearchIndexRebuildStatus,
} from '@/services/api.search-index.service'

const EMPTY_STATUS: SearchIndexRebuildStatus = {
  state: 'idle',
  processedRecords: 0,
  indexedEntities: 0,
  indexedItems: 0,
  currentEntityHandle: null,
  currentEntityProcessed: 0,
  currentEntityTotal: 0,
  startedAt: null,
  completedAt: null,
  durationMs: null,
  error: null,
}

const POLL_INTERVAL_MS = 1000
const { t } = useI18n()
useTranslationLoader('global')
const { isOpen, hasAccess, closeSaplingSearchIndexRebuild } = useSaplingSearchIndexRebuild()
const status = ref<SearchIndexRebuildStatus>({ ...EMPTY_STATUS })
const requestPending = ref(false)
let pollTimer: ReturnType<typeof setTimeout> | null = null

const entityProgress = computed(() => {
  if (status.value.currentEntityTotal <= 0) {
    return 0
  }

  return Math.min(
    100,
    Math.round((status.value.currentEntityProcessed / status.value.currentEntityTotal) * 100),
  )
})

const formattedDuration = computed(() => {
  if (status.value.durationMs == null) {
    return '–'
  }

  return `${(status.value.durationMs / 1000).toFixed(1)} s`
})

watch(isOpen, (open) => {
  clearPoll()
  if (open) {
    void refreshStatus()
  }
})

onUnmounted(clearPoll)

async function startRebuild() {
  if (requestPending.value || status.value.state === 'running') {
    return
  }

  requestPending.value = true
  try {
    status.value = await ApiSearchIndexService.startRebuild()
    schedulePoll()
  } finally {
    requestPending.value = false
  }
}

async function refreshStatus() {
  try {
    status.value = await ApiSearchIndexService.getRebuildStatus()
    if (status.value.state === 'running') {
      schedulePoll()
    }
  } catch {
    clearPoll()
  }
}

function schedulePoll() {
  clearPoll()
  if (!isOpen.value || status.value.state !== 'running') {
    return
  }

  pollTimer = setTimeout(() => {
    void refreshStatus()
  }, POLL_INTERVAL_MS)
}

function clearPoll() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

function closeDialog() {
  clearPoll()
  closeSaplingSearchIndexRebuild()
}
</script>
