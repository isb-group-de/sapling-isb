<template>
  <v-container
    class="sapling-page-shell sapling-page-shell--fill sapling-page-shell--panel sapling-page-shell--uniform-inset sapling-config-page sapling-form-config"
    fluid
  >
    <SaplingPageHero
      class="sapling-config-hero sapling-form-config__hero"
      variant="system"
      :eyebrow="$t('formConfig.eyebrow')"
      :title="$t('formConfig.title')"
    >
      <p>{{ $t('formConfig.subtitle') }}</p>

      <template #meta>
        <v-chip size="small" color="primary" variant="tonal" prepend-icon="mdi-table-cog">
          {{ selectedEntityLabel }}
        </v-chip>
        <v-chip size="small" variant="outlined" prepend-icon="mdi-form-select">
          {{ baseTemplates.length }}
        </v-chip>
        <v-chip size="small" variant="outlined" prepend-icon="mdi-database-cog-outline">
          {{ configs.length }}
        </v-chip>
      </template>

      <template #side>
        <div
          class="sapling-action-cluster sapling-config-hero-actions sapling-form-config__hero-actions"
        >
          <v-btn
            prepend-icon="mdi-content-save"
            color="primary"
            :disabled="!canSave"
            :loading="isSaving"
            @click="saveConfig"
          >
            {{ $t('global.save') }}
          </v-btn>
          <v-btn
            prepend-icon="mdi-file-export-outline"
            variant="tonal"
            :disabled="!selectedEntityHandle"
            @click="exportDraft"
          >
            {{ $t('formConfig.export') }}
          </v-btn>
          <v-btn prepend-icon="mdi-file-import-outline" variant="text" @click="openImportFile">
            {{ $t('formConfig.import') }}
          </v-btn>
          <input
            ref="fileInputRef"
            class="sapling-upload-native-input sapling-form-config__file-input"
            type="file"
            accept="application/json,.json"
            @change="onImportFileChange"
          />
        </div>
      </template>
    </SaplingPageHero>

    <section class="sapling-config-workspace sapling-form-config__workspace">
      <SaplingSurface
        class="sapling-panel-shell sapling-section-panel sapling-config-panel sapling-config-panel--blurred sapling-form-config__panel sapling-form-config__panel--editor"
      >
        <SaplingFormConfigContextControls
          v-model:selected-entity-handle="selectedEntityHandle"
          v-model:selected-config-handle="selectedConfigHandle"
          v-model:config-name="configName"
          v-model:config-scope="configScope"
          v-model:scope-handle="scopeHandle"
          v-model:selected-scope-item="selectedScopeItem"
          v-model:is-active="isActive"
          v-model:is-default="isDefault"
          :entity-options="entityOptions"
          :config-options="configOptions"
          :scope-options="scopeOptions"
          :scope-select-entity-handle="scopeSelectEntityHandle"
          :scope-select-key="scopeSelectKey"
          :loading-entities="isLoadingEntities"
          @start-new="startNewConfig"
        />

        <SaplingFormConfigSummary
          :form-visible-count="formVisibleCount"
          :table-visible-count="tableVisibleCount"
          :mobile-visible-count="mobileVisibleCount"
          :hidden-field-count="hiddenFieldCount"
        />

        <SaplingFormConfigFieldList
          :fields="fieldRows"
          :groups="groupRows"
          :width-options="widthOptions"
          :renderer-options="rendererOptions"
          :resolve-field-label="resolveFieldLabel"
          :resolve-group-label="resolveGroupLabel"
          @show-all="showAllFields"
          @reset="resetCurrentConfig"
          @add-group="addGroup"
          @remove-group="removeGroup"
        />
      </SaplingSurface>

      <SaplingFormConfigPreviewPanel
        v-model:preview-mode="previewMode"
        :selected-entity-handle="selectedEntityHandle"
        :draft-templates="draftTemplates"
        :groups="groupRows"
        :reload-disabled="!selectedEntityHandle"
        @reload="loadEntityContext"
        @move-field="moveFieldBefore"
        @reorder-group="reorderGroup"
      />
    </section>
  </v-container>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import ApiFormConfigService, {
  type SaplingFormConfigItem,
} from '@/services/api.form-config.service'
import ApiGenericService from '@/services/api.generic.service'
import ApiTemplateService from '@/services/api.template.service'
import TranslationService from '@/services/translation.service'
import { sortSelectOptions } from '@/utils/saplingSelectOptions'
import type { EntityItem, SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplate, SaplingFormConfigPayload } from '@/entity/structure'
import SaplingPageHero from '@/components/common/SaplingPageHero.vue'
import SaplingSurface from '@/components/common/SaplingSurface.vue'
import SaplingFormConfigContextControls from '@/components/system/form-config/SaplingFormConfigContextControls.vue'
import SaplingFormConfigFieldList from '@/components/system/form-config/SaplingFormConfigFieldList.vue'
import SaplingFormConfigPreviewPanel from '@/components/system/form-config/SaplingFormConfigPreviewPanel.vue'
import SaplingFormConfigSummary from '@/components/system/form-config/SaplingFormConfigSummary.vue'
import type {
  FieldDraft,
  GroupDraft,
  PreviewMode,
} from '@/components/system/form-config/formConfigAdmin.types'
import {
  FORM_CONFIG_RENDERER_OPTIONS,
  FORM_CONFIG_WIDTH_OPTIONS,
} from '@/components/system/form-config/formConfigAdmin.options'
import {
  applyFormConfigDraftToTemplate,
  buildFormConfigPayload,
} from '@/components/system/form-config/formConfigDraft.utils'
import { useSaplingFormConfigTransfer } from '@/composables/system/useSaplingFormConfigTransfer'
import {
  buildFormConfigDraftRows,
  createFormConfigGroup,
  moveFormConfigField,
  removeFormConfigGroup,
  reorderFormConfigGroup,
  showAllFormConfigFields,
} from '@/components/system/form-config/formConfigAdminDraft.utils'

