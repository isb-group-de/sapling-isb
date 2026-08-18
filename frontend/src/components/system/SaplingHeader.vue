<template>
  <v-app-bar :elevation="2" class="sapling-header">
    <template #prepend>
      <v-app-bar-nav-icon
        data-tutorial="header-navigation"
        :aria-label="props.modelValue ? $t('global.closeDrawer') : $t('global.navigation')"
        :title="props.modelValue ? $t('global.closeDrawer') : $t('global.navigation')"
        @click="toggleNavigation"
      />
    </template>

    <v-app-bar-title>
      <div class="sapling-inline-cluster sapling-inline-cluster--wide sapling-header__brand">
        <v-tooltip location="bottom" :text="$t('global.backToHome')">
          <template #activator="{ props: tooltipProps }">
            <v-btn
              v-bind="tooltipProps"
              data-tutorial="header-home"
              class="sapling-header__home pa-1"
              prepend-icon="mdi-home-outline"
              :aria-label="$t('global.backToHome')"
              :title="$t('global.backToHome')"
              @click="goHome"
            >
              <span class="sapling-header__home-label">Sapling</span>
            </v-btn>
          </template>
        </v-tooltip>
      </div>
    </v-app-bar-title>

    <template #append>
      <SaplingHeaderStatusActions
        :inbox-count="inboxCount"
        :inbox-badge-color="inboxBadgeColor"
        :message-count="messageCount"
        :message-badge-color="messageBadgeColor"
        :more-label="$t('global.more')"
        :inbox-label="$t('global.inbox')"
        :message-center-label="$t('global.messageCenter')"
        :help-label="$t('global.contextualHelp')"
        :search-label="$t('global.search')"
        @open-context-help="openContextHelp"
        @open-search="openSearch"
        @open-inbox="openInbox"
        @open-message-center="openMessageCenter"
      />

      <SaplingHeaderProfileMenu
        v-model="showProfileMenu"
        :persistent="tutorialProfileMenuOpen"
        :is-impersonating="isImpersonating"
        :impersonation-actor-name="impersonationActorName"
        :impersonation-returning="impersonationReturning"
        :profile-name="profileName"
        :profile-meta="profileMeta"
        :profile-initials="profileInitials"
        :current-language="currentLanguage"
        :language-options="languageOptions"
        :issue-action="issueAction"
        :appearance-actions="appearanceActions"
        :admin-actions="adminActions"
        :danger-zone-label="dangerZoneLabel"
        @return-to-own-account="returnToOwnAccount"
        @open-account="openAccountFromProfile"
        @open-issue="openIssueFromProfile"
        @run-admin-action="runAdminAction"
        @set-language="setLanguage"
      />
    </template>
  </v-app-bar>

  <SaplingHeaderInboxPreview
    :preview="visibleIncomingInboxPreview"
    @open="openIncomingInboxPreview"
  />

  <SaplingInbox v-if="showInbox" @close="closeInbox" />
  <SaplingAccount v-if="showAccount" :initial-tab="initialAccountTab" @close="closeAccount" />
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSaplingHeader } from '@/composables/system/useSaplingHeader'
import { useSaplingHeaderInboxPreview } from '@/composables/system/useSaplingHeaderInboxPreview'
import { useSaplingHelp } from '@/composables/system/useSaplingHelp'
import {
  openContextHelpArticle,
  resolveRouteContextHelpKey,
} from '@/composables/knowledge/useSaplingContextHelp'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import { useSaplingPreferences } from '@/composables/system/useSaplingPreferences'
import { useSaplingVectorization } from '@/composables/system/useSaplingVectorization'
import { useSaplingSearchIndexRebuild } from '@/composables/system/useSaplingSearchIndexRebuild'
import { BACKEND_URL, GIT_URL } from '@/constants/project.constants'
import { i18n } from '@/i18n'
import SaplingInbox from '@/components/account/SaplingInbox.vue'
import SaplingAccount from '@/components/account/SaplingAccount.vue'
import SaplingHeaderInboxPreview from '@/components/system/header/SaplingHeaderInboxPreview.vue'
import SaplingHeaderProfileMenu from '@/components/system/header/SaplingHeaderProfileMenu.vue'
import SaplingHeaderStatusActions from '@/components/system/header/SaplingHeaderStatusActions.vue'
import {
  SAPLING_OPEN_ACCOUNT_DIALOG_EVENT,
  type SaplingAccountDialogTab,
  type SaplingOpenAccountDialogDetail,
} from '@/services/account-dialog.service'
import { openSaplingCommandPalette } from '@/services/command-palette.service'
import type { SaplingProfileAction } from '@/components/system/header/header.types'

const router = useRouter()
const route = useRoute()
const showProfileMenu = ref(false)
const tutorialProfileMenuOpen = ref(false)
const initialAccountTab = ref<SaplingAccountDialogTab>('profile')

const props = withDefaults(
  defineProps<{
    modelValue?: boolean
  }>(),
  {
    modelValue: false,
  },
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
}>()

const { messages, getMessageColor, openDialog: openGlobalMessageCenter } = useSaplingMessageCenter()
const { openSaplingHelp } = useSaplingHelp()
const messageCount = computed(() => messages.value.length)
const messageBadgeColor = computed(() => {
  const latestMessage = messages.value[0]

  if (!latestMessage) {
    return 'primary'
  }

  return getMessageColor(latestMessage.type)
})

const { currentLanguage, languageOptions, issueAction, appearanceActions, setLanguage } =
  useSaplingPreferences()
