<template>
  <div class="messageCenter">
    <Teleport to="body">
      <!-- Floating Meldungen -->
      <transition-group
        name="messages-fade"
        tag="div"
        class="messages-float"
        role="status"
        aria-live="polite"
        aria-atomic="false"
      >
        <div
          v-for="message in visibleMessages"
          :key="message.id"
          class="message"
          role="button"
          tabindex="0"
          :aria-label="`${formatMessageLabel(message)} ${$t('global.close')}`"
          :title="$t('global.close')"
          @click="hideMessage(message.id)"
          @keydown.enter.prevent="hideMessage(message.id)"
          @keydown.space.prevent="hideMessage(message.id)"
        >
          <v-alert :type="message.type" density="comfortable" border="start" class="ma-2">
            <template v-if="isTranslationLoading">
              <v-skeleton-loader type="text, text" />
            </template>
            <template v-else>
              <div class="message__content">
                <div class="message__body">
                  <div class="message__title-row">
                    <span>{{ formatMessageLabel(message) }}</span>
                    <v-chip v-if="message.count > 1" size="x-small" variant="tonal">
                      {{ message.count }}x
                    </v-chip>
                  </div>
                  <div v-if="message.description" class="message__description">
                    {{ formatDescription(message) }}
                  </div>
                </div>
                <v-btn
                  v-if="message.type === 'error'"
                  class="message__report-button"
                  color="white"
                  variant="outlined"
                  size="small"
                  prepend-icon="mdi-bug-outline"
                  :loading="isReportingError(message.id)"
                  :disabled="isErrorReported(message.id)"
                  :aria-label="$t('messageCenter.reportError')"
                  @click.stop="reportError(message)"
                  @keydown.stop
                >
                  {{
                    isErrorReported(message.id)
                      ? $t('messageCenter.errorReported')
                      : $t('messageCenter.reportError')
                  }}
                </v-btn>
              </div>
            </template>
          </v-alert>
        </div>
      </transition-group>
    </Teleport>
    <!-- Dialog for all Meldungen -->
    <v-dialog
      v-if="dialog"
      v-model="dialog"
      persistent
      class="sapling-dialog-large"
      @keydown.esc.stop.prevent="closeDialog"
    >
      <template v-slot:activator="{ props }">
        <slot name="activator" v-bind="props" />
      </template>
      <SaplingDialogCard class="sapling-message-center-dialog" :tilt="false" :close="closeDialog">
        <div class="sapling-dialog-shell sapling-fill-shell">
          <template v-if="isTranslationLoading">
            <SaplingDialogHero loading />
            <div class="sapling-message-center-dialog__body">
              <SaplingSurface :as="VSkeletonLoader" type="article, article, article" />
            </div>
            <SaplingActionBarSkeleton />
          </template>
          <template v-else>
            <SaplingDialogHero
              :eyebrow="$t('global.messageCenter')"
              :title="$t('global.messageCenter')"
            />

            <div class="sapling-message-center-dialog__body">
              <SaplingSurface
                as="section"
                v-if="messages.length === 0"
                class="sapling-empty-state-panel sapling-empty-state-panel--large"
              >
                <div class="sapling-empty-state-panel__icon">
                  <v-icon icon="mdi-bell-check-outline" size="40" />
                </div>
                <h3 class="sapling-empty-state-panel__title">
                  {{ translateWithFallback('messageCenter.emptyTitle', 'Keine Meldungen') }}
                </h3>
                <p class="sapling-empty-state-panel__text">
                  {{
                    translateWithFallback(
                      'messageCenter.emptyText',
                      'Sobald Aktionen, Fehler oder Hinweise auftreten, erscheinen sie hier.',
                    )
                  }}
                </p>
              </SaplingSurface>

              <v-list
                v-else
                density="comfortable"
                class="sapling-section-stack sapling-section-stack--md sapling-message-center-list"
              >
                <v-list-item
                  v-for="message in messages"
                  :key="message.id"
                  class="sapling-panel-shell-muted sapling-message-center-entry"
                >
                  <template #prepend>
                    <div class="sapling-icon-tile sapling-icon-tile--sm">
                      <v-icon :color="getMessageColor(message.type)">{{
                        getMessageIcon(message.type)
                      }}</v-icon>
                    </div>
                  </template>
                  <template #title>
                    <span :class="message.type">
                      {{ formatMessageLabel(message) }}
                      <v-chip v-if="message.count > 1" size="x-small" variant="tonal" class="ml-2">
                        {{ message.count }}x
                      </v-chip>
                    </span>
                    <div
                      v-if="message.description"
                      class="sapling-message-center-entry__description"
                    >
                      {{ formatDescription(message) }}
                    </div>
                  </template>
                  <template #subtitle>
                    {{ formatTimestamp(message.timestamp) }}
                  </template>
                  <template #append>
                    <v-btn
                      icon="mdi-close"
                      @click="removeMessage(message.id)"
                      variant="text"
                      size="small"
                      :aria-label="$t('global.close')"
                      :title="$t('global.close')"
                    />
                  </template>
                </v-list-item>
              </v-list>
            </div>

            <SaplingActionMessageCenter
              :close="closeDialog"
              :export-messages="exportMessages"
              :clear-all="clearAll"
              :empty="messages.length === 0"
            />
          </template>
        </div>
      </SaplingDialogCard>
    </v-dialog>
  </div>
