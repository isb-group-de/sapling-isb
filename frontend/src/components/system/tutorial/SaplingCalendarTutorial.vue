<template>
  <SaplingTutorialOverlay
    v-model="tutorialActive"
    :steps="steps"
    @step-change="handleStep"
    @finish="tutorial.finish"
    @dismiss="tutorial.dismiss"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingTutorialOverlay from '@/components/system/tutorial/SaplingTutorialOverlay.vue'
import type { SaplingTutorialStep } from '@/components/system/tutorial/saplingTutorial.types'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import { useSaplingTutorial } from '@/composables/system/useSaplingTutorial'
import {
  consumePendingSaplingFeatureTutorial,
  SAPLING_START_FEATURE_TUTORIAL_EVENT,
  type SaplingFeatureTutorial,
} from '@/services/feature-tutorial.service'

const { t } = useI18n()
const { isLoading } = useTranslationLoader('tutorial')
const tutorial = useSaplingTutorial({ id: 'calendar-workspace', version: 1 })
const tutorialActive = tutorial.isActive
let isMounted = false

const steps = computed<SaplingTutorialStep[]>(() => [
  step('Overview', 'calendar-page', 'mdi-calendar-month-outline'),
  step('Period', 'calendar-period', 'mdi-calendar-range-outline'),
  step('Navigation', 'calendar-navigation', 'mdi-calendar-arrow-left'),
  step('Display', 'calendar-display-options', 'mdi-view-split-vertical'),
  step('ViewTypes', 'calendar-view-types', 'mdi-calendar-week', true),
  step('Grid', 'calendar-grid', 'mdi-calendar-blank-multiple'),
  step('Events', 'calendar-events', 'mdi-calendar-edit'),
  step('Context', 'calendar-context-switcher', 'mdi-page-layout-sidebar-right'),
  step('Agenda', 'calendar-agenda', 'mdi-format-list-bulleted', true),
  step('Filters', 'calendar-context', 'mdi-filter-multiple-outline'),
])

function step(key: string, target: string, icon: string, optional = false): SaplingTutorialStep {
  return {
    id: key.charAt(0).toLowerCase() + key.slice(1),
    target: `[data-tutorial="${target}"]`,
    title: t(`tutorial.calendar${key}Title`),
    description: t(`tutorial.calendar${key}Description`),
    icon,
    optional,
  }
}

function startForcedTutorial() {
  tutorial.stop()
  void nextTick(() => tutorial.start({ force: true }))
}

function startAutomaticTutorial() {
  if (isMounted && !isLoading.value) {
    tutorial.start()
  }
}

watch(isLoading, (loading) => {
  if (!loading) {
    window.requestAnimationFrame(startAutomaticTutorial)
  }
})

function handleFeatureTutorial(event: Event) {
  if ((event as CustomEvent<SaplingFeatureTutorial>).detail === 'calendar') {
    consumePendingSaplingFeatureTutorial('calendar')
    startForcedTutorial()
  }
}

function handleStep(step: SaplingTutorialStep) {
  const panel = step.id === 'filters' ? 'filter' : 'agenda'
  window.dispatchEvent(new CustomEvent('sapling:calendar-tutorial-panel', { detail: panel }))
}

onMounted(() => {
  isMounted = true
  window.addEventListener(SAPLING_START_FEATURE_TUTORIAL_EVENT, handleFeatureTutorial)
  if (consumePendingSaplingFeatureTutorial('calendar')) {
    startForcedTutorial()
  } else {
    window.requestAnimationFrame(startAutomaticTutorial)
  }
})

onBeforeUnmount(() => {
  isMounted = false
  window.removeEventListener(SAPLING_START_FEATURE_TUTORIAL_EVENT, handleFeatureTutorial)
  tutorial.stop()
})
</script>
