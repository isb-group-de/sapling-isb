<template>
  <SaplingTutorialOverlay
    v-model="navigationTutorialActive"
    :steps="navigationSteps"
    :done-label="t('tutorial.continueToDashboard')"
    @step-change="handleNavigationStep"
    @finish="finishNavigationTutorial"
    @dismiss="dismissAllTutorials"
  />

  <SaplingTutorialOverlay
    v-model="dashboardTutorialActive"
    :steps="dashboardSteps"
    @step-change="handleDashboardStep"
    @finish="finishDashboardTutorial"
    @dismiss="dismissDashboardTutorial"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import SaplingTutorialOverlay from '@/components/system/tutorial/SaplingTutorialOverlay.vue'
import type { SaplingTutorialStep } from '@/components/system/tutorial/saplingTutorial.types'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import { useSaplingTutorial } from '@/composables/system/useSaplingTutorial'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import { useSaplingHelp } from '@/composables/system/useSaplingHelp'
import { useSaplingAiChat } from '@/composables/system/useSaplingAiChat'
import { closeSaplingCommandPalette } from '@/services/command-palette.service'
import { ensureTutorialWelcomeEvent } from '@/services/tutorial-welcome-event.service'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import {
  SAPLING_START_DASHBOARD_TUTORIAL_EVENT,
  setSaplingDashboardTutorialLayout,
} from '@/services/dashboard-tutorial.service'

const emit = defineEmits<{
  setNavigationOpen: [value: boolean]
  setProfileMenuOpen: [value: boolean]
  closeInbox: []
}>()

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { isLoading: isTutorialTranslationLoading } = useTranslationLoader('tutorial')
const messageCenter = useSaplingMessageCenter()
const { openSaplingHelp, closeSaplingHelp } = useSaplingHelp()
const { openSaplingAiChat, closeSaplingAiChat } = useSaplingAiChat()
const currentPersonStore = useCurrentPersonStore()
const navigationTutorial = useSaplingTutorial({ id: 'dashboard-navigation', version: 1 })
const dashboardTutorial = useSaplingTutorial({ id: 'dashboard-workspace', version: 1 })
const navigationTutorialActive = navigationTutorial.isActive
const dashboardTutorialActive = dashboardTutorial.isActive
const activeGroup = ref<'navigation' | 'dashboard' | null>(null)
const forcedSequence = ref(false)
const welcomeMessageAdded = ref(false)
let autoStartFrame: number | null = null

