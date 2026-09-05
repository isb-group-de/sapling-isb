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
            <SaplingTableSurface
              v-if="!loading && !$vuetify.display.smAndDown"
              class="sapling-admin-matrix"
            >
              <thead>
                <tr>
                  <th
                    :aria-sort="
                      fieldSort === 'asc'
                        ? 'ascending'
                        : fieldSort === 'desc'
                          ? 'descending'
                          : 'none'
                    "
                  >
                    <button
                      type="button"
                      class="sapling-data-table__sort"
                      :aria-label="$t('fieldPermission.fieldName')"
                      @click="
                        fieldSort = fieldSort === null ? 'asc' : fieldSort === 'asc' ? 'desc' : null
                      "
                    >
                      {{ $t('fieldPermission.fieldName') }}
                      <v-icon
                        :icon="
                          fieldSort === 'asc'
                            ? 'mdi-arrow-up'
                            : fieldSort === 'desc'
                              ? 'mdi-arrow-down'
                              : 'mdi-swap-vertical'
                        "
                        size="16"
                      />
                    </button>
                  </th>
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
                        :aria-label="`${fieldLabel(field.name)}: ${$t(action.label)}`"
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
            </SaplingTableSurface>

            <div v-else-if="!loading" class="sapling-field-permission-mobile">
              <div class="sapling-field-permission-mobile__bulk">
                <section
                  v-for="action in actions"
                  :key="action.key"
                  class="sapling-field-permission-mobile__bulk-action"
                >
                  <div
                    class="sapling-field-permission-mobile__action-title"
                    :title="$t(action.label)"
                  >
                    <v-icon :icon="action.icon" size="18" />
                    <span class="sapling-visually-hidden">{{ $t(action.label) }}</span>
                    <SaplingHelpTooltip
                      :text="$t(`${action.label}Tooltip`)"
                      :aria-label="$t(action.label)"
                      icon-size="16"
                      compact
                    />
                  </div>
                  <div class="sapling-field-permission-mobile__bulk-buttons">
                    <v-btn
                      size="x-small"
                      variant="text"
                      icon="mdi-check-all"
                      :aria-label="`${$t(action.label)}: ${$t('right.all')}`"
                      :title="$t('right.all')"
                      @click="setAll(action.key, true)"
                    />
                    <v-btn
                      size="x-small"
                      variant="text"
                      icon="mdi-close-box-multiple-outline"
                      :aria-label="`${$t(action.label)}: ${$t('right.none')}`"
                      :title="$t('right.none')"
                      @click="setAll(action.key, false)"
                    />
                    <v-btn
                      size="x-small"
                      variant="text"
                      icon="mdi-restore"
                      :aria-label="`${$t(action.label)}: ${$t('permission.inherit')}`"
                      :title="$t('permission.inherit')"
                      @click="restoreColumn(action.key)"
                    />
                  </div>
                </section>
              </div>

              <section
                v-for="group in filteredFieldGroups"
                :key="group.name"
                class="sapling-field-permission-mobile__group"
              >
                <h3>{{ group.label }}</h3>
                <article
                  v-for="field in group.fields"
                  :key="field.name"
                  class="sapling-field-permission-mobile__field"
                >
                  <div class="sapling-field-permission-mobile__field-heading">
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
                    <SaplingHelpTooltip
                      v-if="hasRiskyRestriction(field)"
                      :text="$t('permission.fieldPermissionWarning')"
                      :aria-label="$t('permission.fieldPermissionWarning')"
                      :max-width="320"
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
                  </div>

                  <div class="sapling-field-permission-mobile__permissions">
                    <label
                      v-for="action in actions"
                      :key="`${field.name}-${action.key}`"
                      class="sapling-field-permission-mobile__permission"
                    >
                      <span>{{ $t(action.label) }}</span>
                      <SaplingCheckbox
                        v-model="draft[field.name][action.key]"
                        :aria-label="`${fieldLabel(field.name)}: ${$t(action.label)}`"
                        :disabled="
                          !field.structural[action.key] || !catalog?.entityPermission[action.key]
                        "
                        hide-details
                        density="compact"
                      />
                    </label>
                  </div>
                </article>
              </section>
            </div>
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
import SaplingTableSurface from '@/components/table/SaplingTableSurface.vue'
import { sortDataRows } from '@/components/table/saplingDataTable.types'
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
const { t, locale } = useI18n()
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
const fieldSort = ref<'asc' | 'desc' | null>(null)
const loading = ref(false)
const saving = ref(false)
const actions = [
  { key: 'allowRead', label: 'right.canRead', icon: 'mdi-eye-outline' },
  { key: 'allowInsert', label: 'right.canInsert', icon: 'mdi-plus-box-outline' },
  { key: 'allowUpdate', label: 'right.canUpdate', icon: 'mdi-pencil-outline' },
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
    fields: fieldSort.value
      ? sortDataRows(fields, (field) => fieldLabel(field.name), fieldSort.value, locale.value)
      : fields,
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
