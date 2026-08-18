<template>
  <section class="sapling-crm-workspace__toolbar glass-panel">
    <div class="sapling-crm-workspace__toolbar-header">
      <v-btn-toggle
        v-model="activeCockpit"
        class="sapling-crm-workspace__tabs"
        color="primary"
        density="comfortable"
        divided
        mandatory
      >
        <v-btn value="sales" prepend-icon="mdi-chart-timeline-variant">
          <span>{{ t('crmWorkspace.salesCockpit') }}</span>
          <span class="sapling-crm-workspace__tab-count">{{ cockpitCounts.sales }}</span>
        </v-btn>
        <v-btn value="account" prepend-icon="mdi-domain">
          <span>{{ t('crmWorkspace.accountCockpit') }}</span>
          <span class="sapling-crm-workspace__tab-count">{{ cockpitCounts.account }}</span>
        </v-btn>
        <v-btn value="customerSuccess" prepend-icon="mdi-heart-pulse">
          <span>{{ t('crmWorkspace.customerSuccessCockpit') }}</span>
          <span class="sapling-crm-workspace__tab-count">{{ cockpitCounts.customerSuccess }}</span>
        </v-btn>
      </v-btn-toggle>

      <div class="sapling-crm-workspace__filter-status">
        <v-chip
          v-if="activeFilterCount"
          size="small"
          color="primary"
          variant="tonal"
          prepend-icon="mdi-filter-check-outline"
        >
          {{ t('crmWorkspace.activeFilters', { count: activeFilterCount }) }}
        </v-chip>
        <v-btn
          prepend-icon="mdi-filter-remove-outline"
          variant="text"
          size="small"
          :disabled="activeFilterCount === 0"
          @click="emit('resetFilters')"
        >
          {{ t('crmWorkspace.resetFilters') }}
        </v-btn>
      </div>
    </div>

    <div class="sapling-crm-workspace__toolbar-fields">
      <v-text-field
        v-model="search"
        density="comfortable"
        hide-details
        clearable
        autocomplete="off"
        prepend-inner-icon="mdi-magnify"
        :label="t('global.search')"
      />
      <v-autocomplete
        v-model="selectedResponsibleHandle"
        density="comfortable"
        hide-details
        clearable
        prepend-inner-icon="mdi-account-tie-outline"
        :items="responsiblePersonOptions"
        :label="t('crmWorkspace.responsiblePerson')"
      />
      <v-autocomplete
        v-if="activeCockpit === 'sales'"
        v-model="opportunityHorizonDays"
        density="comfortable"
        hide-details
        prepend-inner-icon="mdi-calendar-range-outline"
        :items="opportunityHorizonOptions"
        :label="t('crmWorkspace.closeHorizon')"
      />
      <v-autocomplete
        v-else
        v-model="selectedSegmentHandle"
        density="comfortable"
        hide-details
        clearable
        prepend-inner-icon="mdi-tag-multiple-outline"
        :items="segmentOptions"
        :label="t('crmWorkspace.customerSegment')"
      />
      <v-autocomplete
        v-if="activeCockpit !== 'sales'"
        v-model="contactThresholdDays"
        density="comfortable"
        hide-details
        prepend-inner-icon="mdi-account-clock-outline"
        :items="contactThresholdOptions"
        :label="t('crmWorkspace.contactThreshold')"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { CrmCockpitKey } from './crmWorkspace.types'

export type { CrmCockpitKey } from './crmWorkspace.types'

type SelectOption<T> = {
  title: string
  value: T
}

defineProps<{
  activeFilterCount: number
  cockpitCounts: Record<CrmCockpitKey, number>
  responsiblePersonOptions: SelectOption<string | null>[]
  segmentOptions: SelectOption<string | null>[]
  contactThresholdOptions: SelectOption<number>[]
  opportunityHorizonOptions: SelectOption<number | null>[]
}>()

const emit = defineEmits<{
  resetFilters: []
}>()

const activeCockpit = defineModel<CrmCockpitKey>('activeCockpit', { required: true })
const search = defineModel<string>('search', { required: true })
const selectedResponsibleHandle = defineModel<string | null>('selectedResponsibleHandle', {
  required: true,
})
const selectedSegmentHandle = defineModel<string | null>('selectedSegmentHandle', {
  required: true,
})
const contactThresholdDays = defineModel<number>('contactThresholdDays', { required: true })
const opportunityHorizonDays = defineModel<number | null>('opportunityHorizonDays', {
  required: true,
})

const { t } = useI18n()
</script>