const navigationSteps = computed<SaplingTutorialStep[]>(() => [
  {
    id: 'navigation-trigger',
    target: '[data-tutorial="header-navigation"]',
    title: t('tutorial.navigationTriggerTitle'),
    description: t('tutorial.navigationTriggerDescription'),
    icon: 'mdi-menu',
    allowInteraction: true,
    advanceOnTargetClick: true,
  },
  {
    id: 'navigation-panel',
    target: '[data-tutorial="main-navigation"]',
    title: t('tutorial.navigationPanelTitle'),
    description: t('tutorial.navigationPanelDescription'),
    icon: 'mdi-compass-outline',
  },
  {
    id: 'navigation-search',
    target: '[data-tutorial="navigation-search"]',
    title: t('tutorial.navigationSearchTitle'),
    description: t('tutorial.navigationSearchDescription'),
    icon: 'mdi-filter-outline',
  },
  {
    id: 'navigation-primary',
    target: '[data-tutorial="navigation-primary"]',
    title: t('tutorial.navigationPrimaryTitle'),
    description: t('tutorial.navigationPrimaryDescription'),
    icon: 'mdi-shape-outline',
    optional: true,
  },
  {
    id: 'navigation-detail',
    target: '[data-tutorial="navigation-detail"]',
    title: t('tutorial.navigationDetailTitle'),
    description: t('tutorial.navigationDetailDescription'),
    icon: 'mdi-format-list-group',
    optional: true,
  },
  {
    id: 'navigation-destinations',
    target: '[data-tutorial="navigation-destinations"]',
    title: t('tutorial.navigationDestinationsTitle'),
    description: t('tutorial.navigationDestinationsDescription'),
    icon: 'mdi-book-open-page-variant-outline',
  },
  {
    id: 'home',
    target: '[data-tutorial="header-home"]',
    title: t('tutorial.homeTitle'),
    description: t('tutorial.homeDescription'),
    icon: 'mdi-home-outline',
  },
  {
    id: 'search',
    target: '[data-tutorial="header-search"]',
    title: t('tutorial.searchTitle'),
    description: t('tutorial.searchDescription'),
    icon: 'mdi-magnify',
    allowInteraction: true,
    advanceOnTargetClick: true,
  },
  {
    id: 'command-palette',
    target: '[data-tutorial="command-palette-search"]',
    title: t('tutorial.commandPaletteOpenTitle'),
    description: t('tutorial.commandPaletteOpenDescription'),
    icon: 'mdi-apple-keyboard-command',
  },
  {
    id: 'command-palette-results',
    target: '[data-tutorial="command-palette-results"]',
    title: t('tutorial.commandPaletteResultsTitle'),
    description: t('tutorial.commandPaletteResultsDescription'),
    icon: 'mdi-text-search',
  },
  {
    id: 'command-palette-shortcuts',
    target: '[data-tutorial="command-palette-shortcuts"]',
    title: t('tutorial.commandPaletteShortcutsTitle'),
    description: t('tutorial.commandPaletteShortcutsDescription'),
    icon: 'mdi-keyboard-outline',
  },
  {
    id: 'help',
    target: '[data-tutorial="header-help"]',
    title: t('tutorial.helpTitle'),
    description: t('tutorial.helpDescription'),
    icon: 'mdi-help-circle-outline',
  },
  {
    id: 'help-open',
    target: '[data-tutorial="help-dialog"]',
    title: t('tutorial.helpOpenTitle'),
    description: t('tutorial.helpOpenDescription'),
    icon: 'mdi-lightbulb-on-outline',
  },
  {
    id: 'inbox-trigger',
    target: '[data-tutorial="header-inbox"]',
    title: t('tutorial.inboxTriggerTitle'),
    description: t('tutorial.inboxTriggerDescription'),
    icon: 'mdi-email-outline',
    allowInteraction: true,
    advanceOnTargetClick: true,
  },
  {
    id: 'inbox-open',
    target: '[data-tutorial="inbox-dialog"]',
    title: t('tutorial.inboxOpenTitle'),
    description: t('tutorial.inboxOpenDescription'),
    icon: 'mdi-inbox-arrow-down-outline',
  },
  {
    id: 'message-center-trigger',
    target: '[data-tutorial="header-message-center"]',
    title: t('tutorial.messageCenterTriggerTitle'),
    description: t('tutorial.messageCenterTriggerDescription'),
    icon: 'mdi-cloud-alert-outline',
    allowInteraction: true,
    advanceOnTargetClick: true,
  },
  {
    id: 'message-center-open',
    target: '[data-tutorial="message-center-dialog"]',
    title: t('tutorial.messageCenterOpenTitle'),
    description: t('tutorial.messageCenterOpenDescription'),
    icon: 'mdi-bell-ring-outline',
  },
  {
    id: 'profile-trigger',
    target: '[data-tutorial="header-profile"]',
    title: t('tutorial.profileTriggerTitle'),
    description: t('tutorial.profileTriggerDescription'),
    icon: 'mdi-account-circle-outline',
    allowInteraction: true,
    advanceOnTargetClick: true,
  },
  {
    id: 'profile-primary',
    target: '[data-tutorial="profile-primary"]',
    title: t('tutorial.profilePrimaryTitle'),
    description: t('tutorial.profilePrimaryDescription'),
    icon: 'mdi-account-cog-outline',
  },
  {
    id: 'profile-appearance',
    target: '[data-tutorial="profile-appearance"]',
    title: t('tutorial.profileAppearanceTitle'),
    description: t('tutorial.profileAppearanceDescription'),
    icon: 'mdi-theme-light-dark',
  },
  {
    id: 'profile-language',
    target: '[data-tutorial="profile-language"]',
    title: t('tutorial.profileLanguageTitle'),
    description: t('tutorial.profileLanguageDescription'),
    icon: 'mdi-translate',
  },
  {
    id: 'songbird-trigger',
    target: '[data-tutorial="songbird"]',
    title: t('tutorial.songbirdTitle'),
    description: t('tutorial.songbirdDescription'),
    icon: 'mdi-bird',
    allowInteraction: true,
    advanceOnTargetClick: true,
    optional: true,
  },
  {
    id: 'songbird-open',
    target: '[data-tutorial="songbird-chat"]',
    title: t('tutorial.songbirdOpenTitle'),
    description: t('tutorial.songbirdOpenDescription'),
    icon: 'mdi-chat-processing-outline',
    optional: true,
  },
])