const { toggleSaplingVectorization } = useSaplingVectorization()
const { openSaplingSearchIndexRebuild } = useSaplingSearchIndexRebuild()
const {
  showInbox,
  showAccount,
  inboxCount,
  inboxBadgeColor,
  incomingInboxPreview,
  currentPersonStore,
  openInbox,
  closeInbox,
  openAccount,
  closeAccount,
  goHome,
} = useSaplingHeader()
const { visibleIncomingInboxPreview, openIncomingInboxPreview } =
  useSaplingHeaderInboxPreview(incomingInboxPreview)

onMounted(() => {
  window.addEventListener(
    SAPLING_OPEN_ACCOUNT_DIALOG_EVENT,
    handleOpenAccountEvent as EventListener,
  )
})

onUnmounted(() => {
  window.removeEventListener(
    SAPLING_OPEN_ACCOUNT_DIALOG_EVENT,
    handleOpenAccountEvent as EventListener,
  )
})

function toggleNavigation() {
  emit('update:modelValue', !props.modelValue)
}

function openMessageCenter() {
  openGlobalMessageCenter()
}

function openSearch() {
  openSaplingCommandPalette()
}

async function openContextHelp() {
  const contextKey = resolveCurrentContextHelpKey()

  if (!(await openContextHelpArticle(router, contextKey))) {
    openSaplingHelp()
  }
}

function openIssueFromProfile() {
  if (!issueAction.value) {
    return
  }

  showProfileMenu.value = false
  return issueAction.value.handler()
}

function openAccountFromProfile() {
  showProfileMenu.value = false
  initialAccountTab.value = 'profile'
  openAccount()
}

function handleOpenAccountEvent(event: CustomEvent<SaplingOpenAccountDialogDetail>) {
  initialAccountTab.value = event.detail?.tab ?? 'profile'
  showProfileMenu.value = false
  openAccount()
}

function runAdminAction(action: SaplingProfileAction) {
  showProfileMenu.value = false
  return action.handler()
}

const profileName = computed(() => {
  const person = currentPersonStore.person

  if (!person) {
    return 'Sapling'
  }

  return [person.firstName, person.lastName].filter(Boolean).join(' ').trim() || 'Sapling'
})

const profileMeta = computed(() => {
  const person = currentPersonStore.person

  return person?.email || person?.loginName || ''
})

const profileInitials = computed(() => {
  const person = currentPersonStore.person

  if (!person) {
    return 'SP'
  }

  const initials = [person.firstName, person.lastName]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim().charAt(0).toUpperCase())
    .join('')

  return initials || 'SP'
})

const hasAdministratorRole = computed(
  () =>
    currentPersonStore.person?.roles?.some((role) => {
      if (!role || typeof role === 'string') {
        return false
      }

      return role.isAdministrator === true
    }) ?? false,
)

const adminActions = computed<SaplingProfileAction[]>(() => {
  if (!hasAdministratorRole.value) {
    return []
  }

  return [
    {
      key: 'system',
      icon: 'mdi-poll',
      label: i18n.global.t('global.systemMonitor'),
      handler: openSystem,
    },
    {
      key: 'vectorization',
      icon: 'mdi-vector-polyline',
      label: i18n.global.t('global.vectorization'),
      handler: openVectorization,
    },
    {
      key: 'searchIndex',
      icon: 'mdi-database-sync-outline',
      label: i18n.global.t('global.searchIndexRebuild'),
      handler: openSearchIndexRebuild,
    },
    {
      key: 'formConfig',
      icon: 'mdi-table-cog',
      label: i18n.global.t('formConfig.title'),
      handler: openFormConfig,
    },
    {
      key: 'playground',
      icon: 'mdi-code-block-braces',
      label: i18n.global.t('global.componentLibrary'),
      handler: openPlayground,
    },
    {
      key: 'swagger',
      icon: 'mdi-api',
      label: i18n.global.t('global.swagger'),
      handler: openSwagger,
    },
    {
      key: 'git',
      icon: 'mdi-git',
      label: i18n.global.t('global.git'),
      handler: openGit,
    },
  ]
})

const dangerZoneLabel = computed(() =>
  currentLanguage.value === 'en' ? 'Danger Zone' : 'Danger Zone',
)

async function openSystem() {
  await router.push('/system')
}

async function openPlayground() {
  await router.push('/playground')
}

async function openFormConfig() {
  await router.push('/form-config')
}

async function openVectorization() {
  await toggleSaplingVectorization()
}

async function openSearchIndexRebuild() {
  await openSaplingSearchIndexRebuild()
}

function openSwagger() {
  window.open(`${BACKEND_URL}swagger`, '_blank')
}

function openGit() {
  window.open(GIT_URL, '_blank')
}

const impersonationReturning = ref(false)
const isImpersonating = computed(() => currentPersonStore.isImpersonating)
const impersonationActorName = computed(() => {
  const actor = currentPersonStore.impersonator
  if (!actor) {
    return ''
  }
  return `${actor.firstName ?? ''} ${actor.lastName ?? ''}`.trim()
})

async function returnToOwnAccount() {
  if (impersonationReturning.value) {
    return
  }
  impersonationReturning.value = true
  try {
    await currentPersonStore.stopImpersonation()
  } finally {
    impersonationReturning.value = false
  }
}

function resolveCurrentContextHelpKey(): string | null {
  if (showAccount.value) {
    return 'app.profile'
  }

  if (showInbox.value) {
    return 'app.inbox'
  }

  return resolveRouteContextHelpKey(route)
}

function setProfileMenu(value: boolean) {
  tutorialProfileMenuOpen.value = value
  showProfileMenu.value = value
}

defineExpose({
  closeInbox,
  setProfileMenu,
})
</script>
