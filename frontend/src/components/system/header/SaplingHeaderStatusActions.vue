<template>
  <div class="sapling-header__compact-actions">
    <v-btn
      class="sapling-header__desktop-action sapling-header__compact-action text-none"
      stacked
      :aria-label="searchLabel"
      :title="searchLabel"
      @click="emit('openSearch')"
    >
      <v-icon icon="mdi-magnify" />
    </v-btn>

    <v-btn
      class="sapling-header__desktop-action sapling-header__compact-action text-none"
      stacked
      :aria-label="helpLabel"
      :title="helpLabel"
      @click="emit('openContextHelp')"
    >
      <v-icon icon="mdi-help-circle-outline" />
    </v-btn>
  </div>

  <div class="sapling-header__inbox-slot">
    <v-btn
      class="sapling-header__desktop-action text-none"
      stacked
      :aria-label="inboxActionLabel"
      :title="inboxActionLabel"
      @click="emit('openInbox')"
    >
      <v-badge
        location="top right"
        :color="inboxBadgeColor"
        :content="inboxCount"
        :model-value="true"
      >
        <v-icon icon="mdi-email" />
      </v-badge>
    </v-btn>
  </div>

  <v-btn
    class="sapling-header__desktop-action text-none"
    stacked
    :aria-label="messageCenterActionLabel"
    :title="messageCenterActionLabel"
    @click="emit('openMessageCenter')"
  >
    <v-badge
      location="top right"
      :color="messageBadgeColor"
      :content="messageCount"
      :value="messageCount > 0"
    >
      <v-icon icon="mdi-cloud-alert" />
    </v-badge>
  </v-btn>

  <v-menu location="bottom end" :offset="12">
    <template #activator="{ props: menuProps }">
      <v-btn
        v-bind="menuProps"
        class="sapling-header__mobile-overflow"
        icon="mdi-dots-vertical"
        variant="text"
        :aria-label="moreLabel"
      />
    </template>

    <SaplingSurface
      :as="VList"
      class="sapling-header__mobile-overflow-menu"
      density="comfortable"
      nav
    >
      <v-list-item :title="inboxLabel" @click="emit('openInbox')">
        <template #prepend>
          <v-icon icon="mdi-email" />
        </template>
        <template #append>
          <v-badge :color="inboxBadgeColor" inline :content="inboxCount" :model-value="true" />
        </template>
      </v-list-item>

      <v-list-item :title="messageCenterLabel" @click="emit('openMessageCenter')">
        <template #prepend>
          <v-icon icon="mdi-cloud-alert" />
        </template>
        <template #append>
          <v-badge
            :color="messageBadgeColor"
            inline
            :content="messageCount"
            :model-value="messageCount > 0"
          />
        </template>
      </v-list-item>

      <v-list-item :title="searchLabel" @click="emit('openSearch')">
        <template #prepend>
          <v-icon icon="mdi-magnify" />
        </template>
      </v-list-item>

      <v-list-item :title="helpLabel" @click="emit('openContextHelp')">
        <template #prepend>
          <v-icon icon="mdi-help-circle-outline" />
        </template>
      </v-list-item>
    </SaplingSurface>
  </v-menu>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { VList } from 'vuetify/components'
import SaplingSurface from '@/components/common/SaplingSurface.vue'

const props = defineProps<{
  inboxCount: number
  inboxBadgeColor: string
  messageCount: number
  messageBadgeColor: string
  moreLabel: string
  inboxLabel: string
  messageCenterLabel: string
  helpLabel: string
  searchLabel: string
}>()

const inboxActionLabel = computed(() => `${props.inboxLabel}: ${props.inboxCount}`)
const messageCenterActionLabel = computed(
  () => `${props.messageCenterLabel}: ${props.messageCount}`,
)

const emit = defineEmits<{
  openContextHelp: []
  openSearch: []
  openInbox: []
  openMessageCenter: []
}>()
</script>
