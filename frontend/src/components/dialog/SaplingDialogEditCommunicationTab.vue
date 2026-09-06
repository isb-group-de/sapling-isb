<template>
  <div
    class="sapling-record-dialog-tab-scroll sapling-dialog-edit-tab-scroll sapling-dialog-edit-tab-scroll--communication"
  >
    <section class="sapling-record-communication">
      <div class="sapling-panel-shell sapling-record-communication__panel">
        <header class="sapling-record-communication__panel-header">
          <div class="sapling-record-relation-summary">
            <div class="sapling-record-relation-summary__icon">
              <v-icon :icon="icon" size="22" />
            </div>
            <div class="sapling-record-relation-summary__copy">
              <span class="sapling-record-relation-summary__eyebrow">{{ recordEntityLabel }}</span>
              <h3 class="sapling-record-relation-summary__title">{{ title }}</h3>
            </div>
          </div>

          <v-btn
            v-if="canCreate && isPhoneCall"
            color="primary"
            size="small"
            variant="tonal"
            :prepend-icon="actionIcon"
            :disabled="!phoneNumber"
            :title="!phoneNumber ? $t('phoneCall.phoneNumberRequired') : actionLabel"
            @click="createCommunication()"
          >
            {{ actionLabel }}
          </v-btn>

          <v-menu v-else-if="canCreate" location="bottom end">
            <template #activator="{ props: activatorProps }">
              <v-btn
                v-bind="activatorProps"
                color="primary"
                size="small"
                variant="tonal"
                :prepend-icon="actionIcon"
                append-icon="mdi-menu-down"
                :disabled="emailActions.length === 0"
                :title="actionLabel"
              >
                {{ actionLabel }}
              </v-btn>
            </template>

            <v-list class="glass-panel" density="compact" min-width="280">
              <v-list-item
                v-for="mailAction in emailActions"
                :key="`${mailAction.templateName}-${mailAction.email}`"
                data-test="record-email-action"
                prepend-icon="mdi-email-fast-outline"
                :title="resolveMailActionLabel(mailAction)"
                :subtitle="mailAction.email"
                @click="createCommunication(mailAction)"
              />
            </v-list>
          </v-menu>
        </header>

        <v-skeleton-loader
          v-if="isTranslationLoading"
          class="sapling-record-communication__loading"
          elevation="12"
          type="table"
        />

        <div v-else class="sapling-record-communication__table-scroll">
          <SaplingTable
            :items="items"
            :search="search ?? ''"
            :page="page"
            :items-per-page="itemsPerPage"
            :total-items="totalItems"
            :is-loading="isLoading"
            :is-initialized="isInitialized"
            :sort-by="sortBy"
            :column-filters="columnFilters"
            :active-filter="activeFilter"
            :entity-handle="communicationEntityHandle"
            :entity="entity"
            :entity-permission="entityPermission"
            :entity-templates="entityTemplates || []"
            :show-actions="true"
            :allow-delete-actions="false"
            :multi-select="false"
            :show-favorite="false"
            :show-add="false"
            :show-import="false"
            :show-form-config="false"
            :show-selection-toolbar="false"
            :parent-filter="parentFilter"
            :table-key="`${communicationEntityHandle}-${recordEntityHandle}-${referenceHandle}`"
            @update:search="onSearchUpdate"
            @update:page="onPageUpdate"
            @update:items-per-page="onItemsPerPageUpdate"
            @update:sort-by="onSortByUpdate"
            @update:column-filters="onColumnFiltersUpdate"
            @reload="loadData"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DEFAULT_PAGE_SIZE_SMALL } from '@/constants/project.constants'
