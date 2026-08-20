import type { EntityTemplate } from '@/entity/structure'
import type { SaplingGenericItem } from '@/entity/entity'
import type { SaplingMailMenuAction } from '@/composables/context/useSaplingContextMenuTable'
import ApiGenericService from '@/services/api.generic.service'

interface CustomerContactPerson extends SaplingGenericItem {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  isActive?: boolean | null
  department?: {
    handle?: string | null
    description?: string | null
    icon?: string | null
  } | null
}

/**
 * Returns all entity templates that are flagged as mail fields via `options.includes('isMail')`.
 */
export function getMailTemplates(templates: EntityTemplate[] | undefined): EntityTemplate[] {
  if (!templates) {
    return []
  }

  return templates.filter((template) => template.options?.includes('isMail') === true)
}

/**
 * Reads a string value from a generic record. Returns trimmed string or empty string.
 */
function readStringField(values: Record<string, unknown> | null | undefined, key: string): string {
  if (!values) {
    return ''
  }

  const raw = values[key]
  if (typeof raw !== 'string') {
    return ''
  }

  return raw.trim()
}

function readObjectField(
  values: Record<string, unknown> | null | undefined,
  key: string,
): Record<string, unknown> | null {
  const value = values?.[key]
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function joinPersonName(firstName: unknown, lastName: unknown): string {
  return [firstName, lastName]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim())
    .join(' ')
}

function resolveRecordRecipientName(item: Record<string, unknown>, templateName: string): string {
  const relationName = templateName.endsWith('Email') ? templateName.slice(0, -'Email'.length) : ''
  const relation = relationName ? readObjectField(item, relationName) : null
  const relationPersonName = joinPersonName(relation?.firstName, relation?.lastName)
  if (relationPersonName) {
    return relationPersonName
  }

  if (relationName) {
    const flattenedPersonName = joinPersonName(
      item[`${relationName}FirstName`],
      item[`${relationName}LastName`],
    )
    if (flattenedPersonName) {
      return flattenedPersonName
    }
  }

  return joinPersonName(item.firstName, item.lastName) || readStringField(item, 'name')
}

/**
 * Builds mail menu actions for a single item by inspecting all mail-flagged templates
 * and emitting one action per non-empty email field.
 */
export function buildMailMenuActions(
  templates: EntityTemplate[] | undefined,
  item: SaplingGenericItem | Record<string, unknown> | null | undefined,
): SaplingMailMenuAction[] {
  const mailTemplates = getMailTemplates(templates)
  if (mailTemplates.length === 0 || !item) {
    return []
  }

  const actions: SaplingMailMenuAction[] = []
  for (const template of mailTemplates) {
    const email = readStringField(item as Record<string, unknown>, template.name)
    if (!email) {
      continue
    }

    actions.push({
      templateName: template.name,
      email,
      fieldLabel: template.name,
      recipientName: resolveRecordRecipientName(item as Record<string, unknown>, template.name),
      source: 'record',
    })
  }

  return actions
}

export function getCustomerCompanyHandle(
  templates: EntityTemplate[] | undefined,
  item: SaplingGenericItem | Record<string, unknown> | null | undefined,
): string | number | null {
  if (!templates || !item) {
    return null
  }

  const customerCompanyTemplate = templates.find(
    (template) =>
      template.referenceName === 'company' && template.options?.includes('isCustomer') === true,
  )
  if (!customerCompanyTemplate) {
    return null
  }

  const company = item[customerCompanyTemplate.name]
  if (typeof company === 'string' || typeof company === 'number') {
    return company
  }
  if (!company || typeof company !== 'object') {
    return null
  }

  const handle = (company as Record<string, unknown>).handle
  return typeof handle === 'string' || typeof handle === 'number' ? handle : null
}

export function buildCustomerContactMailActions(
  people: CustomerContactPerson[],
): SaplingMailMenuAction[] {
  return people
    .filter(
      (person) =>
        person.isActive !== false &&
        typeof person.email === 'string' &&
        person.email.trim().length > 0 &&
        Boolean(person.department?.handle?.trim()) &&
        Boolean(person.department?.description?.trim()),
    )
    .map((person) => {
      const departmentHandle = person.department?.handle?.trim()
      const departmentTitle = person.department?.description?.trim()

      return {
        templateName: 'customerCompanyContact',
        email: person.email?.trim() ?? '',
        fieldLabel: 'person.email',
        recipientName: joinPersonName(person.firstName, person.lastName),
        department: {
          handle: departmentHandle ?? '',
          title: departmentTitle ?? '',
          icon: person.department?.icon?.trim() || undefined,
        },
        source: 'customerContact' as const,
      }
    })
    .sort((left, right) => {
      const departmentComparison = (left.department?.title ?? '').localeCompare(
        right.department?.title ?? '',
      )
      return (
        departmentComparison || (left.recipientName ?? '').localeCompare(right.recipientName ?? '')
      )
    })
}

export async function loadCustomerContactMailActions(
  templates: EntityTemplate[] | undefined,
  item: SaplingGenericItem | Record<string, unknown> | null | undefined,
  canReadPerson: boolean,
): Promise<SaplingMailMenuAction[]> {
  const companyHandle = getCustomerCompanyHandle(templates, item)
  if (!canReadPerson || companyHandle == null) {
    return []
  }

  const people = await ApiGenericService.findAll<CustomerContactPerson>('person', {
    filter: { company: companyHandle },
    orderBy: { lastName: 'ASC', firstName: 'ASC' },
    relations: ['m:1'],
    fields: [
      'handle',
      'firstName',
      'lastName',
      'email',
      'isActive',
      'department',
      'department.handle',
      'department.description',
      'department.icon',
    ],
  })

  return buildCustomerContactMailActions(people)
}

/**
 * Aggregates mail addresses across multiple selected items per mail-flagged template.
 * Returns one entry per template, listing all collected unique emails.
 */
export interface SaplingBulkMailAction {
  templateName: string
  fieldLabel: string
  emails: string[]
}

export function buildBulkMailActions(
  templates: EntityTemplate[] | undefined,
  items: SaplingGenericItem[] | undefined,
): SaplingBulkMailAction[] {
  const mailTemplates = getMailTemplates(templates)
  if (mailTemplates.length === 0 || !items || items.length === 0) {
    return []
  }

  const result: SaplingBulkMailAction[] = []
  for (const template of mailTemplates) {
    const collected = new Set<string>()
    for (const item of items) {
      const email = readStringField(item as Record<string, unknown>, template.name)
      if (email) {
        collected.add(email)
      }
    }

    if (collected.size === 0) {
      continue
    }

    result.push({
      templateName: template.name,
      fieldLabel: template.name,
      emails: Array.from(collected),
    })
  }

  return result
}
