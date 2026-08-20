import type { SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'
import { getEntityValueLabel, type EntityValueReferenceTemplates } from '@/utils/saplingTableUtil'

function normalizeLabel(value: string): string {
  return value.replace(/\s*\n\s*/g, ' · ').trim()
}

/** Communication heroes intentionally omit reference-based isValue entries. */
export function getCommunicationValueLabel(
  record: SaplingGenericItem | null | undefined,
  entityTemplates: EntityTemplate[],
  referenceTemplates: EntityValueReferenceTemplates = {},
): string {
  const scalarValueTemplates = entityTemplates.filter(
    (template) => !(template.isReference && template.options?.includes('isValue')),
  )
  const recordWithoutHandle = record ? { ...record, handle: undefined } : record

  return normalizeLabel(
    getEntityValueLabel(recordWithoutHandle, scalarValueTemplates, referenceTemplates),
  )
}

function projectedFieldName(referenceName: string, targetFieldName: string): string {
  return `${referenceName}${targetFieldName.charAt(0).toUpperCase()}${targetFieldName.slice(1)}`
}

/**
 * Resolves the owner reference of a non-persistent named-assistant field.
 * Named assistants follow `<reference><TargetField>`, for example
 * `creatorPersonPhone` mirrors `creatorPerson.phone`.
 */
export function getNamedAssistantOwnerReference(
  contactTemplate: EntityTemplate | undefined,
  entityTemplates: EntityTemplate[],
): EntityTemplate | undefined {
  if (!contactTemplate || contactTemplate.isPersistent !== false) {
    return undefined
  }

  return entityTemplates
    .filter((template) => {
      if (!template.isReference || !template.referenceName) return false
      if (!contactTemplate.name.startsWith(template.name)) return false

      const suffix = contactTemplate.name.slice(template.name.length)
      return suffix.length > 0 && suffix.charAt(0) === suffix.charAt(0).toUpperCase()
    })
    .sort((left, right) => right.name.length - left.name.length)[0]
}

export function getCommunicationOwnerReferenceNames(
  contactTemplateNames: string[],
  entityTemplates: EntityTemplate[],
): string[] {
  return [
    ...new Set(
      contactTemplateNames
        .map((templateName) =>
          getNamedAssistantOwnerReference(
            entityTemplates.find((template) => template.name === templateName),
            entityTemplates,
          ),
        )
        .map((template) => template?.referenceName?.trim() ?? '')
        .filter(Boolean),
    ),
  ]
}

function buildOwnerRecord(
  record: SaplingGenericItem,
  ownerReference: EntityTemplate,
  ownerTemplates: EntityTemplate[],
): SaplingGenericItem {
  const rawReference = record[ownerReference.name]
  const ownerRecord: SaplingGenericItem =
    rawReference && typeof rawReference === 'object' && !Array.isArray(rawReference)
      ? { ...(rawReference as SaplingGenericItem) }
      : typeof rawReference === 'string' || typeof rawReference === 'number'
        ? { handle: rawReference }
        : {}

  for (const template of ownerTemplates) {
    if (ownerRecord[template.name] != null) continue

    const projectedValue = record[projectedFieldName(ownerReference.name, template.name)]
    if (projectedValue != null) {
      ownerRecord[template.name] = projectedValue
    }
  }

  return ownerRecord
}

/**
 * Returns the isValue label of the record that owns each active mail/phone field.
 * Direct fields belong to the edited record; named-assistant fields belong to their reference.
 */
export function getCommunicationRecordLabel(
  record: SaplingGenericItem,
  entityTemplates: EntityTemplate[],
  contactTemplateNames: string[],
  referenceTemplates: EntityValueReferenceTemplates = {},
): string {
  const mainRecordLabel = getCommunicationValueLabel(
    { ...record, handle: undefined },
    entityTemplates,
    referenceTemplates,
  )
  const labels: string[] = []

  for (const templateName of contactTemplateNames) {
    const contactTemplate = entityTemplates.find((template) => template.name === templateName)
    const ownerReference = getNamedAssistantOwnerReference(contactTemplate, entityTemplates)

    if (!ownerReference?.referenceName) {
      if (mainRecordLabel) labels.push(mainRecordLabel)
      continue
    }

    const ownerTemplates = referenceTemplates[ownerReference.referenceName]
    if (!ownerTemplates?.length) continue

    const ownerRecord = buildOwnerRecord(record, ownerReference, ownerTemplates)
    const ownerLabel = getCommunicationValueLabel(ownerRecord, ownerTemplates, referenceTemplates)
    if (ownerLabel) labels.push(ownerLabel)
  }

  return [...new Set(labels)].join(' · ') || mainRecordLabel
}