</template>

<script lang="ts" setup>
// #region Imports
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { VSkeletonLoader } from 'vuetify/components'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import type { Message } from '@/composables/system/useSaplingMessageCenter'
import ApiGithubService from '@/services/api.github.service'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingDialogHero from '@/components/common/SaplingDialogHero.vue'
import SaplingSurface from '@/components/common/SaplingSurface.vue'
import SaplingActionBarSkeleton from '@/components/actions/SaplingActionBarSkeleton.vue'
import SaplingActionMessageCenter from '@/components/actions/SaplingActionMessageCenter.vue'
import {
  formatMessageDescription,
  formatMessageTitle,
  getMessageEntityLabel,
  MESSAGE_CENTER_TRANSLATION_NAMESPACES,
  type MessageTranslator,
} from '@/utils/messageCenterPresentation'
import {
  createErrorIssuePayload,
  createMessageCenterExportPayload,
} from '@/utils/messageCenterExport'
// #endregion

// #region Composable
const { t, te } = useI18n()
const { isLoading: isTranslationLoading } = useTranslationLoader(
  ...MESSAGE_CENTER_TRANSLATION_NAMESPACES,
)

const {
  dialog,
  messages,
  visibleMessages,
  hideMessage,
  removeMessage,
  clearAll,
  openDialog,
  closeDialog,
  getMessageIcon,
  getMessageColor,
  pushMessage,
} = useSaplingMessageCenter()
const reportingErrorIds = ref<Set<number>>(new Set())
const reportedErrorIds = ref<Set<number>>(new Set())

function formatMessageLabel(message: Message) {
  const entityLabel = getMessageEntityLabel(message.entity, translate, te)
  const messageLabel = formatMessageTitle(message.message, translate, te)

  return entityLabel ? `${entityLabel}: ${messageLabel}` : messageLabel
}

const translate: MessageTranslator = (key, params) => {
  return params ? t(key, params) : t(key)
}

function formatDescription(message: Message) {
  return formatMessageDescription(message, translate, te)
}

function formatErrorIssueTitle(message: Message) {
  const description = formatDescription(message).trim()
  return message.description.trim() && description ? description : formatMessageLabel(message)
}

function translateWithFallback(key: string, fallback: string) {
  return te(key) ? t(key) : fallback
}

function formatTimestamp(timestamp: Date) {
  return timestamp.toLocaleTimeString()
}

function isReportingError(messageId: number) {
  return reportingErrorIds.value.has(messageId)
}

function isErrorReported(messageId: number) {
  return reportedErrorIds.value.has(messageId)
}

async function reportError(message: Message) {
  if (message.type !== 'error' || isReportingError(message.id) || isErrorReported(message.id)) {
    return
  }

  reportingErrorIds.value = new Set([...reportingErrorIds.value, message.id])

  try {
    await ApiGithubService.createIssue(
      createErrorIssuePayload(message, formatErrorIssueTitle(message)),
    )
    reportedErrorIds.value = new Set([...reportedErrorIds.value, message.id])
    pushMessage('success', 'issue.createSuccess', 'issue.createSuccessDescription', 'github')
  } catch {
    // ApiGithubService already publishes the detailed API error in the message center.
  } finally {
    reportingErrorIds.value = new Set(
      [...reportingErrorIds.value].filter((messageId) => messageId !== message.id),
    )
  }
}

function exportMessages() {
  if (messages.value.length === 0) {
    return
  }

  const exportPayload = createMessageCenterExportPayload(messages.value)

  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = createExportFilename()
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function createExportFilename() {
  const now = new Date()
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ]

  return `sapling-log-${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}-${parts[5]}.json`
}

defineExpose({ dialog, openDialog, closeDialog })
// #endregion
</script>
