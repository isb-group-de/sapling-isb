import type { EntityItem } from '@/entity/entity'
import type {
  AccumulatedPermission,
  ColumnFilterOperator,
  DialogState,
  EntityState,
  EntityTemplate,
  SaplingOption,
  SaplingTableHeaderItem,
} from '@/entity/structure'

const TABLE_REFERENCE_PERMISSION_KINDS = ['m:1', '1:1']
const TABLE_UNSUPPORTED_RELATION_KINDS = ['1:m', 'm:n', 'n:m']

export function isGenericReferenceTemplate(template?: Partial<EntityTemplate>): boolean {
  return Boolean(
    template?.genericReference?.entityField?.trim() &&
    template?.genericReference?.handleField?.trim(),
  )
}

export function canReadReferenceTemplate(
  template?: Partial<EntityTemplate>,
  permissions: AccumulatedPermission[] = [],
): boolean {
  if (template?.fieldAccess?.allowRead === false) {
    return false
  }
  if (!template?.referenceName) {
    return true
  }

  if (template.kind && !TABLE_REFERENCE_PERMISSION_KINDS.includes(template.kind)) {
    return true
  }

  return permissions.some(
    (permission) => permission.entityHandle === template.referenceName && permission.allowRead,
  )
}

export function filterTableHeadersByReferencePermission<T extends Partial<EntityTemplate>>(
  headers: T[],
  permissions: AccumulatedPermission[] = [],
): T[] {
  return headers.filter((header) => canReadReferenceTemplate(header, permissions))
}

export function getReadableReferenceRelationNames(
  entityTemplates: EntityTemplate[],
  permissions: AccumulatedPermission[] = [],
  projectedFields?: string[],
): string[] {
  const projectedFieldSet = projectedFields ? new Set(projectedFields) : null
  return [
    ...new Set(
      entityTemplates
        .filter(
          (template) =>
            TABLE_REFERENCE_PERMISSION_KINDS.includes(template.kind ?? '') &&
            Boolean(template.name) &&
            Boolean(template.referenceName) &&
            template.fieldAccess?.allowRead !== false &&
            (!projectedFieldSet || projectedFieldSet.has(template.name)) &&
            canReadReferenceTemplate(template, permissions),
        )
        .map((template) => template.name),
    ),
  ]
}

export function getListProjectionFieldNames(
  entityTemplates: EntityTemplate[],
  permissions: AccumulatedPermission[] = [],
): string[] {
  return [
    ...new Set(
      entityTemplates
        .filter(
          (template) =>
            template.fieldAccess?.allowRead !== false &&
            (template.isPrimaryKey ||
              (template.isPersistent !== false &&
                isSupportedTableTemplate(template, permissions) &&
                (getTemplateConfiguredBoolean(template, 'tableVisible') === true ||
                  getTemplateConfiguredBoolean(template, 'mobileVisible') === true ||
                  template.options?.includes('isValue')))),
        )
        .map((template) => template.name)
        .filter(Boolean),
    ),
  ]
}

function normalizeTemplateOrder(order?: number | null): number | null {
  return typeof order === 'number' && Number.isFinite(order) ? Math.trunc(order) : null
}

function getTemplateConfiguredBoolean(
  template: Partial<EntityTemplate>,
  key: 'tableVisible' | 'mobileVisible',
): boolean | null {
  const configuredValue = template.formConfig?.[key]
  if (typeof configuredValue === 'boolean') {
    return configuredValue
  }

  const directValue = template[key]
  return typeof directValue === 'boolean' ? directValue : null
}

function getTemplateConfiguredFormVisible(template: Partial<EntityTemplate>): boolean | null {
  if (typeof template.formConfig?.visible === 'boolean') {
    return template.formConfig.visible
  }

  return typeof template.formVisible === 'boolean' ? template.formVisible : null
}

function getTemplateConfiguredOrder(
  template: Partial<EntityTemplate>,
  key: 'tableOrder' | 'mobileOrder',
): number | null {
  return normalizeTemplateOrder(template.formConfig?.[key]) ?? normalizeTemplateOrder(template[key])
}

function getTemplateConfiguredGroupOrder(template: Partial<EntityTemplate>): number | null {
  return (
    normalizeTemplateOrder(template.formConfig?.groupOrder) ??
    normalizeTemplateOrder(template.formGroupOrder)
  )
}