type ScopeValue = 'global' | 'role' | 'person'

const { t, te } = useI18n()
const route = useRoute()

const entities = ref<EntityItem[]>([])
const configs = ref<SaplingFormConfigItem[]>([])
const baseTemplates = ref<EntityTemplate[]>([])
const selectedEntityHandle = ref('')
const selectedConfigHandle = ref<number | null>(null)
const configName = ref('')
const configScope = ref<ScopeValue>('global')
const scopeHandle = ref('')
const selectedScopeItem = ref<SaplingGenericItem | null>(null)
const isActive = ref(true)
const isDefault = ref(false)
const isLoadingEntities = ref(false)
const isLoadingContext = ref(false)
const isSaving = ref(false)
const fieldRows = reactive<FieldDraft[]>([])
const groupRows = reactive<GroupDraft[]>([])
const previewMode = ref<PreviewMode>('form')

const widthOptions = FORM_CONFIG_WIDTH_OPTIONS
const rendererOptions = FORM_CONFIG_RENDERER_OPTIONS
const translationService = new TranslationService()
let entityContextRequestId = 0

const scopeOptions = computed<Array<{ title: string; value: ScopeValue }>>(() => [
  { title: t('formConfig.scopeGlobal'), value: 'global' },
  { title: t('formConfig.scopeRole'), value: 'role' },
  { title: t('formConfig.scopePerson'), value: 'person' },
])

const scopeSelectEntityHandle = computed(() => {
  if (configScope.value === 'role') {
    return 'role'
  }

  if (configScope.value === 'person') {
    return 'person'
  }

  return ''
})

const scopeSelectKey = computed(() => `${configScope.value}-${scopeHandle.value || 'empty'}`)

const entityOptions = computed(() =>
  sortSelectOptions(entities.value, (entity) => translateEntity(entity.handle)).map((entity) => ({
    title: translateEntity(entity.handle),
    value: entity.handle,
  })),
)

const selectedEntityLabel = computed(() =>
  selectedEntityHandle.value
    ? translateEntity(selectedEntityHandle.value)
    : t('formConfig.noEntity'),
)

const configOptions = computed(() => [
  { title: t('formConfig.newConfig'), value: null },
  ...sortSelectOptions(configs.value, (config) => config.name).map((config) => ({
    title: config.name,
    value: config.handle ?? null,
  })),
])

const canSave = computed(
  () => Boolean(selectedEntityHandle.value && configName.value.trim()) && !isLoadingContext.value,
)

const draftConfig = computed<SaplingFormConfigPayload>(() =>
  buildFormConfigPayload(selectedEntityHandle.value, fieldRows, groupRows),
)

const draftTemplates = computed(() =>
  baseTemplates.value.map((template) =>
    applyFormConfigDraftToTemplate(
      template,
      fieldRows.find((field) => field.name === template.name),
      groupRows.find(
        (group) => group.key === fieldRows.find((field) => field.name === template.name)?.group,
      ),
    ),
  ),
)

