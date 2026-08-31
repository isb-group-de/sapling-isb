<template>
  <a
    v-if="onlineMeetingUrl"
    class="sapling-event-online-meeting-link"
    :href="onlineMeetingUrl"
    rel="noopener noreferrer"
    @click.stop
    @mousedown.stop
  >
    <v-icon size="16">mdi-video-outline</v-icon>
    <span>{{ t('calendar.joinOnlineMeeting') }}</span>
  </a>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { normalizeOnlineMeetingUrl } from '@/composables/event/eventCalendar.utils'

const props = defineProps<{
  url?: string | null
}>()

const { t } = useI18n()
const onlineMeetingUrl = computed(() => normalizeOnlineMeetingUrl(props.url))
</script>
