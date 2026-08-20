import type { MailRecipientOption } from '@/components/dialog/mail/SaplingDialogMail.types'
import type { EntityTemplate } from '@/entity/structure'
import type { EntityHandleValue } from '@/services/api.generic.service'

export type MailRecipientPerson = {
  handle?: EntityHandleValue
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  isActive?: boolean | null
  company?: {
    handle?: EntityHandleValue
    name?: string | null
  } | null
  department?: {
    description?: string | null
  } | null
}

export function getContextCompanyTemplates(templates: EntityTemplate[]): EntityTemplate[] {
  return templates.filter(
    (template) =>
      template.options?.includes('isCompany') === true &&
      template.fieldAccess?.allowRead !== false &&
      (template.referenceName === 'company' || template.isPrimaryKey === true),
  )
}

export function getContextCompanyHandles(
  templates: EntityTemplate[],
  values: Record<string, unknown> | null | undefined,
  itemHandle?: EntityHandleValue,
): EntityHandleValue[] {
  const handles = new Map<string, EntityHandleValue>()

  for (const template of getContextCompanyTemplates(templates)) {
    if (template.isPrimaryKey) {
      addCompanyHandles(handles, values?.[template.name] ?? itemHandle)
      continue
    }

    addCompanyHandles(handles, values?.[template.name])
  }

  return [...handles.values()]
}

export function buildMailRecipientOptions(
  people: MailRecipientPerson[],
  locale?: string,
): MailRecipientOption[] {
  const collator = new Intl.Collator(locale, { sensitivity: 'base' })
  const options = people
    .filter((person) => person.isActive !== false)
    .map((person) => ({
      email: cleanText(person.email),
      name: joinPersonName(person.firstName, person.lastName),
      companyName: cleanText(person.company?.name),
      departmentName: cleanText(person.department?.description),
    }))
    .filter((option) => option.email && option.name)
    .sort(
      (left, right) =>
        collator.compare(left.name, right.name) ||
        collator.compare(left.companyName, right.companyName) ||
        collator.compare(left.departmentName, right.departmentName) ||
        collator.compare(left.email, right.email),
    )

  const uniqueOptions = new Map<string, MailRecipientOption>()
  for (const option of options) {
    const key = option.email.toLocaleLowerCase()
    if (!uniqueOptions.has(key)) {
      uniqueOptions.set(key, option)
    }
  }

  return [...uniqueOptions.values()]
}

export function buildMailRecipientTitle(option: MailRecipientOption): string {
  const companyName = option.companyName || '—'
  const departmentName = option.departmentName || '—'
  return `${option.name} (${companyName}, ${departmentName}) – ${option.email}`
}

function addCompanyHandles(handles: Map<string, EntityHandleValue>, value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => addCompanyHandles(handles, entry))
    return
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const normalized = String(value).trim()
    if (normalized) {
      handles.set(normalized, value)
    }
    return
  }

  if (value && typeof value === 'object') {
    addCompanyHandles(handles, (value as Record<string, unknown>).handle)
  }
}

function joinPersonName(firstName: unknown, lastName: unknown): string {
  return [firstName, lastName].map(cleanText).filter(Boolean).join(' ')
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
