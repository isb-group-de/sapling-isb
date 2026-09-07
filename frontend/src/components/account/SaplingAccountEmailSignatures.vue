<template>
  <section class="sapling-account-dialog__panel-stack">
    <h3 class="sapling-account-dialog__panel-title">{{ $t('navigation.emailSignature') }}</h3>
    <v-progress-linear v-if="loading" indeterminate />
    <template v-else-if="canRead">
      <p>{{ $t('mail.signatureSettingsHelp') }}</p>
      <SaplingMailSignatureSelection
        v-model:rotation="settings.signatureRotation"
        v-model:signature-handle="settings.defaultSignatureHandle"
        :signatures="signatures"
        :disabled="busy || impersonating"
      />
      <SaplingAutocomplete
        v-if="settings.signatureRotation"
        v-model="settings.defaultSignatureHandle"
        autocomplete="off"
        :items="signatures.filter((item) => item.isActive)"
        item-title="name"
        item-value="handle"
        :label="$t('mail.fixedSignature')"
        :hint="$t('mail.fixedSignatureFallback')"
        persistent-hint
        :disabled="busy || impersonating"
      />
      <v-btn
        :disabled="impersonating"
        :loading="busy"
        prepend-icon="mdi-content-save-outline"
        @click="saveSettings"
      >
        {{ $t('mail.saveSignatureSettings') }}
      </v-btn>
      <v-table>
        <thead>
          <tr>
            <th>{{ $t('emailSignature.name') }}</th>
            <th>{{ $t('emailSignature.isActive') }}</th>
            <th>{{ $t('emailSignature.useInRotation') }}</th>
            <th>{{ $t('mail.signatureActions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="signature in signatures" :key="signature.handle">
            <td>{{ signature.name }}</td>
            <td>{{ $t(signature.isActive ? 'global.yes' : 'global.no') }}</td>
            <td>{{ $t(signature.useInRotation ? 'global.yes' : 'global.no') }}</td>
            <td>
              <v-btn v-if="canUpdate" variant="text" :disabled="busy" @click="edit(signature)">{{
                $t('mail.editSignature')
              }}</v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>
      <v-btn v-if="canInsert" prepend-icon="mdi-plus" :disabled="busy" @click="edit()">{{
        $t('mail.addSignature')
      }}</v-btn>
      <v-form
        v-if="draft"
        autocomplete="off"
        class="sapling-account-dialog__panel-stack"
        @submit.prevent="saveSignature"
      >
        <SaplingTextField
          v-model="draft.name"
          autocomplete="off"
          :label="$t('emailSignature.name')"
          :maxlength="128"
          :disabled="busy"
        />
        <SaplingFieldMarkdown
          v-model="draft.bodyMarkdown"
          :label="$t('emailSignature.bodyMarkdown')"
          :rows="5"
        />
        <SaplingSwitch
          v-model="draft.isActive"
          :label="$t('emailSignature.isActive')"
          :disabled="busy"
          hide-details
        />
        <SaplingSwitch
          v-model="draft.useInRotation"
          :label="$t('emailSignature.useInRotation')"
          :disabled="busy"
          hide-details
        />
        <div class="d-flex ga-2 flex-wrap">
          <v-btn
            type="submit"
            color="primary"
            :loading="busy"
            :disabled="
              !draft.name.trim() || !draft.bodyMarkdown.trim() || draft.bodyMarkdown.length > 8192
            "
            >{{ $t('mail.saveSignature') }}</v-btn
          >
          <v-btn :disabled="busy" @click="draft = null">{{ $t('global.cancel') }}</v-btn>
          <v-btn
            v-if="draft.handle && canDelete"
            color="error"
            variant="text"
            :disabled="busy"
            @click="deleteSignature"
            >{{ $t('mail.deleteSignature') }}</v-btn
          >
        </div>
      </v-form>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import SaplingAutocomplete from '@/components/common/SaplingAutocomplete.vue'
import SaplingTextField from '@/components/common/SaplingTextField.vue'
import SaplingSwitch from '@/components/common/SaplingSwitch.vue'
import SaplingFieldMarkdown from '@/components/dialog/fields/SaplingFieldMarkdown.vue'
import SaplingMailSignatureSelection from '@/components/dialog/mail/SaplingMailSignatureSelection.vue'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import { useCurrentPermissionStore } from '@/stores/currentPermissionStore'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import ApiGenericService from '@/services/api.generic.service'
import {
  loadMailSignatureSettings,
  saveMailSignatureSettings,
  type EmailSignature,
  type MailSignatureSettings,
} from '@/services/api.mail-signature.service'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'

useTranslationLoader('mail', 'emailSignature', 'navigation', 'global')
const permissions = useCurrentPermissionStore()
const person = useCurrentPersonStore()
const { pushMessage } = useSaplingMessageCenter()
const impersonating = computed(() => person.isImpersonating)
const permission = computed(() =>
  permissions.accumulatedPermission?.find((item) => item.entityHandle === 'emailSignature'),
)
const canRead = computed(() => permission.value?.allowRead)
const canInsert = computed(() => permission.value?.allowInsert && !impersonating.value)
const canUpdate = computed(() => permission.value?.allowUpdate && !impersonating.value)
const canDelete = computed(() => permission.value?.allowDelete && !impersonating.value)
const signatures = ref<EmailSignature[]>([])
const settings = ref<MailSignatureSettings>({
  signatureRotation: true,
  defaultSignatureHandle: null,
})
const draft = ref<(Omit<EmailSignature, 'handle'> & { handle?: number }) | null>(null)
const loading = ref(true)
const busy = ref(false)

async function reloadSignatures() {
  signatures.value = await ApiGenericService.findAll<EmailSignature>('emailSignature', {
    orderBy: { name: 'ASC' },
  })
  if (
    !signatures.value.some(
      (item) => item.isActive && item.handle === settings.value.defaultSignatureHandle,
    )
  ) {
    settings.value.defaultSignatureHandle = null
  }
}
async function reload() {
  const [items, preferences] = await Promise.all([
    ApiGenericService.findAll<EmailSignature>('emailSignature', { orderBy: { name: 'ASC' } }),
    loadMailSignatureSettings(),
  ])
  signatures.value = items
  settings.value = preferences
}
onMounted(async () => {
  try {
    await permissions.fetchCurrentPermission()
    if (canRead.value) await reload()
  } catch {
    /* API services report the error. */
  } finally {
    loading.value = false
  }
})
function edit(signature?: EmailSignature) {
  draft.value = signature
    ? {
        handle: signature.handle,
        name: signature.name,
        bodyMarkdown: signature.bodyMarkdown,
        isActive: signature.isActive,
        useInRotation: signature.useInRotation,
      }
    : { name: '', bodyMarkdown: '', isActive: true, useInRotation: true }
}
async function run(action: () => Promise<unknown>) {
  if (busy.value || impersonating.value) return
  busy.value = true
  try {
    await action()
  } catch {
    /* API services report the error. */
  } finally {
    busy.value = false
  }
}
async function saveSettings() {
  await run(async () => {
    settings.value = await saveMailSignatureSettings(settings.value)
    pushMessage('success', 'mail.signatureSettingsSaved', 'mail.signatureSettingsSaved', 'mail')
  })
}
async function saveSignature() {
  const current = draft.value
  if (!current || !current.name.trim() || !current.bodyMarkdown.trim()) return
  await run(async () => {
    const { handle, ...payload } = current
    if (handle) await ApiGenericService.update('emailSignature', handle, payload)
    else await ApiGenericService.create('emailSignature', payload)
    draft.value = null
    await reloadSignatures()
  })
}
async function deleteSignature() {
  const handle = draft.value?.handle
  if (!handle || !canDelete.value) return
  await run(async () => {
    await ApiGenericService.delete('emailSignature', handle)
    draft.value = null
    await reloadSignatures()
  })
}
</script>
