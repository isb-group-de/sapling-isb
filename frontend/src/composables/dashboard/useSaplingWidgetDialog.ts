import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DashboardWidget, DashboardWidgetKind } from '@/entity/dashboard-widget.types'
import type { EntityItem, FavoriteItem, KPIItem, SaplingGenericItem } from '@/entity/entity'
import { useCurrentPermissionStore } from '@/stores/currentPermissionStore'
import { useGenericStore } from '@/stores/genericStore'
import { isSupportedTableTemplate } from '@/utils/saplingTableTemplateUtil'
import { getKpiTileRows } from './saplingKpiTileSize'
import { isDashboardWebsiteUrl } from './saplingDashboardWidgets'

export function useSaplingWidgetDialog(widget: DashboardWidget | null) {
  const { t } = useI18n()
  const permissions = useCurrentPermissionStore()
  const metadata = useGenericStore()
  const kind = ref<DashboardWidgetKind>(widget?.kind ?? 'KPI')
  const aiConfig = ref<Extract<DashboardWidget, { kind: 'AI' }>['config']>(
    widget?.kind === 'AI' ? { ...widget.config } : {},
  )
  const title = ref(widget?.title ?? '')
  const columns = ref(widget?.columns ?? 1)
  const rows = ref(widget?.rows ?? 2)
  const kpi = ref<SaplingGenericItem | null>(
    widget?.kind === 'KPI' ? { handle: widget.config.kpiHandle } : null,
  )
  const entity = ref<SaplingGenericItem | null>(
    widget?.kind === 'TABLE' ? { handle: widget.config.entity } : null,
  )
  const favorite = ref<SaplingGenericItem | null>(null)
  const status = ref<SaplingGenericItem | null>(null)
  const filter = ref<Record<string, unknown>>(
    widget?.kind === 'AGENDA' || widget?.kind === 'TABLE'
      ? JSON.parse(JSON.stringify(widget.config.filter))
      : {},
  )
  const selectedColumns = ref<string[]>(widget?.kind === 'TABLE' ? [...widget.config.columns] : [])
  const sortBy = ref(widget?.kind === 'TABLE' ? [...widget.config.sortBy] : [])
  const search = ref(widget?.kind === 'TABLE' ? widget.config.search : '')
  const pageSize = ref(widget?.kind === 'TABLE' ? widget.config.pageSize : 10)
  const days = ref(widget?.kind === 'AGENDA' ? widget.config.days : 90)
  const limit = ref(widget?.kind === 'AGENDA' ? widget.config.limit : 5)
  const url = ref(widget?.kind === 'WEBSITE' ? widget.config.url : '')
  const mode = ref<'link' | 'embed'>(widget?.kind === 'WEBSITE' ? widget.config.mode : 'link')
  const markdown = ref(widget?.kind === 'NOTE' ? widget.config.markdown : '')
  const actions = ref(
    widget?.kind === 'ACTIONS'
      ? widget.config.actions.map((action) => ({ ...action }))
      : [{ id: crypto.randomUUID(), entity: '', label: '' }],
  )
  const entityHandle = computed(() =>
    kind.value === 'AGENDA' ? 'event' : String(entity.value?.handle ?? ''),
  )
  const allowedEntityHandles = computed(() =>
    (permissions.accumulatedPermission ?? []).filter((p) => p.allowRead).map((p) => p.entityHandle),
  )
  const columnOptions = computed(() =>
    metadata
      .getState(entityHandle.value)
      .entityTemplates.filter((field) =>
        isSupportedTableTemplate(field, permissions.accumulatedPermission ?? []),
      )
      .map((field) => ({
        value: field.name,
        title: t(`${entityHandle.value}.${field.name}`) || field.name,
      })),
  )
  const kindOptions = computed(() =>
    ['KPI', 'AGENDA', 'TABLE', 'WEBSITE', 'NOTE', 'ACTIONS', 'AI'].map((value) => ({
      value,
      title: t(`dashboard.widget${value}`),
    })),
  )
  const required = (value: unknown) =>
    (typeof value === 'string' ? Boolean(value.trim()) : Boolean(value)) ||
    t('dashboard.widgetRequired')
  const urlRule = (value: string) => isDashboardWebsiteUrl(value) || t('dashboard.widgetUrlInvalid')
  const spanRule = (value: unknown) =>
    (Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 4) ||
    t('dashboard.widgetSizeInvalid')

  onMounted(async () => {
    await permissions.fetchCurrentPermission()
    if (entityHandle.value) await metadata.loadGeneric(entityHandle.value, 'global')
  })
  watch(kind, (value) => {
    columns.value = value === 'TABLE' || value === 'AI' ? 2 : 1
    rows.value = value === 'TABLE' || value === 'AI' ? 4 : value === 'ACTIONS' ? 1 : 2
    favorite.value = null
    filter.value = {}
    status.value = null
  })
  watch(entityHandle, async (value, previous) => {
    if (previous && value !== previous) {
      filter.value = {}
      selectedColumns.value = []
      sortBy.value = []
      favorite.value = null
    }
    if (value) await metadata.loadGeneric(value, 'global')
  })
  watch(kpi, (value) => {
    if (value) {
      title.value ||= (value as KPIItem).name ?? ''
      rows.value = getKpiTileRows(value as KPIItem)
    }
  })
  watch(entity, (value) => {
    if (value) title.value ||= t(`navigation.${(value as EntityItem).handle}`)
  })
  watch(favorite, (value) => {
    if (!value) return
    const saved = value as FavoriteItem
    filter.value = JSON.parse(JSON.stringify(saved.filter ?? {})) as Record<string, unknown>
    title.value ||= saved.title
    search.value = saved.search ?? ''
    if (Array.isArray(saved.sortBy)) sortBy.value = saved.sortBy as typeof sortBy.value
  })
  // Restore our optional status selector separately so editing it replaces the previous value.
  if (widget?.kind === 'AGENDA') {
    const parts = filter.value.$and
    if (
      Array.isArray(parts) &&
      parts.length === 2 &&
      parts[1] &&
      typeof parts[1] === 'object' &&
      Object.keys(parts[1]).length === 1 &&
      (typeof parts[1].status === 'string' || typeof parts[1].status === 'number')
    ) {
      status.value = { handle: parts[1].status }
      filter.value = parts[0]
    }
  }
  function resetFilters() {
    filter.value = {}
    status.value = null
    favorite.value = null
    search.value = ''
    sortBy.value = []
  }
  function build(): DashboardWidget {
    const base = {
      id: widget?.id ?? crypto.randomUUID(),
      title: title.value.trim(),
      columns: Number(columns.value),
      rows: Number(rows.value),
    }
    switch (kind.value) {
      case 'AI':
        return { ...base, kind: 'AI', config: { ...aiConfig.value } }
      case 'KPI':
        return { ...base, kind: 'KPI', config: { kpiHandle: Number(kpi.value?.handle) } }
      case 'AGENDA':
        return {
          ...base,
          kind: 'AGENDA',
          config: {
            days: Number(days.value),
            limit: Number(limit.value),
            filter: status.value?.handle
              ? { $and: [filter.value, { status: status.value.handle }] }
              : filter.value,
          },
        }
      case 'TABLE':
        return {
          ...base,
          kind: 'TABLE',
          config: {
            entity: entityHandle.value,
            filter: filter.value,
            columns: selectedColumns.value,
            sortBy: sortBy.value,
            search: search.value,
            pageSize: Number(pageSize.value),
          },
        }
      case 'WEBSITE':
        return { ...base, kind: 'WEBSITE', config: { url: url.value.trim(), mode: mode.value } }
      case 'NOTE':
        return { ...base, kind: 'NOTE', config: { markdown: markdown.value } }
      case 'ACTIONS':
        return {
          ...base,
          kind: 'ACTIONS',
          config: {
            actions: actions.value.map((action) => ({ ...action, label: action.label.trim() })),
          },
        }
    }
  }
  return {
    aiConfig,
    kind,
    title,
    columns,
    rows,
    kpi,
    entity,
    favorite,
    status,
    selectedColumns,
    sortBy,
    search,
    pageSize,
    days,
    limit,
    url,
    mode,
    markdown,
    actions,
    entityHandle,
    allowedEntityHandles,
    columnOptions,
    kindOptions,
    required,
    urlRule,
    spanRule,
    resetFilters,
    build,
  }
}