const { fileInputRef, openImportFile, onImportFileChange, exportDraft } =
  useSaplingFormConfigTransfer({
    selectedEntityHandle,
    selectedConfigHandle,
    configName,
    draftConfig,
    loadEntityContext,
    applyConfig: (config) => buildFieldRows(config.fields, config.groups),
  })

const formVisibleCount = computed(
  () =>
    fieldRows.filter(
      (field) =>
        field.visible && groupRows.find((group) => group.key === field.group)?.visible !== false,
    ).length,
)
const tableVisibleCount = computed(() => fieldRows.filter((field) => field.tableVisible).length)
const mobileVisibleCount = computed(() => fieldRows.filter((field) => field.mobileVisible).length)
const hiddenFieldCount = computed(() => fieldRows.length - formVisibleCount.value)

watch(
  () => route.query.entity,
  () => {
    const requestedEntity = getRequestedEntityHandle()
    if (requestedEntity && requestedEntity !== selectedEntityHandle.value) {
      selectedEntityHandle.value = requestedEntity
    }
  },
)

watch(selectedEntityHandle, () => {
  void loadEntityContext()
})

watch(selectedConfigHandle, () => {
  applySelectedConfig()
})

watch(configScope, (scope) => {
  selectedScopeItem.value = null
  if (scope === 'global') {
    scopeHandle.value = ''
  }
})

watch(selectedScopeItem, (item) => {
  scopeHandle.value = getRecordHandle(item)
})

onMounted(async () => {
  await loadEntities()
})

async function loadEntities(): Promise<void> {
  isLoadingEntities.value = true

  try {
    entities.value = await fetchAllEntities()
    const requestedEntity = getRequestedEntityHandle()
    selectedEntityHandle.value =
      requestedEntity && entities.value.some((entity) => entity.handle === requestedEntity)
        ? requestedEntity
        : (entities.value[0]?.handle ?? '')
  } catch {
    return
  } finally {
    isLoadingEntities.value = false
  }
}

async function fetchAllEntities(): Promise<EntityItem[]> {
  return ApiGenericService.findAll<EntityItem>('entity', {
    orderBy: { order: 'ASC', handle: 'ASC' },
  })
}

function getRequestedEntityHandle(): string {
  const rawEntity = route.query.entity
  const value = Array.isArray(rawEntity) ? rawEntity[0] : rawEntity
  return typeof value === 'string' ? value.trim() : ''
}

async function loadEntityContext(): Promise<void> {
  const entityHandle = selectedEntityHandle.value
  const requestId = ++entityContextRequestId
  if (!entityHandle) {
    isLoadingContext.value = false
    baseTemplates.value = []
    configs.value = []
    fieldRows.splice(0, fieldRows.length)
    groupRows.splice(0, groupRows.length)
    return
  }

  isLoadingContext.value = true

  try {
    const [templates, nextConfigs] = await Promise.all([
      ApiTemplateService.getEntityTemplate(entityHandle),
      ApiFormConfigService.list(entityHandle),
      translationService.prepare(entityHandle).catch(() => []),
    ])
    if (requestId !== entityContextRequestId || selectedEntityHandle.value !== entityHandle) return

    baseTemplates.value = templates
    configs.value = nextConfigs
    selectedConfigHandle.value = nextConfigs[0]?.handle ?? null

    if (!selectedConfigHandle.value) {
      startNewConfig()
    } else {
      applySelectedConfig()
    }
  } catch {
    return
  } finally {
    if (requestId === entityContextRequestId) {
      isLoadingContext.value = false
    }
  }
}

function startNewConfig(): void {
  selectedConfigHandle.value = null
  configName.value = selectedEntityHandle.value
    ? `${translateEntity(selectedEntityHandle.value)} ${t('formConfig.configuration')}`
    : t('formConfig.newConfig')
  configScope.value = 'global'
  scopeHandle.value = ''
  selectedScopeItem.value = null
  isActive.value = true
  isDefault.value = configs.value.length === 0
  buildFieldRows({})
}

function applySelectedConfig(): void {
  const selectedConfig = configs.value.find(
    (config) => config.handle === selectedConfigHandle.value,
  )
  if (!selectedConfig) {
    startNewConfig()
    return
  }

  configName.value = selectedConfig.name
  configScope.value = selectedConfig.scope
  scopeHandle.value = selectedConfig.scopeHandle ?? ''
  selectedScopeItem.value = null
  isActive.value = selectedConfig.isActive
  isDefault.value = selectedConfig.isDefault
  buildFieldRows(selectedConfig.config.fields ?? {}, selectedConfig.config.groups ?? {})
}