import { useSaplingMailDialog } from '@/composables/dialog/useSaplingMailDialog'
import { useSaplingPhoneDialog } from '@/composables/dialog/useSaplingPhoneDialog'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import { useSaplingTable } from '@/composables/table/useSaplingTable'
import type { SaplingMailMenuAction } from '@/composables/context/useSaplingContextMenuTable'
import type { SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'

const SaplingTable = defineAsyncComponent(() => import('@/components/table/SaplingTable.vue'))

const props = withDefaults(
  defineProps<{
    kind: 'email' | 'phoneCall'
    item: SaplingGenericItem | null
    draftValues?: Record<string, unknown>
    recordEntityHandle: string
    recordEntityTemplates?: EntityTemplate[]
    canCreate: boolean
    phoneNumber?: string
    emailActions?: SaplingMailMenuAction[]
    recordLabel?: string
  }>(),
  {
    draftValues: undefined,
    phoneNumber: '',
    emailActions: () => [],
    recordLabel: '',
  },
)

const { t, te } = useI18n()
const { isLoading: isTranslationLoading } = useTranslationLoader(
  'global',
  'navigation',
  'navigationGroup',
  'mail',
  'phoneCall',
  'emailDelivery',
)
const { isOpen: isMailDialogOpen, openMailDialog } = useSaplingMailDialog()
const { isOpen: isPhoneDialogOpen, openPhoneDialog } = useSaplingPhoneDialog()
const launchedDialog = ref(false)

const isPhoneCall = computed(() => props.kind === 'phoneCall')
const communicationEntityHandle = computed(() =>
  isPhoneCall.value ? 'phoneCall' : 'emailDelivery',
)
const communicationEntityHandleRef = ref(communicationEntityHandle.value)
const referenceHandle = computed(() => {
  const handle = props.item?.handle
  return handle == null ? '' : String(handle)
})
const referenceField = computed(() => (isPhoneCall.value ? 'reference' : 'referenceHandle'))
const recordFilter = computed(() => ({
  entity: props.recordEntityHandle,
  [referenceField.value]: referenceHandle.value,
}))
const recordEntityLabel = computed(() => {
  const key = `navigation.${props.recordEntityHandle}`
  return te(key) ? t(key) : props.recordEntityHandle
})
const title = computed(() => {
  if (isPhoneCall.value) {
    return t('navigation.phoneCall')
  }

  return t('navigationGroup.mails')
})
const icon = computed(() =>
  isPhoneCall.value ? 'mdi-phone-log-outline' : 'mdi-email-multiple-outline',
)
const actionLabel = computed(() => (isPhoneCall.value ? t('phoneCall.call') : t('mail.compose')))
const actionIcon = computed(() =>
  isPhoneCall.value ? 'mdi-phone-outline' : 'mdi-email-edit-outline',
)

const table = useSaplingTable(communicationEntityHandleRef, DEFAULT_PAGE_SIZE_SMALL, false, false)

const {
  items,
  search,
  page,
  itemsPerPage,
  totalItems,
  isLoading,
  sortBy,
  columnFilters,
  activeFilter,
  entityTemplates,
  entity,
  entityPermission,
  isInitialized,
  loadData,
  initializeEntityState,
  onSearchUpdate,
  onPageUpdate,
  onItemsPerPageUpdate,
  onColumnFiltersUpdate,
  onSortByUpdate,
  parentFilter,
} = table

onMounted(() => {
  void initializeEntityState({
    beforeInitialLoad: () => {
      parentFilter.value = { ...recordFilter.value }
    },
  })
})

watch(
  () => JSON.stringify(recordFilter.value),
  () => {
    parentFilter.value = { ...recordFilter.value }
    page.value = 1
    void loadData()
  },
)

watch(isMailDialogOpen, (isOpen, wasOpen) => {
  if (props.kind === 'email' && wasOpen && !isOpen && launchedDialog.value) {
    launchedDialog.value = false
    void loadData()
  }
})

watch(isPhoneDialogOpen, (isOpen, wasOpen) => {
  if (props.kind === 'phoneCall' && wasOpen && !isOpen && launchedDialog.value) {
    launchedDialog.value = false
    void loadData()
  }
})

function createCommunication(mailAction?: SaplingMailMenuAction) {
  if (!props.canCreate || !referenceHandle.value) {
    return
  }

  launchedDialog.value = true

  if (isPhoneCall.value) {
    if (!props.phoneNumber) {
      launchedDialog.value = false
      return
    }

    openPhoneDialog({
      phoneNumber: props.phoneNumber,
      entityHandle: props.recordEntityHandle,
      itemHandle: referenceHandle.value,
      draftValues: props.draftValues,
      entityTemplates: props.recordEntityTemplates,
      recordLabel: props.recordLabel,
    })
    return
  }

  const selectedEmail = mailAction?.email.trim()
  if (!selectedEmail) {
    launchedDialog.value = false
    return
  }

  openMailDialog({
    entityHandle: props.recordEntityHandle,
    itemHandle: referenceHandle.value,
    draftValues: props.draftValues,
    initialTo: [selectedEmail],
    recordLabel: mailAction?.recipientName?.trim() || props.recordLabel,
  })
}

function resolveMailActionLabel(mailAction: SaplingMailMenuAction): string {
  const recipientName = mailAction.recipientName?.trim()
  if (recipientName) {
    return `${actionLabel.value}: ${recipientName}`
  }

  const fieldLabel = mailAction.fieldLabel?.trim() || mailAction.templateName
  const translationKey = `${props.recordEntityHandle}.${fieldLabel}`
  return `${actionLabel.value}: ${te(translationKey) ? t(translationKey) : fieldLabel}`
}
</script>
