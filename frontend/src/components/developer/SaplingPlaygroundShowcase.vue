<template>
  <v-row>
    <v-col cols="12">
      <v-card
        elevation="1"
        class="glass-panel sapling-showcase__hero-card sapling-playground__hero-card"
      >
        <v-card-text class="sapling-showcase__hero-content sapling-playground__hero-content">
          <div class="sapling-showcase__hero-copy sapling-playground__hero-copy">
            <span class="sapling-showcase__eyebrow sapling-playground__eyebrow">
              {{ t('playground.eyebrow') }}
            </span>
            <h1 class="sapling-showcase__hero-title sapling-playground__hero-title">
              {{ t('playground.title') }}
            </h1>
            <p class="sapling-showcase__hero-description sapling-playground__hero-description">
              {{ t('playground.subtitle') }}
            </p>

            <div class="sapling-showcase__hero-actions sapling-playground__hero-actions">
              <v-btn
                color="primary"
                prepend-icon="mdi-form-select"
                :disabled="!canOpenEditDialog"
                @click="emit('open-edit')"
              >
                {{ t('playground.openEditDialog') }}
              </v-btn>
              <v-btn
                color="primary"
                variant="tonal"
                prepend-icon="mdi-email-fast-outline"
                @click="emit('open-mail')"
              >
                {{ t('playground.startMailDialog') }}
              </v-btn>
            </div>
          </div>

          <div class="sapling-showcase__metric-grid sapling-playground__metric-grid">
            <div
              v-for="metric in metrics"
              :key="metric.label"
              class="sapling-showcase__metric sapling-playground__metric glass-panel"
            >
              <span class="sapling-showcase__metric-label sapling-playground__metric-label">
                {{ metric.label }}
              </span>
              <strong class="sapling-showcase__metric-value sapling-playground__metric-value">
                {{ metric.value }}
              </strong>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>

  <v-row>
    <v-col cols="12" xl="8">
      <v-card
        elevation="1"
        class="mb-6 glass-panel sapling-showcase__section-card sapling-playground__showcase-card"
        v-tilt="TILT_SOFT_OPTIONS"
      >
        <v-card-text class="sapling-showcase__section-body sapling-playground__showcase-body">
          <div class="sapling-showcase__section-header sapling-playground__showcase-header">
            <div>
              <span class="sapling-showcase__eyebrow sapling-playground__eyebrow">
                {{ t('playground.actionsEyebrow') }}
              </span>
              <h2 class="sapling-showcase__section-title sapling-playground__showcase-title">
                {{ t('playground.actionGalleryTitle') }}
              </h2>
            </div>
            <p
              class="sapling-showcase__section-description sapling-playground__showcase-description"
            >
              {{ t('playground.actionGalleryDescription') }}
            </p>
          </div>

          <v-row>
            <v-col v-for="actionCard in actionCards" :key="actionCard.key" cols="12" md="6">
              <div class="sapling-showcase__demo-frame sapling-playground__demo-frame glass-panel">
                <div class="sapling-showcase__demo-copy sapling-playground__demo-copy">
                  <h3 class="sapling-showcase__demo-title sapling-playground__demo-title">
                    {{ actionCard.title }}
                  </h3>
                  <p
                    class="sapling-showcase__demo-description sapling-playground__demo-description"
                  >
                    {{ actionCard.description }}
                  </p>
                </div>
                <div
                  class="sapling-showcase__demo-surface sapling-playground__demo-surface glass-panel"
                >
                  <component
                    :is="actionCard.component"
                    v-bind="actionCard.props"
                    v-on="actionCard.listeners ?? {}"
                  />
                </div>
              </div>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </v-col>

    <v-col cols="12" xl="4">
      <v-card
        elevation="1"
        class="mb-6 glass-panel sapling-showcase__section-card sapling-playground__showcase-card"
        v-tilt="TILT_SOFT_OPTIONS"
      >
        <v-card-text class="sapling-showcase__section-body sapling-playground__showcase-body">
          <div
            class="sapling-showcase__section-header sapling-showcase__section-header--stacked sapling-playground__showcase-header sapling-playground__showcase-header--stacked"
          >
            <div>
              <span class="sapling-showcase__eyebrow sapling-playground__eyebrow">
                {{ t('playground.dialogsEyebrow') }}
              </span>
              <h2 class="sapling-showcase__section-title sapling-playground__showcase-title">
                {{ t('playground.launchpadTitle') }}
              </h2>
            </div>
            <p
              class="sapling-showcase__section-description sapling-playground__showcase-description"
            >
              {{ t('playground.launchpadDescription') }}
            </p>
          </div>

          <div class="sapling-showcase__launchpad-grid sapling-playground__launchpad-grid">
            <v-btn
              v-for="launcher in dialogLaunchers"
              :key="launcher.key"
              class="sapling-showcase__launchpad-button sapling-playground__launchpad-button"
              :color="launcher.color"
              :prepend-icon="launcher.icon"
              :variant="launcher.disabled ? 'outlined' : 'flat'"
              :disabled="launcher.disabled"
              @click="launcher.open"
            >
              {{ launcher.title }}
            </v-btn>
          </div>

          <div class="sapling-showcase__launchpad-notes sapling-playground__launchpad-notes">
            <div
              v-for="launcher in dialogLaunchers"
              :key="`${launcher.key}-note`"
              class="sapling-showcase__launchpad-note sapling-playground__launchpad-note glass-panel"
            >
              <strong>{{ launcher.title }}</strong>
              <span>{{ launcher.description }}</span>
            </div>
          </div>

          <v-alert class="mt-4" type="info" variant="tonal">
            {{ t('playground.contextInfo', { entity: entityHandle, count: templateCount }) }}
          </v-alert>

          <div class="d-flex flex-wrap ga-3 mt-4">
            <v-btn
              v-for="message in messageButtons"
              :key="message.type"
              :color="message.type"
              :prepend-icon="message.icon"
              @click="emit('message', message.type)"
            >
              {{ t(message.label) }}
            </v-btn>
          </div>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { TILT_SOFT_OPTIONS } from '@/constants/tilt.constants'
import type {
  PlaygroundActionCard,
  PlaygroundDialogLauncher,
  PlaygroundMessageType,
  PlaygroundMetric,
} from './playground.types'

defineProps<{
  actionCards: PlaygroundActionCard[]
  dialogLaunchers: PlaygroundDialogLauncher[]
  metrics: PlaygroundMetric[]
  entityHandle: string
  templateCount: number
  canOpenEditDialog: boolean
}>()

const emit = defineEmits<{
  'open-edit': []
  'open-mail': []
  message: [type: PlaygroundMessageType]
}>()

const { t } = useI18n()
const messageButtons: Array<{ type: PlaygroundMessageType; icon: string; label: string }> = [
  { type: 'error', icon: 'mdi-alert-circle-outline', label: 'playground.messageError' },
  { type: 'warning', icon: 'mdi-alert-outline', label: 'playground.messageWarning' },
  { type: 'success', icon: 'mdi-check-circle-outline', label: 'playground.messageSuccess' },
  { type: 'info', icon: 'mdi-information-outline', label: 'playground.messageInfo' },
]
</script>
