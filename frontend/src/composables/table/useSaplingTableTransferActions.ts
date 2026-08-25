import { ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ColumnFilterItem, EntityTemplate, SortItem } from '@/entity/structure'
import type { SaplingGenericItem } from '@/entity/entity'
import ApiGenericService, { type FilterQuery } from '@/services/api.generic.service'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import { buildTableFilter, buildTableOrderBy } from '@/utils/saplingTableUtil'
import {
  buildCsv,
  buildCsvTemplate,
  mapCsvRowsToInternalFields,
  parseCsv,
} from '@/utils/saplingCsvUtil'
import {
  downloadJSONFile,
  downloadTextFile,
  isSupportedCsvFile,
} from '@/composables/table/saplingTableAction.utils'

interface SaplingTableTransferProps {
  search: string
  sortBy: SortItem[]
  entityHandle: string
  entityTemplates: EntityTemplate[]
  parentFilter?: Record<string, unknown>
  activeFilter?: FilterQuery
}

interface UseSaplingTableTransferActionsOptions {
  props: SaplingTableTransferProps
  localColumnFilters: Ref<Record<string, ColumnFilterItem>>
  selectedItems: Ref<SaplingGenericItem[]>
  reload: () => void
}

/** Provides reusable JSON/CSV transfer commands for generic table workspaces. */
export function useSaplingTableTransferActions({
  props,
  localColumnFilters,
  selectedItems,
  reload,
}: UseSaplingTableTransferActionsOptions) {
  const { t } = useI18n()
  const { pushMessage } = useSaplingMessageCenter()
  const isDownloadingJSON = ref(false)
  const isImportingCSV = ref(false)

  const resolveCsvHeader = (fieldName: string, template?: EntityTemplate) =>
    template?.formConfig?.label?.trim() || t(`${props.entityHandle}.${fieldName}`)

  function getActiveFilter() {
    return (
      props.activeFilter ??
      buildTableFilter({
        search: props.search,
        columnFilters: localColumnFilters.value,
        entityTemplates: props.entityTemplates,
        parentFilter: props.parentFilter,
      })
    )
  }

  async function downloadJSON() {
    if (!props.entityHandle || isDownloadingJSON.value) {
      return
    }

    try {
      isDownloadingJSON.value = true
      const json = await ApiGenericService.downloadJSON(props.entityHandle, {
        filter: getActiveFilter(),
        orderBy: buildTableOrderBy(props.sortBy),
        relations: ['m:1'],
      })

      downloadJSONFile(json, `${props.entityHandle}.json`)
      pushMessage(
        'success',
        t('global.jsonExported'),
        t('global.jsonExportedDescription', { count: json.length }),
        props.entityHandle,
      )
    } catch {
      // API errors are already routed through the shared message center.
    } finally {
      isDownloadingJSON.value = false
    }
  }

  function exportCSVTemplate() {
    if (!props.entityHandle) {
      return
    }

    downloadTextFile(
      buildCsvTemplate(props.entityTemplates, resolveCsvHeader),
      `${props.entityHandle}-template.csv`,
      'text/csv;charset=utf-8',
    )
    pushMessage(
      'success',
      t('global.csvTemplateExported'),
      t('global.csvTemplateExportedDescription'),
      props.entityHandle,
    )
  }

  async function exportCSV() {
    if (!props.entityHandle || isDownloadingJSON.value) {
      return
    }

    try {
      isDownloadingJSON.value = true
      const items = await ApiGenericService.downloadJSON<SaplingGenericItem>(props.entityHandle, {
        filter: getActiveFilter(),
        orderBy: buildTableOrderBy(props.sortBy),
        relations: ['m:1'],
      })

      downloadTextFile(
        buildCsv(items, props.entityTemplates, resolveCsvHeader),
        `${props.entityHandle}.csv`,
        'text/csv;charset=utf-8',
      )
      pushMessage(
        'success',
        t('global.csvExported'),
        t('global.csvExportedDescription', { count: items.length }),
        props.entityHandle,
      )
    } catch {
      // API errors are already routed through the shared message center.
    } finally {
      isDownloadingJSON.value = false
    }
  }

  async function importCSVFile(file: File | null) {
    if (!file || !props.entityHandle || isImportingCSV.value) {
      return
    }

    if (!isSupportedCsvFile(file)) {
      pushMessage(
        'warning',
        t('global.csvImportUnsupportedFile'),
        t('global.csvImportUnsupportedFileDescription'),
        props.entityHandle,
      )
      return
    }

    try {
      isImportingCSV.value = true
      const rows = mapCsvRowsToInternalFields(
        parseCsv(await file.text()),
        props.entityTemplates,
        resolveCsvHeader,
      )
      const result = await ApiGenericService.importRows(props.entityHandle, rows)

      reload()
      pushMessage(
        result.failed > 0 ? 'warning' : 'success',
        t('global.csvImported'),
        t('global.csvImportedDescription', {
          created: result.created,
          updated: result.updated,
          failed: result.failed,
          skipped: result.skipped,
        }),
        props.entityHandle,
      )
    } catch {
      // API errors are already routed through the shared message center.
    } finally {
      isImportingCSV.value = false
    }
  }

  function refreshTable() {
    reload()
  }

  function exportSelectedJSON() {
    if (!props.entityHandle || selectedItems.value.length === 0) {
      return
    }

    downloadJSONFile(selectedItems.value, `${props.entityHandle}-selected.json`)
    pushMessage(
      'success',
      t('global.selectionExported'),
      t('global.selectionExportedDescription', { count: selectedItems.value.length }),
      props.entityHandle,
    )
  }

  return {
    isDownloadingJSON,
    isImportingCSV,
    downloadJSON,
    exportCSV,
    exportCSVTemplate,
    importCSVFile,
    refreshTable,
    exportSelectedJSON,
  }
}
