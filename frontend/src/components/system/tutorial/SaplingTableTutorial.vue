<template>
  <SaplingTutorialOverlay
    v-model="tutorialActive"
    :steps="steps"
    @step-change="handleStep"
    @finish="finishTutorial"
    @dismiss="dismissTutorial"
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

const props = defineProps<{ createDialogOpen: boolean }>()
const emit = defineEmits<{ openCreate: []; closeCreate: [] }>()
const { t } = useI18n()
const { isLoading } = useTranslationLoader('tutorial')
const tutorial = useSaplingTutorial({ id: 'generic-table', version: 1 })
const tutorialActive = tutorial.isActive
let isMounted = false

const steps = computed<SaplingTutorialStep[]>(() => [
  step('overview', 'table-root', 'mdi-table-large'),
  step('selection', 'table-selection-actions', 'mdi-checkbox-multiple-marked-outline'),
  step('search', 'table-search', 'mdi-text-search'),
  step('toolbar', 'table-toolbar-actions', 'mdi-tools'),
  step('refresh', 'table-refresh', 'mdi-refresh'),
  step('worklists', 'table-worklists', 'mdi-bookmark-multiple-outline', true),
  step('views', 'table-views', 'mdi-view-column-outline', true),
  step('downloads', 'table-downloads', 'mdi-download-multiple', true),
  {
    ...step('add', 'table-add', 'mdi-plus-circle-outline', true),
    allowInteraction: true,
    advanceOnTargetClick: true,
  },
  step('dialog', 'table-record-dialog', 'mdi-card-account-details-outline', true),
  step('dialogFields', 'table-record-dialog-fields', 'mdi-form-select', true),
  step('dialogActions', 'table-record-dialog-actions', 'mdi-content-save-check-outline', true),
  step('filters', 'table-filter-row', 'mdi-filter-multiple-outline'),
  step('contacts', 'table-contact-cell', 'mdi-card-account-phone-outline', true),
  step('references', 'table-reference-cell', 'mdi-link-variant', true),
  {
    ...step('rowActions', 'table-row-actions', 'mdi-dots-vertical-circle-outline', true),
    allowInteraction: true,
    advanceOnTargetClick: true,
  },
  step('rowMenu', 'table-row-menu', 'mdi-menu-open', true),
  {
    id: 'pagination',
    target: '[data-tutorial="table-data"] .v-data-table-footer',
    title: t('tutorial.tablePaginationTitle'),
    description: t('tutorial.tablePaginationDescription'),
    icon: 'mdi-page-next-outline',
  },
])

function step(id: string, target: string, icon: string, optional = false): SaplingTutorialStep {
  const key = id.charAt(0).toUpperCase() + id.slice(1)
  return {
    id,
    target: `[data-tutorial="${target}"]`,
    title: t(`tutorial.table${key}Title`),
    description: t(`tutorial.table${key}Description`),
    icon,
    optional,
  }
}

function handleStep(currentStep: SaplingTutorialStep) {
  const dialogStep = ['dialog', 'dialogFields', 'dialogActions'].includes(currentStep.id)
  if (dialogStep && !props.createDialogOpen) {
    emit('openCreate')
  } else if (!dialogStep && props.createDialogOpen) {
    emit('closeCreate')
  }
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

function startForcedTutorial() {
  tutorial.stop()
  void nextTick(() => tutorial.start({ force: true }))
}

function handleFeatureTutorial(event: Event) {
  if ((event as CustomEvent<SaplingFeatureTutorial>).detail === 'table') {
    consumePendingSaplingFeatureTutorial('table')
    startForcedTutorial()
  }
}

function finishTutorial() {
  tutorial.finish()
  emit('closeCreate')
}

function dismissTutorial() {
  tutorial.dismiss()
  emit('closeCreate')
}

onMounted(() => {
  isMounted = true
  window.addEventListener(SAPLING_START_FEATURE_TUTORIAL_EVENT, handleFeatureTutorial)
  if (consumePendingSaplingFeatureTutorial('table')) {
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