function buildFieldRows(
  configFields: SaplingFormConfigPayload['fields'],
  configGroups: SaplingFormConfigPayload['groups'] = {},
): void {
  const draft = buildFormConfigDraftRows(
    baseTemplates.value,
    configFields,
    configGroups,
    getTemplateDefaultLabel,
  )
  fieldRows.splice(0, fieldRows.length, ...draft.fields)
  groupRows.splice(0, groupRows.length, ...draft.groups)
}

function getRecordHandle(item?: SaplingGenericItem | null): string {
  const handle = item?.handle
  return typeof handle === 'string' || typeof handle === 'number' ? String(handle) : ''
}

async function saveConfig(): Promise<void> {
  if (!canSave.value) {
    return
  }

  isSaving.value = true

  try {
    const payload = {
      name: configName.value.trim(),
      scope: configScope.value,
      scopeHandle:
        configScope.value === 'global'
          ? null
          : getRecordHandle(selectedScopeItem.value) || scopeHandle.value.trim() || null,
      isActive: isActive.value,
      isDefault: isDefault.value,
      config: draftConfig.value,
    }

    const savedConfig =
      selectedConfigHandle.value == null
        ? await ApiFormConfigService.create(selectedEntityHandle.value, payload)
        : await ApiFormConfigService.update(
            selectedEntityHandle.value,
            selectedConfigHandle.value,
            payload,
          )

    await loadEntityContext()
    selectedConfigHandle.value = savedConfig.handle ?? null
  } catch {
    return
  } finally {
    isSaving.value = false
  }
}

function resetCurrentConfig(): void {
  buildFieldRows({})
}

function showAllFields(): void {
  showAllFormConfigFields(fieldRows, groupRows)
}

function addGroup(label: string): void {
  const group = createFormConfigGroup(groupRows, selectedEntityHandle.value, label)
  if (group) groupRows.push(group)
}

function removeGroup(groupKey: string): void {
  removeFormConfigGroup(fieldRows, groupRows, groupKey)
}

function reorderGroup(
  sourceKey: string,
  targetKey: string,
  placement: 'swap' | 'before' | 'after' = 'swap',
): void {
  reorderFormConfigGroup(groupRows, sourceKey, targetKey, placement)
}

function moveField(fieldName: string, targetGroupKey: string, targetIndex: number): void {
  moveFormConfigField(fieldRows, groupRows, fieldName, targetGroupKey, targetIndex)
}

function moveFieldBefore(
  fieldName: string,
  targetGroupKey: string,
  beforeFieldName: string | null,
): void {
  const targetFields = fieldRows
    .filter((field) => field.group === targetGroupKey && field.name !== fieldName)
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
  const targetIndex = beforeFieldName
    ? targetFields.findIndex((field) => field.name === beforeFieldName)
    : targetFields.length
  moveField(fieldName, targetGroupKey, targetIndex < 0 ? targetFields.length : targetIndex)
}

function translateEntity(entityHandle: string): string {
  const key = `navigation.${entityHandle}`
  return te(key) ? t(key) : ''
}

function resolveFieldLabel(fieldName: string): string {
  const configuredLabel = fieldRows.find((field) => field.name === fieldName)?.label.trim()
  if (configuredLabel) {
    return configuredLabel
  }

  const key = `${selectedEntityHandle.value}.${fieldName}`
  return te(key) ? t(key) : ''
}

function resolveGroupLabel(group: GroupDraft): string {
  if (group.label.trim()) return group.label.trim()
  if (!group.key) return te('formConfig.ungrouped') ? t('formConfig.ungrouped') : 'Ohne Gruppe'
  if (te(group.key)) return t(group.key)

  const fallback =
    group.key
      .split('.')
      .pop()
      ?.replace(/^group/, '') ?? group.key
  return fallback
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (character) => character.toUpperCase())
}

function getTemplateDefaultLabel(template: EntityTemplate): string {
  const configuredLabel = template.formConfig?.label?.trim()
  if (configuredLabel) {
    return configuredLabel
  }

  const key = `${selectedEntityHandle.value}.${template.name}`
  return te(key) ? t(key) : ''
}
</script>