const dashboardSteps = computed<SaplingTutorialStep[]>(() => [
  {
    id: 'workspace',
    target: '[data-tutorial="dashboard-workspace"]',
    title: t('tutorial.dashboardWorkspaceTitle'),
    description: t('tutorial.dashboardWorkspaceDescription'),
    icon: 'mdi-view-dashboard-outline',
  },
  {
    id: 'actions',
    target: '[data-tutorial="dashboard-actions"]',
    title: t('tutorial.dashboardActionsTitle'),
    description: t('tutorial.dashboardActionsDescription'),
    icon: 'mdi-chart-box-plus-outline',
  },
  {
    id: 'quicklinks',
    target: '[data-tutorial="dashboard-quicklinks"]',
    title: t('tutorial.dashboardQuicklinksTitle'),
    description: t('tutorial.dashboardQuicklinksDescription'),
    icon: 'mdi-bookmark-multiple-outline',
    optional: true,
  },
  {
    id: 'tabs',
    target: '[data-tutorial="dashboard-tabs"]',
    title: t('tutorial.dashboardTabsTitle'),
    description: t('tutorial.dashboardTabsDescription'),
    icon: 'mdi-tab-multiple',
    optional: true,
  },
  {
    id: 'kpis',
    target: '[data-tutorial="dashboard-kpis"]',
    title: t('tutorial.dashboardKpisTitle'),
    description: t('tutorial.dashboardKpisDescription'),
    icon: 'mdi-chart-areaspline',
    optional: true,
  },
  {
    id: 'layout-action',
    target: '[data-tutorial="dashboard-layout-action"]',
    title: t('tutorial.dashboardLayoutActionTitle'),
    description: t('tutorial.dashboardLayoutActionDescription'),
    icon: 'mdi-pencil-outline',
    optional: true,
  },
  {
    id: 'layout-mode',
    target: '[data-tutorial="dashboard-layout-mode"]',
    title: t('tutorial.dashboardLayoutModeTitle'),
    description: t('tutorial.dashboardLayoutModeDescription'),
    icon: 'mdi-drag-variant',
    optional: true,
  },
])

watch(
  [() => route.path, isTutorialTranslationLoading],
  ([path, translationsLoading]) => {
    if (path !== '/') {
      stopActiveTutorials()
      return
    }

    if (!translationsLoading) {
      scheduleAutomaticStart()
    }
  },
  { immediate: true },
)

function scheduleAutomaticStart() {
  if (autoStartFrame !== null || activeGroup.value) {
    return
  }

  autoStartFrame = window.requestAnimationFrame(() => {
    autoStartFrame = null
    startAutomaticSequence()
  })
}

function startAutomaticSequence() {
  if (route.path !== '/' || activeGroup.value) {
    return
  }

  forcedSequence.value = false
  welcomeMessageAdded.value = false
  if (navigationTutorial.start()) {
    activeGroup.value = 'navigation'
  } else if (dashboardTutorial.start()) {
    activeGroup.value = 'dashboard'
  }
}

