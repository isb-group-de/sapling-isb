<template>
  <v-menu location="bottom start" :offset="8">
    <template #activator="{ props: menuProps }">
      <v-btn
        v-bind="menuProps"
        data-tutorial="header-quicklinks"
        class="sapling-button--action sapling-header__primary-action sapling-header__quicklinks text-none"
        variant="text"
        :aria-label="quickLinksLabel"
        :title="quickLinksLabel"
      >
        <span class="sapling-header__primary-action-content">
          <v-icon class="sapling-header__primary-action-icon" icon="mdi-lightning-bolt-outline" />
          <span class="sapling-header__primary-action-label">{{ quickLinksLabel }}</span>
          <v-icon class="sapling-header__quicklinks-chevron" icon="mdi-chevron-down" size="18" />
        </span>
      </v-btn>
    </template>

    <SaplingSurface :as="VList" class="sapling-header__quicklinks-menu" nav density="comfortable">
      <v-list-item
        v-for="link in quickLinks"
        :key="link.key"
        :data-quicklink="link.key"
        :prepend-icon="link.icon"
        :title="link.label"
        @click="navigate(link.path)"
      />
    </SaplingSurface>
  </v-menu>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { VList } from 'vuetify/components'
import SaplingSurface from '@/components/common/SaplingSurface.vue'

interface HeaderQuicklinkDefinition {
  key: string
  labelKey: string
  fallbackDe: string
  fallbackEn: string
  path: string
  icon: string
}

const QUICKLINK_DEFINITIONS: HeaderQuicklinkDefinition[] = [
  {
    key: 'effortEstimate',
    labelKey: 'navigation.effortEstimate',
    fallbackDe: 'Aufwandsschätzungen',
    fallbackEn: 'Effort estimates',
    path: '/partner/effortEstimate',
    icon: 'mdi-clipboard-text-clock-outline',
  },
  {
    key: 'calendar',
    labelKey: 'navigation.calendar',
    fallbackDe: 'Kalender',
    fallbackEn: 'Calendar',
    path: '/event',
    icon: 'mdi-calendar-star',
  },
  {
    key: 'ticket',
    labelKey: 'navigation.ticket',
    fallbackDe: 'Tickets',
    fallbackEn: 'Tickets',
    path: '/partner/ticket',
    icon: 'mdi-ticket',
  },
  {
    key: 'salesOpportunity',
    labelKey: 'navigation.salesOpportunity',
    fallbackDe: 'Verkaufschancen',
    fallbackEn: 'Sales opportunities',
    path: '/partner/salesOpportunity',
    icon: 'mdi-cash-multiple',
  },
  {
    key: 'internalCase',
    labelKey: 'navigation.internalCase',
    fallbackDe: 'Vorgänge',
    fallbackEn: 'Cases',
    path: '/partner/internalCase',
    icon: 'mdi-clipboard-text-outline',
  },
]

const router = useRouter()
const { locale, t } = useI18n()

const quickLinksLabel = computed(() =>
  translatedLabel('global.quickLinks', 'Quicklinks', 'Quick links'),
)

const quickLinks = computed(() => {
  const collator = new Intl.Collator(locale.value, { sensitivity: 'base' })

  return QUICKLINK_DEFINITIONS.map((link) => ({
    ...link,
    label: translatedLabel(link.labelKey, link.fallbackDe, link.fallbackEn),
  })).sort((left, right) => collator.compare(left.label, right.label))
})

function translatedLabel(key: string, fallbackDe: string, fallbackEn: string) {
  return t(key) || (locale.value === 'de' ? fallbackDe : fallbackEn)
}

async function navigate(path: string) {
  await router.push(path)
}
</script>
