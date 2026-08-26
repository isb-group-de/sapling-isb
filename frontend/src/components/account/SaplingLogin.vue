<template>
  <!-- Container for the login form, styled to center content both vertically and horizontally -->
  <v-container class="sapling-login-shell d-flex flex-column justify-center align-center" fluid>
    <!-- Card container for the login form -->
    <SaplingDialogCard class="sapling-dialog-width--sm sapling-login-dialog" :elevation="10" tilt>
      <template v-if="isLoading">
        <SaplingInstanceBooting />
      </template>
      <template v-else>
        <SaplingDialogShell body-class="sapling-login-dialog__body">
          <template #hero>
            <div data-tutorial="login-welcome">
              <SaplingDialogHero eyebrow="Cloud CRM Sapling" :title="$t('login.title')" />
            </div>
          </template>

          <template #body>
            <v-form
              class="sapling-dialog-form"
              data-tutorial="login-credentials"
              @submit.prevent="handleLogin"
            >
              <SaplingTextField
                :label="$t('login.username')"
                prepend-icon="mdi-account"
                type="email"
                autocomplete="username"
                autofocus
                v-model="email"
                @keyup.enter="handleLogin"
              />
              <SaplingTextField
                :label="$t('login.password')"
                prepend-icon="mdi-lock"
                type="password"
                autocomplete="current-password"
                v-model="password"
                @keyup.enter="handleLogin"
              />
              <SaplingCheckbox
                v-model="rememberMe"
                :label="$t('login.rememberMe')"
                class="d-flex justify-end"
              />
              <!-- Hidden submit button so browsers treat Enter as form submission
                   even though the visible primary button lives in the action bar. -->
              <button
                type="submit"
                class="sapling-visually-hidden"
                tabindex="-1"
                aria-hidden="true"
              />
            </v-form>
          </template>

          <template #actions>
            <SaplingActionLogin
              :handleAzure="handleAzure"
              :handleGoogle="handleGoogle"
              :handleLogin="handleLogin"
              :isLoading="isAuthenticating"
            />
          </template>
        </SaplingDialogShell>
      </template>
    </SaplingDialogCard>
    <!-- Password change dialog displayed after login if required -->
    <SaplingChangePassword
      v-model="showPasswordChange"
      :allow-cancel="!requirePasswordChange"
      @success="handlePasswordChangeSuccess"
    />
    <SaplingTutorialOverlay
      v-model="isLoginTutorialActive"
      :steps="loginTutorialSteps"
      @finish="finishLoginTutorial"
      @dismiss="dismissLoginTutorial"
    />
  </v-container>
</template>

<script setup lang="ts">
//#region Import
import { computed, nextTick, watch } from 'vue'
// Import the composable for handling login logic
import SaplingInstanceBooting from '@/components/account/SaplingInstanceBooting.vue'
import { useSaplingLogin } from '@/composables/account/useSaplingLogin'
import { useSaplingTutorial } from '@/composables/system/useSaplingTutorial'
// Import the password change dialog component
import SaplingChangePassword from '@/components/account/SaplingChangePassword.vue'
import SaplingCheckbox from '@/components/common/SaplingCheckbox.vue'
import SaplingTextField from '@/components/common/SaplingTextField.vue'
// Import the extracted SaplingActionLogin component
import SaplingActionLogin from '@/components/actions/SaplingActionLogin.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingDialogHero from '@/components/common/SaplingDialogHero.vue'
import SaplingDialogShell from '@/components/common/SaplingDialogShell.vue'
import SaplingTutorialOverlay from '@/components/system/tutorial/SaplingTutorialOverlay.vue'
import type { SaplingTutorialStep } from '@/components/system/tutorial/saplingTutorial.types'
import {
  IS_LOGIN_WITH_AZURE_ENABLED,
  IS_LOGIN_WITH_GOOGLE_ENABLED,
} from '@/constants/project.constants'
import { useI18n } from 'vue-i18n'
//#endregion

//#region Composable
// Destructure the properties and methods from the useSaplingLogin composable
const {
  email, // Reactive property for the email input
  password, // Reactive property for the password input
  rememberMe, // Reactive property for the remember me checkbox
  isLoading, // Reactive property indicating if the login process is loading
  isAuthenticating, // Reactive property indicating if the authentication process is ongoing
  handleLogin, // Method to handle the login process
  handleAzure, // Method to handle Azure login
  handleGoogle, // Method to handle Google login
  showPasswordChange, // Reactive property to show the password change dialog
  requirePasswordChange,
  handlePasswordChangeSuccess, // Method to handle successful password change
} = useSaplingLogin()
//#endregion

const { t } = useI18n()
const {
  isActive: isLoginTutorialActive,
  start: startLoginTutorial,
  finish: finishLoginTutorial,
  dismiss: dismissLoginTutorial,
} = useSaplingTutorial({ id: 'login', version: 1 })

const loginTutorialSteps = computed<SaplingTutorialStep[]>(() => {
  const steps: SaplingTutorialStep[] = [
    {
      id: 'welcome',
      target: '[data-tutorial="login-welcome"]',
      title: t('login.tutorialWelcomeTitle'),
      description: t('login.tutorialWelcomeDescription'),
      icon: 'mdi-hand-wave-outline',
    },
    {
      id: 'credentials',
      target: '[data-tutorial="login-credentials"]',
      title: t('login.tutorialCredentialsTitle'),
      description: t('login.tutorialCredentialsDescription'),
      icon: 'mdi-account-key-outline',
    },
    {
      id: 'local-login',
      target: '[data-tutorial="login-local"]',
      title: t('login.tutorialLocalTitle'),
      description: t('login.tutorialLocalDescription'),
      icon: 'mdi-login',
    },
  ]

  if (IS_LOGIN_WITH_AZURE_ENABLED) {
    steps.push({
      id: 'azure-login',
      target: '[data-tutorial="login-azure"]',
      title: t('login.tutorialAzureTitle'),
      description: t('login.tutorialAzureDescription'),
      icon: 'mdi-microsoft-azure',
    })
  }

  if (IS_LOGIN_WITH_GOOGLE_ENABLED) {
    steps.push({
      id: 'google-login',
      target: '[data-tutorial="login-google"]',
      title: t('login.tutorialGoogleTitle'),
      description: t('login.tutorialGoogleDescription'),
      icon: 'mdi-google',
    })
  }

  return steps
})

watch(
  isLoading,
  async (loading) => {
    if (loading) {
      return
    }

    await nextTick()
    window.requestAnimationFrame(() => startLoginTutorial())
  },
  { immediate: true },
)
</script>