export function isSupportedTableTemplate(
  template: EntityTemplate,
  permissions: AccumulatedPermission[] = [],
): boolean {
  return (
    template.fieldAccess?.allowRead !== false &&
    !template.options?.includes('isSecurity') &&
    !TABLE_UNSUPPORTED_RELATION_KINDS.includes(template.kind ?? '') &&
    canReadReferenceTemplate(template, permissions)
  )
}

export function isVisibleTableTemplate(
  template: EntityTemplate,
  permissions: AccumulatedPermission[] = [],
): boolean {
  if (!isSupportedTableTemplate(template, permissions)) {
    return false
  }

  return getTemplateConfiguredBoolean(template, 'tableVisible') === true
}

export function getTableHeaderOrder(template: Partial<EntityTemplate>, index: number): number {
  return getTemplateConfiguredOrder(template, 'tableOrder') ?? index
}

export function sortTableHeaders<T extends Partial<EntityTemplate>>(headers: T[]): T[] {
  return [...headers]
    .map((header, index) => ({
      header,
      index,
      groupOrder: getTemplateConfiguredGroupOrder(header) ?? 0,
      order: getTableHeaderOrder(header, index),
    }))
    .sort((left, right) => {
      if (left.groupOrder !== right.groupOrder) {
        return left.groupOrder - right.groupOrder
      }

      if (left.order === right.order) {
        return left.index - right.index
      }

      return left.order - right.order
    })
    .map(({ header }) => header)
}

export function getMobileTableHeaders<T extends SaplingTableHeaderItem>(headers: T[]): T[] {
  const sortMobileHeaders = (items: T[]) =>
    [...items]
      .map((header, index) => ({
        header,
        index,
        mobileOrder: getTemplateConfiguredOrder(header, 'mobileOrder'),
        valueRank: header.options?.includes('isValue') ? 0 : 1,
      }))
      .sort((left, right) => {
        if (left.mobileOrder != null && right.mobileOrder != null) {
          return left.mobileOrder === right.mobileOrder
            ? left.index - right.index
            : left.mobileOrder - right.mobileOrder
        }

        if (left.mobileOrder != null) return -1
        if (right.mobileOrder != null) return 1
        if (left.valueRank !== right.valueRank) return left.valueRank - right.valueRank
        return left.index - right.index
      })
      .map(({ header }) => header)

  return sortMobileHeaders(headers).filter(
    (header) => getTemplateConfiguredBoolean(header, 'mobileVisible') === true,
  )
}

export function getRelationTableHeaders(
  relationTableStates: Record<string, EntityState>,
  t: (key: string) => string,
  permissions: AccumulatedPermission[] = [],
) {
  const result: Record<string, SaplingTableHeaderItem[]> = {}
  for (const key in relationTableStates) {
    result[key] = sortTableHeaders(
      (relationTableStates[key]?.entityTemplates ?? [])
        .filter((template) => isVisibleTableTemplate(template, permissions))
        .map((template: EntityTemplate) => ({
          ...template,
          key: template.name,
          title:
            template.formConfig?.label?.trim() ||
            t(`${relationTableStates[key]?.entity?.handle}.${template.name}`),
        })),
    )
  }
  return result
}

export function getSupportedTableHeaders(
  entityTemplates: EntityTemplate[],
  entity: EntityItem | null,
  t: (key: string) => string,
  permissions: AccumulatedPermission[] = [],
) {
  return sortTableHeaders(
    entityTemplates
      .filter((template) => isSupportedTableTemplate(template, permissions))
      .map((template: EntityTemplate) => ({
        ...template,
        key: template.name,
        title: template.formConfig?.label?.trim() || t(`${entity?.handle}.${template.name}`),
      })),
  )
}

export function getEditDialogHeaders(
  entityTemplates: EntityTemplate[],
  mode: DialogState,
  showReference: boolean,
  permissions: AccumulatedPermission[] = [],
) {
  const visibleTemplates = entityTemplates.filter((template) => {
    const isManualPrimaryKey = template.isPrimaryKey === true && template.isAutoIncrement !== true

    return (
      (mode === 'create'
        ? template.fieldAccess?.allowInsert !== false
        : mode === 'readonly'
          ? template.fieldAccess?.allowRead !== false
          : template.fieldAccess?.allowRead !== false ||
            template.fieldAccess?.allowUpdate === true) &&
      (getTemplateConfiguredFormVisible(template) === true || isManualPrimaryKey) &&
      !template.isAutoIncrement &&
      (template.inlineCollection || !['1:m', 'm:n', 'n:m', '1:1'].includes(template.kind ?? '')) &&
      (!template.isReference || showReference) &&
      (!template.referenceName ||
        permissions.find((permission) => permission.entityHandle === template.referenceName)
          ?.allowRead)
    )
  })

  return visibleTemplates
}

