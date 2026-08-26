<template>
  <SaplingDialog v-model="visible" size="xl" persistent>
    <SaplingDialogCard :close="close" :close-disabled="saving" :tilt="false">
      <SaplingDialogShell fill-shell body-class="sapling-dialog-fill-body">
        <template #hero>
          <SaplingDialogHero
            :title="$t('navigation.fieldPermission')"
            :eyebrow="`${role.title} · ${$t(`navigation.${entity.handle}`)}`"
            :loading="loading"
            :stats="[{ label: $t('permission.restrictedFields'), value: restrictedCount }]"
            :stats-columns="1"
          />
        </template>

        <template #body>
          <div class="sapling-stack-md sapling-scrollable pa-4">
            <v-alert v-if="catalog?.staleOverrides.length" type="info" variant="tonal">
              {{ $t('permission.staleFieldPermissions') }}:
              {{ catalog.staleOverrides.map((entry) => entry.fieldName).join(', ') }}
            </v-alert>

            <div class="sapling-split-toolbar">
              <SaplingTextField
                v-model="search"
                :label="$t('global.search')"
                prepend-inner-icon="mdi-magnify"
                hide-details
              />
              <v-btn variant="tonal" prepend-icon="mdi-restore" @click="resetInheritance">
                {{ $t('permission.inherit') }}
              </v-btn>
            </div>

            <v-progress-linear v-if="loading" indeterminate />
            <v-table v-else density="comfortable" class="sapling-admin-matrix">
              <thead>
                <tr>
                  <th>{{ $t('fieldPermission.fieldName') }}</th>
                  <th v-for="action in actions" :key="action.key" class="text-center">
                    <div class="d-inline-flex align-center ga-1">
                      {{ $t(action.label) }}
                      <SaplingHelpTooltip
                        :text="$t(`${action.label}Tooltip`)"
                        :aria-label="$t(action.label)"
                        icon-size="16"
                      />
                    </div>
                    <div class="d-flex justify-center ga-1">
                      <v-btn size="x-small" variant="text" @click="setAll(action.key, true)">{{
                        $t('right.all')
                      }}</v-btn>
                      <v-btn size="x-small" variant="text" @click="setAll(action.key, false)">{{
                        $t('right.none')
                      }}</v-btn>
                      <v-btn
                        size="x-small"
                        variant="text"
                        icon="mdi-restore"
                        :title="$t('permission.inherit')"
                        @click="restoreColumn(action.key)"
                      />
                    </div>
                  </th>
                  <th class="sapling-field-warning-column" aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                <template v-for="group in filteredFieldGroups" :key="group.name">
                  <tr class="sapling-field-permission-group">
                    <td :colspan="actions.length + 2" class="font-weight-medium">
                      {{ group.label }}
                    </td>
                  </tr>
                  <tr v-for="field in group.fields" :key="field.name">
                    <td>
                      <span class="font-weight-medium">{{ fieldLabel(field.name) }}</span>
                      <v-chip
                        v-if="field.isHandle || field.isRequired"
                        class="sapling-field-required-marker"
                        color="error"
                        size="x-small"
                        :title="$t('global.isRequired')"
                      >
                        *
                      </v-chip>
                    </td>
                    <td
                      v-for="action in actions"
                      :key="`${field.name}-${action.key}`"
                      class="text-center"
                    >
                      <SaplingCheckbox
                        v-model="draft[field.name][action.key]"
                        :disabled="
                          !field.structural[action.key] || !catalog?.entityPermission[action.key]
                        "
                        hide-details
                        density="compact"
                      />
                    </td>
                    <td class="sapling-field-warning-column text-center">
                      <SaplingHelpTooltip
                        v-if="hasRiskyRestriction(field)"
                        :text="$t('permission.fieldPermissionWarning')"
                        :aria-label="$t('permission.fieldPermissionWarning')"
                        location="start"
                        :max-width="420"
                        compact
                      >
                        <template #activator="{ props: tooltipProps }">
                          <button
                            v-bind="tooltipProps"
                            type="button"
                            class="sapling-field-warning"
                            :aria-label="$t('permission.fieldPermissionWarning')"
                            @click.stop
                          >
                            <v-icon icon="mdi-alert-circle" color="warning" size="20" />
                          </button>
                        </template>
                      </SaplingHelpTooltip>
                    </td>
                  </tr>
                </template>
              </tbody>
            </v-table>
          </div>
        </template>

        <template #actions>
          <SaplingActionSave
            :cancel="close"
            :save="save"
            :save-loading="saving"
            :busy="loading || saving"
          />
        </template>
      </SaplingDialogShell>
    </SaplingDialogCard>
  </SaplingDialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { EntityItem, RoleItem } from '@/entity/entity'
import { useI18n } from 'vue-i18n'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import SaplingDialogShell from '@/components/common/SaplingDialogShell.vue'
import SaplingDialogHero from '@/components/common/SaplingDialogHero.vue'
import SaplingCheckbox from '@/components/common/SaplingCheckbox.vue'
import SaplingActionSave from '@/components/actions/SaplingActionSave.vue'
import SaplingHelpTooltip from '@/components/common/SaplingHelpTooltip.vue'
import SaplingTextField from '@/components/common/SaplingTextField.vue'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import ApiFieldPermissionService, {
  type FieldPermissionActionKey,
  type FieldPermissionCatalog,
} from '@/services/api.field-permission.service'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'

