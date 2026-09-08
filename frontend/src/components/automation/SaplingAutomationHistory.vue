<template>
  <div class="sapling-automation-history sapling-stack-lg">
    <v-alert
      class="sapling-automation-history__notice"
      type="info"
      variant="tonal"
      density="compact"
      >{{ t('automation.historyExplanation') }}</v-alert
    >
    <p v-if="!history.executions.length && !history.independentEmails.length">
      {{ t('automation.notDocumented') }}
    </p>
    <v-expansion-panels v-if="history.executions.length">
      <v-expansion-panel
        v-for="execution in history.executions"
        :key="execution.handle"
        :title="`${formatDate(execution.createdAt)} · ${execution.ruleSnapshot?.title ?? t(`automation.kind.${execution.kind}`)} · ${t(`automation.result.${execution.status}`)}`"
      >
        <v-expansion-panel-text>
          <p>{{ t('automation.chain') }}: {{ execution.chainId }}</p>
          <p>
            {{ t(`navigation.${execution.sourceEntity}`) }} →
            {{ t(`navigation.${execution.targetEntity}`) }}
          </p>
          <p v-if="execution.message">{{ execution.message }}</p>
          <p v-if="!execution.ruleSnapshot">{{ t('automation.oldRuleUnknown') }}</p>
          <p v-if="!execution.deliveries.length && ['webhook', 'teams'].includes(execution.kind)">
            {{ t('automation.deliveryUnknown') }}
          </p>
          <p v-for="delivery in execution.deliveries" :key="`${delivery.kind}:${delivery.handle}`">
            {{ t('automation.delivery') }}:
            {{ t(`automation.deliveryStatus.${delivery.status}`) }} ·
            {{ t('automation.attempts') }}: {{ delivery.attemptCount }}
          </p>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
    <section v-if="history.independentEmails.length" class="sapling-stack-md">
      <h3>{{ t('automation.independentEmails') }}</h3>
      <SaplingDataTable
        :items="history.independentEmails"
        :columns="emailColumns"
        :item-key="(item) => item.handle"
      >
        <template #row="{ item }"
          ><tr>
            <td>{{ formatDate(item.createdAt) }}</td>
            <td>
              <RouterLink
                @click="emit('navigate')"
                :to="{
                  path: '/table/emailDelivery',
                  query: { filter: JSON.stringify({ handle: item.handle }) },
                }"
                >{{ item.subject || `#${item.handle}` }}</RouterLink
              >
            </td>
            <td>{{ item.toRecipients?.join(', ') || '—' }}</td>
            <td>{{ t(`automation.deliveryStatus.${item.status}`) }}</td>
            <td>{{ item.attemptCount }}</td>
          </tr></template
        ></SaplingDataTable
      >
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import SaplingDataTable from '@/components/table/SaplingDataTable.vue'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import type { AutomationHistory, DeliveryEvidence } from './automationInspection.types'
import type { SaplingDataColumn } from '@/components/table/saplingDataTable.types'
defineProps<{ history: AutomationHistory }>()
const emit = defineEmits<{ navigate: [] }>()
const { t } = useI18n()
useTranslationLoader('emailDelivery')
const formatDate = (value: string) => new Date(value).toLocaleString()
const emailColumns = computed<SaplingDataColumn<DeliveryEvidence>[]>(() => [
  { key: 'createdAt', title: t('emailDelivery.createdAt'), sortable: false },
  { key: 'subject', title: t('emailDelivery.subject'), sortable: false },
  { key: 'toRecipients', title: t('emailDelivery.toRecipients'), sortable: false },
  { key: 'status', title: t('emailDelivery.status'), sortable: false },
  { key: 'attemptCount', title: t('automation.attempts'), sortable: false },
])
</script>
