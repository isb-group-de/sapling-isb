import type { EntityTemplate } from '@/entity/structure'
import type { SongbirdFormField } from '@/composables/system/songbirdForm.types'
export function describeSongbirdFormField(
  template: EntityTemplate,
  label: string,
): SongbirdFormField | null {
  if (
    ['handle', '__proto__', 'constructor', 'prototype'].includes(template.name) ||
    template.isAutoIncrement ||
    template.inlineCollection ||
    template.genericReference ||
    template.formConfig?.renderer === 'password' ||
    template.options?.some((option) =>
      ['isSecurity', 'isReadOnly', 'isAutoKey'].includes(option),
    ) ||
    template.fieldAccess?.allowRead === false ||
    ['1:m', 'm:n', 'n:m'].includes(template.kind ?? '')
  )
    return null
  const renderer = template.formConfig?.renderer
  const type: SongbirdFormField['type'] = template.isReference
    ? 'reference'
    : template.type === 'datetime' || renderer === 'dateTime'
      ? 'datetime'
      : template.type === 'DateType' || renderer === 'date'
        ? 'date'
        : template.type === 'time' || renderer === 'time'
          ? 'time'
          : template.type === 'boolean' || renderer === 'boolean'
            ? 'boolean'
            : template.type === 'JsonType' || renderer === 'json'
              ? 'json'
              : renderer === 'multiSelect' || template.customField?.type === 'multiSelect'
                ? 'multiSelect'
                : template.type === 'number' ||
                    ['number', 'money', 'percent'].includes(renderer ?? '') ||
                    template.options?.some((option) =>
                      ['isNumeric', 'isMoney', 'isPercent'].includes(option),
                    )
                  ? 'number'
                  : 'string'
  if (type === 'reference' && !template.referenceName) return null
  return {
    name: template.name,
    label,
    type,
    nullable: template.nullable !== false && !template.isRequired,
    referenceEntity: template.referenceName,
    integer: template.isInteger,
    ...(template.customField?.options
      ? { choices: template.customField.options.map((option) => option.value) }
      : {}),
  }
}
export function normalizeSongbirdFormValue(field: SongbirdFormField, value: unknown): unknown {
  const invalid = () => {
    throw new Error('aiChat.formInvalidValue')
  }
  if (value === null) {
    if (!field.nullable) return invalid()
    return field.type === 'datetime' ? '' : null
  }
  if (field.type === 'json') return JSON.parse(JSON.stringify(value))
  if (field.type === 'reference') {
    if (
      (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) ||
      (typeof value === 'string' && value.length > 0 && value.length <= 128)
    )
      return value
    return invalid()
  }
  if (field.type === 'number')
    return typeof value === 'number' &&
      Number.isFinite(value) &&
      (!field.integer || Number.isInteger(value))
      ? value
      : invalid()
  if (field.type === 'boolean') return typeof value === 'boolean' ? value : invalid()
  if (field.type === 'multiSelect')
    return Array.isArray(value) &&
      value.every(
        (item) => typeof item === 'string' && (!field.choices || field.choices.includes(item)),
      )
      ? [...value]
      : invalid()
  if (typeof value !== 'string' || (field.choices && !field.choices.includes(value)))
    return invalid()
  if (['date', 'datetime'].includes(field.type)) {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value)
    if (!match || (field.type === 'datetime' && !match[4]) || (field.type === 'date' && match[4]))
      return invalid()
    const year = Number(match[1]),
      month = Number(match[2]),
      day = Number(match[3])
    const date = new Date(year, month - 1, day)
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day ||
      Number(match[4] ?? 0) > 23 ||
      Number(match[5] ?? 0) > 59 ||
      Number(match[6] ?? 0) > 59
    )
      return invalid()
  }
  if (field.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value))
    return invalid()
  return value
}