const props = defineProps<{ modelValue: boolean; role: RoleItem; entity: EntityItem }>()
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'saved', restrictedCount: number): void
}>()
const { t } = useI18n()
const { pushMessage } = useSaplingMessageCenter()
const { translationService } = useTranslationLoader(
  'global',
  'navigation',
  'permission',
  'fieldPermission',
  'right',
)
const catalog = ref<FieldPermissionCatalog | null>(null)
const draft = reactive<Record<string, Record<FieldPermissionActionKey, boolean>>>({})
const search = ref('')
const loading = ref(false)
const saving = ref(false)
const actions = [
  { key: 'allowRead', label: 'right.canRead' },
  { key: 'allowInsert', label: 'right.canInsert' },
  { key: 'allowUpdate', label: 'right.canUpdate' },
] as const

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
const filteredFields = computed(() => {
  const query = search.value.trim().toLowerCase()
  return (catalog.value?.fields ?? []).filter(
    (field) =>
      !query ||
      field.name.toLowerCase().includes(query) ||
      fieldLabel(field.name).toLowerCase().includes(query),
  )
})
const filteredFieldGroups = computed(() => {
  const groups = new Map<string, typeof filteredFields.value>()
  for (const field of filteredFields.value) {
    const name = field.formGroup?.trim() || 'global.other'
    const fields = groups.get(name) ?? []
    fields.push(field)
    groups.set(name, fields)
  }
  return [...groups.entries()].map(([name, fields]) => ({
    name,
    label: groupLabel(name),
    fields,
  }))
})
const restrictedCount = computed(
  () =>
    Object.values(draft).filter(
      (field) => !field.allowRead || !field.allowInsert || !field.allowUpdate,
    ).length,
)
watch(
  () => [props.modelValue, props.role.handle, props.entity.handle] as const,
  ([isOpen]) => {
    if (isOpen) void load()
  },
  { immediate: true },
)

async function load() {
  if (typeof props.role.handle !== 'number') return
  loading.value = true
  try {
    const [, nextCatalog] = await Promise.all([
      translationService.value.prepare(props.entity.handle),
      ApiFieldPermissionService.getCatalog(props.role.handle, props.entity.handle),
    ])
    catalog.value = nextCatalog
    for (const key of Object.keys(draft)) delete draft[key]
    for (const field of catalog.value.fields) {
      draft[field.name] = {
        allowRead: field.override?.allowRead ?? true,
        allowInsert: field.override?.allowInsert ?? true,
        allowUpdate: field.override?.allowUpdate ?? true,
      }
    }
  } catch {
    catalog.value = null
  } finally {
    loading.value = false
  }
}

function fieldLabel(fieldName: string) {
  const key = `${props.entity.handle}.${fieldName}`
  const translated = t(key).trim()
  return translated && translated !== key ? translated : fieldName
}

function groupLabel(groupName: string) {
  const translated = t(groupName).trim()
  if (translated && translated !== groupName) return translated
  if (groupName === 'global.other') return 'Allgemein'

  const segment =
    groupName
      .split('.')
      .pop()
      ?.replace(/^group/, '') || groupName
  return segment
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase())
}

function hasRiskyRestriction(field: FieldPermissionCatalog['fields'][number]) {
  const access = draft[field.name]
  return (
    (field.isHandle ||
      field.isRequired ||
      field.isReference ||
      field.options.includes('isValue')) &&
    (!access?.allowRead || !access?.allowInsert || !access?.allowUpdate)
  )
}

function setAll(action: FieldPermissionActionKey, value: boolean) {
  for (const field of catalog.value?.fields ?? []) {
    if (field.structural[action] && catalog.value?.entityPermission[action]) {
      draft[field.name][action] = value
    }
  }
}

function restoreColumn(action: FieldPermissionActionKey) {
  for (const field of catalog.value?.fields ?? []) {
    draft[field.name][action] = true
  }
}

function resetInheritance() {
  for (const field of Object.values(draft)) {
    field.allowRead = true
    field.allowInsert = true
    field.allowUpdate = true
  }
}

async function save() {
  if (typeof props.role.handle !== 'number') return
  saving.value = true
  try {
    catalog.value = await ApiFieldPermissionService.saveOverrides(
      props.role.handle,
      props.entity.handle,
      Object.entries(draft).map(([fieldName, access]) => ({ fieldName, ...access })),
    )
    pushMessage('success', 'permission.saved', '', 'fieldPermission')
    emit('saved', restrictedCount.value)
    close()
  } catch {
    return
  } finally {
    saving.value = false
  }
}

function close() {
  visible.value = false
}
</script>

<style scoped>
.sapling-field-permission-group > td {
  background: rgba(var(--v-theme-primary), 0.14) !important;
  color: rgb(var(--v-theme-on-surface));
  letter-spacing: 0.025em;
}

.sapling-field-required-marker {
  margin-inline-start: 0.3rem;
  vertical-align: text-bottom;
}

.sapling-field-warning-column {
  width: 3rem;
  min-width: 3rem;
  padding-inline: var(--sapling-gap-sm) !important;
}

.sapling-field-warning {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  cursor: help;
}

.sapling-field-warning:hover,
.sapling-field-warning:focus-visible {
  background: rgba(var(--v-theme-warning), 0.12);
}

.sapling-field-warning:focus-visible {
  outline: 2px solid rgb(var(--v-theme-warning));
  outline-offset: 1px;
}
</style>
