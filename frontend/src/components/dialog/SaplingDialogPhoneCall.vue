<template>
  <SaplingDialog
    :model-value="isOpen"
    size="xxl"
    :height="SAPLING_DIALOG_HEIGHT.xl"
    @update:model-value="handleVisibilityChange"
  >
    <SaplingDialogCard
      class="sapling-message-dialog sapling-phone-call-dialog"
      :tilt="false"
      :close="closePhoneDialogAndDiscard"
    >
      <div class="sapling-message-dialog__shell sapling-phone-call-dialog__shell">
        <v-card-title class="sapling-message-dialog__header sapling-phone-call-dialog__header">
          <SaplingDialogHero
            :loading="isTranslationLoading"
            :eyebrow="translate('phoneCall.title')"
            :title="dialogTitle"
            :subtitle="dialogSubtitle"
          />
        </v-card-title>

        <v-card-text class="sapling-message-dialog__content sapling-phone-call-dialog__content">
          <div class="sapling-message-dialog__scroll sapling-phone-call-dialog__scroll">
            <v-skeleton-loader
              v-if="isTranslationLoading"
              class="sapling-message-dialog__form sapling-phone-call-dialog__form"
              type="article, article, article"
            />

            <div v-else class="sapling-message-dialog__form sapling-phone-call-dialog__form">
              <v-alert v-if="warningMessage" type="info" variant="tonal">
                {{ warningMessage }}
              </v-alert>

              <SaplingTextField
                :model-value="phoneNumber"
                :label="translate('phoneCall.phoneNumber')"
                prepend-inner-icon="mdi-phone"
                readonly
                hide-details="auto"
              />

              <SaplingMarkdownField v-model="note" :label="translate('phoneCall.note')" :rows="6" />

              <SaplingCheckbox
                v-model="reached"
                :label="translate('phoneCall.reached')"
                hide-details
              />
            </div>
          </div>
        </v-card-text>

        <SaplingActionBar v-if="!isTranslationLoading">
          <template #leading>
            <v-btn variant="text" prepend-icon="mdi-close" @click="closePhoneDialogAndDiscard">
              <template v-if="$vuetify.display.mdAndUp">{{ translate('global.close') }}</template>
            </v-btn>
          </template>

          <template #trailing>
            <v-btn
              color="primary"
              variant="tonal"
              prepend-icon="mdi-phone"
              :disabled="!canCall"
              @click="startCall"
            >
              <template v-if="$vuetify.display.mdAndUp">{{ translate('phoneCall.call') }}</template>
            </v-btn>
            <v-btn
              color="primary"
              prepend-icon="mdi-content-save"
              :loading="isSaving"
              :disabled="!canSave"
              @click="savePhoneCall"
            >
              <template v-if="$vuetify.display.mdAndUp">{{ translate('global.save') }}</template>
            </v-btn>
          </template>
        </SaplingActionBar>
        <SaplingActionBarSkeleton v-else :leading="1" :trailing="2" />
      </div>
    </SaplingDialogCard>
  </SaplingDialog>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingCheckbox from '@/components/common/SaplingCheckbox.vue'
import SaplingTextField from '@/components/common/SaplingTextField.vue'
import SaplingActionBar from '@/components/actions/SaplingActionBar.vue'
import SaplingActionBarSkeleton from '@/components/actions/SaplingActionBarSkeleton.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingDialogHero from '@/components/common/SaplingDialogHero.vue'
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import SaplingMarkdownField from '@/components/dialog/fields/SaplingFieldMarkdown.vue'
import { SAPLING_DIALOG_HEIGHT } from '@/constants/dialog.constants'
import {
  resolvePhoneDialogSubject,
  useSaplingPhoneDialog,
} from '@/composables/dialog/useSaplingPhoneDialog'
import { useSaplingPhoneNumber } from '@/composables/phone/useSaplingPhoneNumber'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import type { PhoneCallItem } from '@/entity/entity'
import ApiGenericService from '@/services/api.generic.service'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import {
  clearSaplingDialogDraft,
  getCurrentDialogDraftRoute,
  normalizeDialogDraftIdentifier,
  readSaplingDialogDraft,
  writeSaplingDialogDraft,
  type SaplingDialogDraftContext,
} from '@/composables/dialog/saplingDialogDraftStorage'

const { t, te } = useI18n()
const { isOpen, context, closePhoneDialog } = useSaplingPhoneDialog()
const currentPersonStore = useCurrentPersonStore()
const { pushMessage } = useSaplingMessageCenter()
const { isLoading: isTranslationLoading, loadTranslations } = useTranslationLoader(
  'global',
  'navigation',
  'phoneCall',
)
const { formatPhoneNumber } = useSaplingPhoneNumber()

