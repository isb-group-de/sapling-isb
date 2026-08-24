<template>
  <SaplingDialog
    v-if="dialog"
    v-model="dialog"
    :persistent="isBusy"
    size="xl"
    @keydown.esc.stop.prevent="isBusy ? undefined : closeDialog()"
  >
    <SaplingDialogCard
      class="sapling-permission-provider-dialog"
      :tilt="false"
      :close="closeDialog"
      :close-disabled="isBusy"
    >
      <SaplingDialogShell
        fill-shell
        body-class="sapling-dialog-fill-body sapling-permission-provider-dialog__body"
        :show-divider="false"
      >
        <template #hero>
          <SaplingDialogHero
            :eyebrow="$t('providerUserImport.eyebrow')"
            :title="$t('providerUserImport.title')"
            :stats="heroStats"
            :stats-columns="3"
            stats-layout="compact"
          />
        </template>

        <template #body>
          <div class="sapling-dialog-fill-content sapling-permission-provider-dialog__content">
            <div class="sapling-split-toolbar sapling-permission-provider-dialog__toolbar">
              <v-btn-toggle
                v-model="provider"
                class="sapling-toolbar-toggle sapling-permission-provider-dialog__provider-toggle"
                color="primary"
                density="comfortable"
                mandatory
                :disabled="isSaving"
              >
                <v-btn value="azure" prepend-icon="mdi-microsoft-azure" variant="tonal">
                  {{ $t('providerUserImport.azure') }}
                </v-btn>
                <v-btn value="google" prepend-icon="mdi-google" variant="tonal">
                  {{ $t('providerUserImport.google') }}
                </v-btn>
              </v-btn-toggle>

              <SaplingTextField
                v-model="search"
                class="sapling-permission-provider-dialog__search"
                :label="$t('global.search')"
                autocomplete="off"
                density="comfortable"
                hide-details
                name="provider-user-import-search"
                prepend-inner-icon="mdi-magnify"
                spellcheck="false"
                :loading="isLoading"
                :disabled="isSaving"
                @keyup.enter="reloadUsersImmediately"
              />
            </div>

            <div class="sapling-permission-provider-dialog__assignment-grid">
              <SaplingFieldSelect
                v-model="selectedRoles"
                class="sapling-permission-provider-dialog__roles"
                entity-handle="role"
                :label="$t('providerUserImport.defaultRoles')"
                density="comfortable"
                hide-details
                :disabled="isSaving"
              />

              <SaplingFieldSingleSelect
                v-model="selectedCompany"
                class="sapling-permission-provider-dialog__company"
                entity-handle="company"
                :label="$t('person.company')"
                density="comfortable"
                hide-details
                :disabled="isSaving"
              />
            </div>

            <div class="sapling-permission-provider-dialog__list sapling-scrollable">
              <v-progress-linear v-if="isLoading" indeterminate color="primary" />

              <v-table v-if="users.length" density="comfortable">
                <thead>
                  <tr>
                    <th class="sapling-permission-provider-dialog__select-cell">
                      <SaplingCheckbox
                        :model-value="allVisibleUsersSelected"
                        hide-details
                        density="compact"
                        :disabled="isBusy"
                        @update:model-value="toggleAllVisibleUsers(!!$event)"
                      />
                    </th>
                    <th>{{ $t('providerUserImport.user') }}</th>
                    <th>{{ $t('person.email') }}</th>
                    <th>{{ $t('person.type') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="user in users" :key="user.id">
                    <td>
                      <SaplingCheckbox
                        :model-value="selectedUserIds.includes(user.id)"
                        hide-details
                        density="compact"
                        :disabled="isBusy"
                        @update:model-value="toggleUser(user.id, !!$event)"
                      />
                    </td>
                    <td>
                      <div class="sapling-permission-provider-dialog__user">
                        <strong>{{ user.displayName }}</strong>
                        <span class="text-medium-emphasis">{{ user.id }}</span>
                      </div>
                    </td>
                    <td>{{ user.email || user.userPrincipalName || '-' }}</td>
                    <td>
                      <v-chip
                        v-if="user.existingPersonHandle"
                        size="small"
                        color="primary"
                        variant="tonal"
                      >
                        {{ $t('providerUserImport.existingPerson') }}
                      </v-chip>
                      <v-chip v-else size="small" variant="outlined">
                        {{ $t('providerUserImport.newPerson') }}
                      </v-chip>
                    </td>
                  </tr>
                </tbody>
              </v-table>

              <div
                v-else-if="!isLoading"
                class="sapling-empty-state-panel sapling-empty-state-panel--compact"
              >
                {{ $t('providerUserImport.noUsers') }}
              </div>
            </div>

            <div class="sapling-row-between-xs sapling-permission-provider-dialog__footer">
              <v-btn
                variant="text"
                prepend-icon="mdi-chevron-down"
                :disabled="!nextPageToken || isBusy"
                :loading="isLoadingMore"
                @click="loadMoreUsers"
              >
                {{ $t('providerUserImport.loadMore') }}
              </v-btn>
            </div>
          </div>
        </template>

        <template #actions>
          <SaplingActionSave
            :cancel="closeDialog"
            :save="saveImport"
            :busy="isBusy"
            :save-disabled="!canSave"
            :save-loading="isSaving"
          />
        </template>
      </SaplingDialogShell>
    </SaplingDialogCard>
  </SaplingDialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import SaplingCheckbox from '@/components/common/SaplingCheckbox.vue'
import SaplingTextField from '@/components/common/SaplingTextField.vue'
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingDialogHero from '@/components/common/SaplingDialogHero.vue'
import SaplingDialogShell from '@/components/common/SaplingDialogShell.vue'
import SaplingActionSave from '@/components/actions/SaplingActionSave.vue'
import SaplingFieldSelect from '@/components/dialog/fields/SaplingFieldSelect.vue'
import SaplingFieldSingleSelect from '@/components/dialog/fields/SaplingFieldSingleSelect.vue'
import type { RoleItem, SaplingGenericItem } from '@/entity/entity'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import ApiProviderUsersService, {
  type ProviderUser,
  type ProviderUserImportResponse,
  type ProviderUserProvider,
} from '@/services/api.provider-users.service'
import { i18n } from '@/i18n'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'

const props = defineProps<{
  modelValue: boolean
  roles: RoleItem[]
  selectedRole: RoleItem | null
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'imported', result: ProviderUserImportResponse): void
}>()

const currentPersonStore = useCurrentPersonStore()
const messageCenter = useSaplingMessageCenter()
const provider = ref<ProviderUserProvider>('azure')
const search = ref('')
const users = ref<ProviderUser[]>([])
const selectedUserIds = ref<string[]>([])
const selectedRoles = ref<SaplingGenericItem[]>([])
const selectedCompany = ref<SaplingGenericItem | null>(null)
const nextPageToken = ref<string | null>(null)
const isLoading = ref(false)
const isLoadingMore = ref(false)
const isSaving = ref(false)
let searchDebounceTimeout: ReturnType<typeof setTimeout> | null = null
let activeLoadController: AbortController | null = null
let latestLoadRequestId = 0

const dialog = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const currentProvider = computed<ProviderUserProvider | null>(() => {
  const type = currentPersonStore.person?.type
  const handle = typeof type === 'object' ? type?.handle : type
  return handle === 'azure' || handle === 'google' ? handle : null
})

const isBusy = computed(() => isLoading.value || isLoadingMore.value || isSaving.value)
const selectedRoleHandles = computed(() =>
  selectedRoles.value
    .map((role) => getNumericHandle(role))
    .filter((handle): handle is number => typeof handle === 'number'),
)
const canSave = computed(
  () => selectedUserIds.value.length > 0 && selectedRoleHandles.value.length > 0 && !isBusy.value,
)
const allVisibleUsersSelected = computed(
  () =>
    users.value.length > 0 && users.value.every((user) => selectedUserIds.value.includes(user.id)),
)
const heroStats = computed(() => [
  { label: i18n.global.t('providerUserImport.loaded'), value: users.value.length },
  { label: i18n.global.t('providerUserImport.selected'), value: selectedUserIds.value.length },
  { label: i18n.global.t('providerUserImport.roles'), value: selectedRoleHandles.value.length },
])

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) {
      clearSearchDebounce()
      cancelActiveLoad()
      return
    }

    provider.value = currentProvider.value ?? 'azure'
    selectedRoles.value = props.selectedRole ? [props.selectedRole as SaplingGenericItem] : []
    selectedCompany.value = null
    selectedUserIds.value = []
    void reloadUsers()
  },
  { immediate: true },
)