function handleNavigationStep(step: SaplingTutorialStep) {
  const navigationStep = [
    'navigation-panel',
    'navigation-search',
    'navigation-primary',
    'navigation-detail',
    'navigation-destinations',
  ].includes(step.id)
  emit('setNavigationOpen', navigationStep)

  const profileMenuStep = ['profile-primary', 'profile-appearance', 'profile-language'].includes(
    step.id,
  )
  emit('setProfileMenuOpen', profileMenuStep)

  const commandPaletteStep = [
    'command-palette',
    'command-palette-results',
    'command-palette-shortcuts',
  ].includes(step.id)
  if (!commandPaletteStep) {
    closeSaplingCommandPalette()
  }

  if (step.id === 'help-open') {
    openSaplingHelp()
  } else {
    closeSaplingHelp()
  }

  if (step.id === 'inbox-trigger') {
    void createTutorialWelcomeEvent()
  }

  if (step.id === 'message-center-trigger') {
    emit('closeInbox')
  }

  if (step.id === 'message-center-open') {
    if (!welcomeMessageAdded.value) {
      messageCenter.pushMessage(
        'info',
        t('tutorial.welcomeMessageTitle'),
        t('tutorial.welcomeMessageDescription'),
        '',
      )
      welcomeMessageAdded.value = true
    }
    messageCenter.openDialog()
  } else if (step.id === 'profile-trigger') {
    messageCenter.closeDialog()
  }

  if (step.id === 'songbird-open') {
    void openSaplingAiChat()
  } else if (step.id !== 'songbird-trigger') {
    closeSaplingAiChat()
  }
}

async function createTutorialWelcomeEvent() {
  try {
    if (!currentPersonStore.person) {
      await currentPersonStore.fetchCurrentPerson()
    }

    const person = currentPersonStore.person
    if (!person) {
      return
    }

    await ensureTutorialWelcomeEvent(person, {
      title: t('tutorial.welcomeEventTitle'),
      description: t('tutorial.welcomeEventDescription'),
    })
  } catch {
    // The tutorial stays usable when the current role cannot create events.
  }
}

function handleDashboardStep(step: SaplingTutorialStep) {
  setSaplingDashboardTutorialLayout(step.id === 'layout-mode')
}

function finishNavigationTutorial() {
  navigationTutorial.finish()
  cleanupInteractiveSurfaces()

  const startedDashboard = dashboardTutorial.start({ force: forcedSequence.value })
  activeGroup.value = startedDashboard ? 'dashboard' : null
}

function dismissAllTutorials() {
  navigationTutorial.dismiss()
  dashboardTutorial.dismiss()
  forcedSequence.value = false
  activeGroup.value = null
  cleanupInteractiveSurfaces()
}

function finishDashboardTutorial() {
  dashboardTutorial.finish()
  forcedSequence.value = false
  activeGroup.value = null
  cleanupInteractiveSurfaces()
}

function dismissDashboardTutorial() {
  dashboardTutorial.dismiss()
  forcedSequence.value = false
  activeGroup.value = null
  cleanupInteractiveSurfaces()
}

async function restartTutorials() {
  if (route.path !== '/') {
    await router.push('/')
    await nextTick()
  }

  stopActiveTutorials()
  forcedSequence.value = true
  welcomeMessageAdded.value = false
  navigationTutorial.start({ force: true })
  activeGroup.value = 'navigation'
}

function stopActiveTutorials() {
  navigationTutorial.stop()
  dashboardTutorial.stop()
  activeGroup.value = null
  cleanupInteractiveSurfaces()
}

function cleanupInteractiveSurfaces() {
  emit('setNavigationOpen', false)
  emit('setProfileMenuOpen', false)
  emit('closeInbox')
  messageCenter.closeDialog()
  closeSaplingCommandPalette()
  closeSaplingHelp()
  closeSaplingAiChat()
  setSaplingDashboardTutorialLayout(false)
}

function handleRestartTutorials() {
  void restartTutorials()
}

onMounted(() => {
  window.addEventListener(SAPLING_START_DASHBOARD_TUTORIAL_EVENT, handleRestartTutorials)
})

onBeforeUnmount(() => {
  if (autoStartFrame !== null) {
    window.cancelAnimationFrame(autoStartFrame)
  }
  window.removeEventListener(SAPLING_START_DASHBOARD_TUTORIAL_EVENT, handleRestartTutorials)
  stopActiveTutorials()
})
</script>
