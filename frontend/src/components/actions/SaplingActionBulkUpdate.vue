<template>
  <SaplingActionBar>
    <template #leading>
      <v-btn variant="text" prepend-icon="mdi-close" :disabled="busy" @click="cancel">
        <template v-if="$vuetify.display.mdAndUp">{{ $t('global.cancel') }}</template>
      </v-btn>
    </template>

    <template #trailing>
      <v-btn
        color="primary"
        append-icon="mdi-database-edit-outline"
        :disabled="applyDisabled || busy"
        :loading="busy"
        @click="apply"
      >
        {{ $t('global.applyChanges') }}
      </v-btn>
    </template>
  </SaplingActionBar>
</template>

<script lang="ts" setup>
import SaplingActionBar from '@/components/actions/SaplingActionBar.vue'

defineProps<{
  cancel: () => void
  apply: () => void | Promise<void>
  applyDisabled?: boolean
  busy?: boolean
}>()
</script>