export function getTableHeaders(
  entityTemplates: EntityTemplate[],
  entity: EntityItem | null,
  t: (key: string) => string,
  permissions: AccumulatedPermission[] = [],
) {
  return getSupportedTableHeaders(entityTemplates, entity, t, permissions).filter(
    (template) =>
      template.fieldAccess?.allowRead !== false && isVisibleTableTemplate(template, permissions),
  )
}

export function isFilterableTableColumn(
  template: Partial<EntityTemplate & { key?: string | null }>,
): boolean {
  const columnKey = template.key ?? template.name
  return (
    Boolean(columnKey) &&
    !['__select', '__actions'].includes(columnKey ?? '') &&
    template.isPersistent !== false &&
    template.fieldAccess?.allowRead !== false &&
    !template.options?.includes('isSecurity') &&
    !template.options?.includes('isSystem') &&
    (isManyToOneTemplate(template) ||
      (!template.isReference && !['1:m', 'm:n', 'n:m', '1:1'].includes(template.kind ?? ''))) &&
    template.type !== 'JsonType'
  )
}

export function isBooleanTemplate(template?: Partial<EntityTemplate>): boolean {
  return normalizeTemplateType(template) === 'boolean'
}

export function isDateTemplate(template?: Partial<EntityTemplate>): boolean {
  return ['date', 'datetype', 'datetime'].includes(normalizeTemplateType(template))
}

export function isTimeTemplate(template?: Partial<EntityTemplate>): boolean {
  return normalizeTemplateType(template) === 'time'
}

export function isNumericTemplate(template?: Partial<EntityTemplate>): boolean {
  return ['number', 'integer', 'float', 'double', 'decimal'].includes(
    normalizeTemplateType(template),
  )
}

export function isRangeTemplate(template?: Partial<EntityTemplate>): boolean {
  return isDateTemplate(template) || isTimeTemplate(template) || isNumericTemplate(template)
}

export function isManyToOneTemplate(template?: Partial<EntityTemplate>): boolean {
  return template?.kind === 'm:1' && Boolean(template.referenceName)
}

export function isTextSearchableTemplate(template?: Partial<EntityTemplate>): boolean {
  return (
    !isManyToOneTemplate(template) &&
    !isBooleanTemplate(template) &&
    !isDateTemplate(template) &&
    !isTimeTemplate(template) &&
    !isNumericTemplate(template) &&
    !hasTemplateOption(template, 'isColor') &&
    !hasTemplateOption(template, 'isIcon')
  )
}

export function getDefaultColumnFilterOperatorForTemplate(
  template?: Partial<EntityTemplate>,
): ColumnFilterOperator {
  if (
    isManyToOneTemplate(template) ||
    isBooleanTemplate(template) ||
    hasTemplateOption(template, 'isColor') ||
    hasTemplateOption(template, 'isIcon')
  ) {
    return 'eq'
  }

  if (isDateTemplate(template) || isTimeTemplate(template) || isNumericTemplate(template)) {
    return 'eq'
  }

  return 'like'
}

export function getAllowedColumnFilterOperators(
  template?: Partial<EntityTemplate>,
): ColumnFilterOperator[] {
  if (isManyToOneTemplate(template)) return ['eq', 'nin', 'isSet', 'isEmpty']
  if (
    isBooleanTemplate(template) ||
    hasTemplateOption(template, 'isColor') ||
    hasTemplateOption(template, 'isIcon')
  ) {
    return ['eq']
  }
  if (isDateTemplate(template) || isTimeTemplate(template) || isNumericTemplate(template)) {
    return ['eq', 'between', 'gt', 'gte', 'lt', 'lte', 'isSet', 'isEmpty']
  }
  return ['like', 'startsWith', 'endsWith', 'eq', 'isSet', 'isEmpty']
}

function normalizeTemplateType(template?: Partial<EntityTemplate>): string {
  return String(template?.type ?? '').toLowerCase()
}

function hasTemplateOption(
  template: Partial<EntityTemplate> | undefined,
  option: SaplingOption,
): boolean {
  return Array.isArray(template?.options) && template.options.includes(option)
}
