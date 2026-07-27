<template>
  <v-menu location="bottom end">
    <template #activator="{ props: menuProps }">
      <v-btn
        class="sapling-table-toolbar-action sapling-table-toolbar-action--icon-only sapling-table-toolbar-action--utility"
        :class="{ 'sapling-table-refresh-button--countdown': secondsUntilRefresh !== null }"
        color="primary"
        :variant="modelValue === null ? 'tonal' : 'flat'"
        icon
        v-bind="menuProps"
        :title="buttonTitle"
        :aria-label="buttonTitle"
      >
        <span class="sapling-table-refresh-button__content">
          <v-icon :size="secondsUntilRefresh === null ? undefined : 17">
            {{ modelValue === null ? 'mdi-refresh' : 'mdi-timer-outline' }}
          </v-icon>
          <span
            v-if="secondsUntilRefresh !== null"
            class="sapling-table-refresh-button__countdown"
            aria-hidden="true"
          >
            {{ secondsUntilRefresh }}s
          </span>
        </span>
      </v-btn>
    </template>

    <v-list density="compact" class="glass-panel sapling-table-refresh-menu-list" nav>
      <v-list-item
        prepend-icon="mdi-refresh"
        :title="refreshButtonLabel"
        @click="emit('refresh')"
      />

      <v-divider />
      <v-list-subheader>{{ $t('global.autoRefresh') }}</v-list-subheader>

      <v-list-item
        v-if="secondsUntilRefresh !== null"
        class="sapling-table-refresh-menu-list__countdown"
        prepend-icon="mdi-clock-outline"
        :title="$t('global.nextRefreshInSeconds', { count: secondsUntilRefresh })"
        :ripple="false"
      />

      <v-list-item
        prepend-icon="mdi-close-circle-outline"
        :title="$t('global.autoRefreshOff')"
        :active="modelValue === null"
        @click="emit('update:modelValue', null)"
      >
        <template #append>
          <v-icon v-if="modelValue === null" size="small">mdi-check</v-icon>
        </template>
      </v-list-item>

      <v-list-item
        v-for="intervalMinutes in intervals"
        :key="intervalMinutes"
        prepend-icon="mdi-timer-outline"
        :title="getIntervalLabel(intervalMinutes)"
        :active="modelValue === intervalMinutes"
        @click="emit('update:modelValue', intervalMinutes)"
      >
        <template #append>
          <v-icon v-if="modelValue === intervalMinutes" size="small">mdi-check</v-icon>
        </template>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  SAPLING_TABLE_AUTO_REFRESH_INTERVALS,
  type SaplingTableAutoRefreshInterval,
} from '@/composables/table/useSaplingTableAutoRefresh'

const props = defineProps<{
  refreshButtonLabel: string
  modelValue: SaplingTableAutoRefreshInterval | null
  secondsUntilRefresh: number | null
}>()

const emit = defineEmits<{
  refresh: []
  'update:modelValue': [value: SaplingTableAutoRefreshInterval | null]
}>()

const { t } = useI18n()
const intervals = SAPLING_TABLE_AUTO_REFRESH_INTERVALS
const buttonTitle = computed(() =>
  props.modelValue === null
    ? props.refreshButtonLabel
    : [
        `${props.refreshButtonLabel}: ${getIntervalLabel(props.modelValue)}`,
        props.secondsUntilRefresh === null
          ? null
          : t('global.nextRefreshInSeconds', { count: props.secondsUntilRefresh }),
      ]
        .filter(Boolean)
        .join(' · '),
)

function getIntervalLabel(intervalMinutes: SaplingTableAutoRefreshInterval): string {
  return intervalMinutes === 1
    ? t('global.refreshEveryMinute')
    : t('global.refreshEveryMinutes', { count: intervalMinutes })
}
</script>

<style scoped>
.sapling-table-refresh-button__content {
  display: grid;
  place-items: center;
  line-height: 1;
}

.sapling-table-refresh-button__countdown {
  min-width: 4ch;
  margin-top: -1px;
  font-size: 0.56rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1;
  text-align: center;
}

.sapling-table-refresh-menu-list {
  min-width: 260px;
}

.sapling-table-refresh-menu-list__countdown {
  font-variant-numeric: tabular-nums;
}
</style>