watch(provider, () => {
  if (props.modelValue) {
    selectedUserIds.value = []
    reloadUsersImmediately()
  }
})

watch(search, () => {
  if (props.modelValue) {
    scheduleReloadUsers()
  }
})

onBeforeUnmount(() => {
  clearSearchDebounce()
  cancelActiveLoad()
})

function scheduleReloadUsers() {
  clearSearchDebounce()
  searchDebounceTimeout = setTimeout(() => {
    void reloadUsers()
  }, 350)
}

function clearSearchDebounce() {
  if (searchDebounceTimeout) {
    clearTimeout(searchDebounceTimeout)
    searchDebounceTimeout = null
  }
}

function reloadUsersImmediately() {
  clearSearchDebounce()
  void reloadUsers()
}

async function reloadUsers() {
  activeLoadController?.abort()
  const loadController = new AbortController()
  activeLoadController = loadController
  const requestId = ++latestLoadRequestId

  isLoading.value = true
  nextPageToken.value = null
  try {
    const response = await ApiProviderUsersService.list({
      provider: provider.value,
      search: search.value,
      signal: loadController.signal,
    })
    if (requestId !== latestLoadRequestId) {
      return
    }
    users.value = response.users
    nextPageToken.value = response.nextPageToken ?? null
  } catch (error: unknown) {
    if (isAbortError(error)) {
      return
    }
    users.value = []
  } finally {
    if (activeLoadController === loadController) {
      activeLoadController = null
      isLoading.value = false
    }
  }
}