const note = ref('')
const reached = ref(false)
const isSaving = ref(false)
const activeDraftContext = ref<SaplingDialogDraftContext | null>(null)
let restoreRequestId = 0

const phoneNumber = computed(() => formatPhoneNumber(context.value?.phoneNumber ?? ''))
const hasPhoneNumber = computed(() => phoneNumber.value.length > 0)
const hasSavedRecord = computed(() => context.value?.itemHandle != null)
const hasEntityContext = computed(
  () => typeof context.value?.entityHandle === 'string' && context.value.entityHandle.length > 0,
)
const canCall = computed(() => hasPhoneNumber.value)
const canSave = computed(
  () => hasPhoneNumber.value && hasSavedRecord.value && hasEntityContext.value && !isSaving.value,
)

const dialogTitle = computed(
  () => resolvePhoneDialogSubject(context.value) || translate('phoneCall.call'),
)
const dialogSubtitle = computed(() => {
  const entityHandle = context.value?.entityHandle
  const itemHandle = context.value?.itemHandle
  if (!entityHandle) {
    return ''
  }

  const entityLabel = translateIfExists(`navigation.${entityHandle}`, entityHandle)
  return itemHandle == null ? entityLabel : `${entityLabel} #${String(itemHandle)}`
})

const warningMessage = computed(() => {
  if (!hasPhoneNumber.value) {
    return translate('phoneCall.phoneNumberRequired')
  }

  if (!hasSavedRecord.value || !hasEntityContext.value) {
    return translate('phoneCall.requiresSavedRecord')
  }

  return ''
})

watch(
  () => [isOpen.value, context.value] as const,
  async ([open]) => {
    const requestId = ++restoreRequestId
    if (open) {
      const route = getCurrentDialogDraftRoute()
      await Promise.all([loadTranslations(), currentPersonStore.fetchCurrentPerson()])
      if (requestId !== restoreRequestId || !isOpen.value) {
        return
      }

      const draftContext = createDraftContext(route)
      activeDraftContext.value = draftContext
      const draft = readSaplingDialogDraft('phoneCall', draftContext)
      note.value = typeof draft?.note === 'string' ? draft.note : ''
      reached.value = draft?.reached === true
      return
    }

    note.value = ''
    reached.value = false
    isSaving.value = false
    activeDraftContext.value = null
  },
  { immediate: true },
)

watch(
  [note, reached],
  () => {
    const draftContext = activeDraftContext.value
    if (!isOpen.value || !draftContext) {
      return
    }

    if (!note.value && !reached.value) {
      clearSaplingDialogDraft('phoneCall', draftContext)
      return
    }

    writeSaplingDialogDraft('phoneCall', draftContext, {
      note: note.value,
      reached: reached.value,
    })
  },
  { flush: 'post' },
)

function createDraftContext(route = getCurrentDialogDraftRoute()): SaplingDialogDraftContext {
  return {
    route,
    personHandle: normalizeDialogDraftIdentifier(currentPersonStore.person?.handle),
    entityHandle: context.value?.entityHandle ?? '',
    mode: 'create',
    recordHandle: normalizeDialogDraftIdentifier(context.value?.itemHandle),
    recordVersion: normalizeDialogDraftIdentifier(context.value?.draftValues?.updatedAt),
    parentEntityHandle: '',
    parentRecordHandle: '',
    detailHandle: phoneNumber.value,
    detailVersion: '',
  }
}

function closePhoneDialogAndDiscard() {
  clearSaplingDialogDraft('phoneCall', activeDraftContext.value)
  closePhoneDialog()
}

function translate(key: string) {
  return t(key)
}

function translateIfExists(key: string, fallback: string) {
  return te(key) ? t(key) : fallback
}

function handleVisibilityChange(value: boolean) {
  if (!value) {
    closePhoneDialogAndDiscard()
  }
}

async function startCall() {
  if (!canCall.value) {
    return
  }

  window.open(`tel:${phoneNumber.value}`, '_self')
}

async function savePhoneCall() {
  if (!canSave.value || !context.value?.entityHandle || context.value.itemHandle == null) {
    return
  }

  isSaving.value = true

  try {
    await currentPersonStore.fetchCurrentPerson()

    const personHandle = currentPersonStore.person?.handle
    if (personHandle == null) {
      pushMessage('error', 'global.entityNotFound', '', 'phoneCall')
      return
    }

    await ApiGenericService.create<PhoneCallItem>('phoneCall', {
      phoneNumber: phoneNumber.value,
      note: note.value.trim() || null,
      reached: reached.value,
      entity: context.value.entityHandle,
      reference: String(context.value.itemHandle),
      person: personHandle,
    })

    clearSaplingDialogDraft('phoneCall', activeDraftContext.value)
    closePhoneDialog()
  } catch {
    return
  } finally {
    isSaving.value = false
  }
}
</script>
