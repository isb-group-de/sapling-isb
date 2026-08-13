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

const props = defineProps<{ filterPanelVisible: boolean }>()
const emit = defineEmits<{ showFilterPanel: [] }>()
const { t } = useI18n()
const { isLoading } = useTranslationLoader('tutorial')
const tutorial = useSaplingTutorial({ id: 'partner-workspace', version: 1 })
const tutorialActive = tutorial.isActive
let isMounted = false

const steps = computed<SaplingTutorialStep[]>(() => [
  step('Workspace', 'partner-workspace', 'mdi-view-dashboard-variant-outline'),
  step('Table', 'partner-table', 'mdi-table'),
  step('FilterSummary', 'work-filter-summary', 'mdi-account-filter-outline'),
  step('PeopleCompanies', 'work-filter-people-companies', 'mdi-account-group-outline'),
  step('Attributes', 'work-filter-attributes', 'mdi-filter-cog-outline', true),
])

function step(key: string, target: string, icon: string, optional = false): SaplingTutorialStep {
  return {
    id: key.charAt(0).toLowerCase() + key.slice(1),
    target: `[data-tutorial="${target}"]`,
    title: t(`tutorial.partner${key}Title`),
    description: t(`tutorial.partner${key}Description`),
    icon,
    optional,
  }
}

function handleStep(step: SaplingTutorialStep) {
  if (step.id !== 'workspace' && step.id !== 'table' && !props.filterPanelVisible) {
    emit('showFilterPanel')
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
  if ((event as CustomEvent<SaplingFeatureTutorial>).detail === 'partner') {
    consumePendingSaplingFeatureTutorial('partner')
    startForcedTutorial()
  }
}

onMounted(() => {
  isMounted = true
  window.addEventListener(SAPLING_START_FEATURE_TUTORIAL_EVENT, handleFeatureTutorial)
  if (consumePendingSaplingFeatureTutorial('partner')) {
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
