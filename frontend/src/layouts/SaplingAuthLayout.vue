<template>
  <div class="sapling-app-layout sapling-auth-layout">
    <template v-if="!isShellTranslationLoading">
      <div class="sapling-app-layout__header">
        <SaplingHeader ref="headerRef" v-model="navigationDrawer" />
      </div>

      <div class="sapling-auth-layout__body">
        <SaplingNavigation v-if="navigationDrawerMounted" v-model="navigationDrawer" />

        <div
          class="sapling-app-layout__content sapling-content sapling-content--app sapling-auth-layout__content"
        >
          <SaplingWorkspaceTabs />
        </div>
      </div>

      <SaplingAiChat />
      <SaplingVectorizationDialog />
      <SaplingSearchIndexRebuildDialog />
      <SaplingMessageCenter />
      <SaplingDialogMail />
      <SaplingDialogPhoneCall />
      <SaplingRecordTimeline />
      <SaplingRecordChangeLog />
      <SaplingCommandPalette />
      <SaplingHelpDialog />
      <SaplingDashboardTutorials
        @set-navigation-open="setTutorialNavigationOpen"
        @set-profile-menu-open="setTutorialProfileMenuOpen"
        @close-inbox="closeTutorialInbox"
      />
    </template>

    <div v-else class="sapling-app-layout__loading">
      <v-progress-circular indeterminate color="primary" size="48" width="4" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import SaplingWorkspaceTabs from '@/components/system/workspace/SaplingWorkspaceTabs.vue'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import { useSaplingImportJobs } from '@/composables/import/useSaplingImportJobs'
import SaplingHeader from '@/components/system/SaplingHeader.vue'
import SaplingDashboardTutorials from '@/components/system/tutorial/SaplingDashboardTutorials.vue'

// Shell widgets: load them only when actually mounted/opened.
const SaplingAiChat = defineAsyncComponent(() => import('@/components/system/SaplingAiChat.vue'))
const SaplingNavigation = defineAsyncComponent(
  () => import('@/components/system/SaplingNavigation.vue'),
)
const SaplingMessageCenter = defineAsyncComponent(
  () => import('@/components/system/SaplingMessageCenter.vue'),
)
const SaplingVectorizationDialog = defineAsyncComponent(
  () => import('@/components/system/SaplingVectorizationDialog.vue'),
)
const SaplingSearchIndexRebuildDialog = defineAsyncComponent(
  () => import('@/components/system/SaplingSearchIndexRebuildDialog.vue'),
)
const SaplingDialogMail = defineAsyncComponent(
  () => import('@/components/dialog/SaplingDialogMail.vue'),
)
const SaplingDialogPhoneCall = defineAsyncComponent(
  () => import('@/components/dialog/SaplingDialogPhoneCall.vue'),
)
const SaplingRecordTimeline = defineAsyncComponent(
  () => import('@/components/timeline/SaplingRecordTimeline.vue'),
)
const SaplingRecordChangeLog = defineAsyncComponent(
  () => import('@/components/changeLog/SaplingRecordChangeLog.vue'),
)
const SaplingCommandPalette = defineAsyncComponent(
  () => import('@/components/system/SaplingCommandPalette.vue'),
)
const SaplingHelpDialog = defineAsyncComponent(
  () => import('@/components/system/SaplingHelpDialog.vue'),
)

const navigationDrawer = ref(false)
const navigationDrawerMounted = ref(false)
const headerRef = ref<{
  closeInbox: () => void
  setProfileMenu: (value: boolean) => void
} | null>(null)
const { startImportJobWatcher, stopImportJobWatcher } = useSaplingImportJobs()
const { isLoading: isShellTranslationLoading } = useTranslationLoader(
  'global',
  'formConfig',
  'import',
  'login',
  'permission',
  'tutorial',
)

function setTutorialNavigationOpen(value: boolean) {
  navigationDrawer.value = value
}

function setTutorialProfileMenuOpen(value: boolean) {
  headerRef.value?.setProfileMenu(value)
}

function closeTutorialInbox() {
  headerRef.value?.closeInbox()
}

watch(
  navigationDrawer,
  (isOpen) => {
    if (isOpen) {
      navigationDrawerMounted.value = true
    }
  },
  { immediate: true },
)

onMounted(() => {
  startImportJobWatcher()
})

onUnmounted(() => {
  stopImportJobWatcher()
})
</script>
