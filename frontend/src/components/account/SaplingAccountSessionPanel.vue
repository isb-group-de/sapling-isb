<template>
  <section class="sapling-account-dialog__panel-stack">
    <div class="sapling-account-dialog__section-heading">
      <v-icon color="primary">mdi-devices</v-icon>
      <span>{{ $t('account.activeSessions') }}</span>
    </div>
    <div class="sapling-account-dialog__session-actions">
      <v-btn
        color="primary"
        variant="tonal"
        prepend-icon="mdi-refresh"
        :loading="loading"
        @click="$emit('refresh')"
      >
        {{ $t('global.refresh') }}
      </v-btn>
      <v-btn
        color="error"
        variant="tonal"
        prepend-icon="mdi-logout-variant"
        :loading="terminating"
        @click="$emit('terminate')"
      >
        {{ $t('account.terminateOtherSessions') }}
      </v-btn>
    </div>
    <v-list
      v-if="sessions.length > 0"
      density="comfortable"
      class="sapling-account-dialog__session-list"
    >
      <v-list-item v-for="session in sessions" :key="session.id">
        <div class="sapling-account-dialog__session-row">
          <v-icon color="primary">mdi-web</v-icon>
          <div class="sapling-account-dialog__session-main">
            <div class="sapling-account-dialog__session-title">
              <span>{{ session.deviceLabel }}</span>
              <v-chip v-if="session.isCurrent" color="primary" size="small" variant="tonal">
                {{ $t('account.currentSession') }}
              </v-chip>
            </div>
            <div class="sapling-account-dialog__session-meta">
              <span>{{ session.id }}</span>
              <span>{{ $t('account.signedInAt') }}: {{ formatDateTime(session.createdAt) }}</span>
              <span>
                {{ $t('account.lastActivityAt') }}: {{ formatDateTime(session.lastActivityAt) }}
              </span>
              <span>{{ $t('account.expiresAt') }}: {{ formatDateTime(session.expiresAt) }}</span>
            </div>
          </div>
        </div>
      </v-list-item>
    </v-list>
    <div v-else class="sapling-account-dialog__sync-unavailable">
      {{ $t('account.noActiveSessions') }}
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CurrentSessionDto } from '@/services/api.current.service'

defineProps<{
  sessions: CurrentSessionDto[]
  loading: boolean
  terminating: boolean
  formatDateTime: (value?: string | Date | null) => string
}>()

defineEmits<{ refresh: []; terminate: [] }>()
</script>
