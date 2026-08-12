<template>
  <SaplingActionBar>
    <template #leading>
      <v-btn variant="text" prepend-icon="mdi-close" @click="cancel">
        <template v-if="$vuetify.display.mdAndUp">{{ $t(cancelLabelKey) }}</template>
      </v-btn>
    </template>

    <template #trailing>
      <v-btn variant="text" prepend-icon="mdi-download" @click="download">
        <template v-if="$vuetify.display.mdAndUp">{{ $t('global.download') }}</template>
      </v-btn>
      <v-btn v-if="confirm" color="primary" append-icon="mdi-check" @click="confirm">
        <template v-if="$vuetify.display.mdAndUp">{{ $t('global.ok') }}</template>
      </v-btn>
    </template>
  </SaplingActionBar>
</template>

<script lang="ts" setup>
import SaplingActionBar from '@/components/actions/SaplingActionBar.vue'

withDefaults(
  defineProps<{
    cancel: () => void
    download: () => void
    confirm?: () => void
    cancelLabelKey?: string
  }>(),
  {
    confirm: undefined,
    cancelLabelKey: 'global.cancel',
  },
)
</script>
