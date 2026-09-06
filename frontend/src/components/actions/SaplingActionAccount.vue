<template>
  <SaplingActionBar>
    <template #leading>
      <v-btn variant="text" prepend-icon="mdi-close" @click="handleClose">
        <template v-if="$vuetify.display.mdAndUp">{{ $t('global.close') }}</template>
      </v-btn>
    </template>

    <template #trailing>
      <v-btn
        v-if="handleChangePassword"
        color="primary"
        append-icon="mdi-lock-reset"
        @click="handleChangePassword"
      >
        <template v-if="$vuetify.display.mdAndUp">{{ $t('login.changePassword') }}</template>
      </v-btn>
      <v-btn color="error" append-icon="mdi-logout" @click="handleLogout">
        <template v-if="$vuetify.display.mdAndUp">{{ $t('login.logout') }}</template>
      </v-btn>
    </template>
  </SaplingActionBar>
</template>

<script lang="ts" setup>
import SaplingActionBar from '@/components/actions/SaplingActionBar.vue'

//#region Props
defineProps<{
  handleClose: () => void // Method to handle close action
  handleChangePassword?: () => void // Available only for local Sapling accounts
  handleLogout: () => void // Method to handle logout
}>()
//#endregion
</script>