async function loadMoreUsers() {
  if (!nextPageToken.value) {
    return
  }

  isLoadingMore.value = true
  try {
    const response = await ApiProviderUsersService.list({
      provider: provider.value,
      search: search.value,
      pageToken: nextPageToken.value,
    })
    const knownIds = new Set(users.value.map((user) => user.id))
    users.value = [...users.value, ...response.users.filter((user) => !knownIds.has(user.id))]
    nextPageToken.value = response.nextPageToken ?? null
  } catch {
    // API errors are reported by the provider-user service through the message center.
  } finally {
    isLoadingMore.value = false
  }
}

function toggleUser(userId: string, selected: boolean) {
  if (selected) {
    if (!selectedUserIds.value.includes(userId)) {
      selectedUserIds.value = [...selectedUserIds.value, userId]
    }
    return
  }

  selectedUserIds.value = selectedUserIds.value.filter((entry) => entry !== userId)
}

function toggleAllVisibleUsers(selected: boolean) {
  if (!selected) {
    const visibleIds = new Set(users.value.map((user) => user.id))
    selectedUserIds.value = selectedUserIds.value.filter((entry) => !visibleIds.has(entry))
    return
  }

  selectedUserIds.value = Array.from(
    new Set([...selectedUserIds.value, ...users.value.map((user) => user.id)]),
  )
}

async function saveImport() {
  if (!canSave.value) {
    return
  }

  isSaving.value = true
  try {
    const result = await ApiProviderUsersService.importUsers({
      provider: provider.value,
      userIds: selectedUserIds.value,
      roleHandles: selectedRoleHandles.value,
      companyHandle: getNumericHandle(selectedCompany.value),
    })
    messageCenter.pushMessage(
      'success',
      i18n.global.t('providerUserImport.result', {
        created: result.created,
        updated: result.updated,
        failed: result.failed,
      }),
      '',
      'providerUserImport',
    )
    emit('imported', result)
    selectedUserIds.value = []
  } catch {
    // API errors are reported by the provider-user service through the message center.
  } finally {
    isSaving.value = false
  }
}

function closeDialog() {
  dialog.value = false
}

function getNumericHandle(item: SaplingGenericItem | null | undefined): number | null {
  const handle = item?.handle
  return typeof handle === 'number' ? handle : null
}

function cancelActiveLoad() {
  activeLoadController?.abort()
  activeLoadController = null
}

function isAbortError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  const record = error as { code?: unknown; name?: unknown; message?: unknown }
  return (
    record.code === 'ERR_CANCELED' ||
    record.name === 'CanceledError' ||
    record.name === 'AbortError' ||
    record.message === 'canceled'
  )
}
</script>
