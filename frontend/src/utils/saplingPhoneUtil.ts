import {
  AsYouType,
  getCountryCallingCode,
  isSupportedCountry,
  type CountryCode,
} from 'libphonenumber-js'

export type SaplingPhoneFormatOptions = {
  defaultCountry?: string | null
  defaultDialingCode?: string | null
}

function resolveCountryCode(value?: string | null): CountryCode | undefined {
  const normalizedValue = value?.trim().toUpperCase()
  return normalizedValue && isSupportedCountry(normalizedValue) ? normalizedValue : undefined
}

function resolveDialingCode(options: SaplingPhoneFormatOptions): string | undefined {
  const explicitDialingCode = options.defaultDialingCode?.replace(/\D/g, '')
  if (explicitDialingCode) {
    return explicitDialingCode
  }

  const countryCode = resolveCountryCode(options.defaultCountry)
  return countryCode ? getCountryCallingCode(countryCode) : undefined
}

function extractPhoneInput(value: string): { hasLeadingPlus: boolean; digits: string } {
  const trimmedValue = value.trim()
  const hasLeadingPlus = trimmedValue.startsWith('+')

  return {
    hasLeadingPlus,
    digits: trimmedValue.replace(/\D/g, ''),
  }
}

function sanitizeFormattedPhone(value: string): string {
  let sanitizedValue = ''

  for (const character of value) {
    if (/\d/.test(character)) {
      sanitizedValue += character
      continue
    }

    if (character === '+' && sanitizedValue.length === 0) {
      sanitizedValue += character
      continue
    }

    if (character === ' ') {
      sanitizedValue += character
    }
  }

  return sanitizedValue.replace(/\s+/g, ' ').trim()
}

function groupNationalDigits(value: string): string {
  return value.match(/.{1,3}/g)?.join(' ') ?? ''
}

function formatWithSaplingGrouping(
  candidate: string,
  options: SaplingPhoneFormatOptions,
): string | null {
  if (!candidate.startsWith('+')) {
    return null
  }

  const dialingCode = resolveDialingCode(options)
  if (!dialingCode || !candidate.startsWith(`+${dialingCode}`)) {
    return null
  }

  const nationalDigits = candidate.slice(dialingCode.length + 1)
  return nationalDigits ? `+${dialingCode} ${groupNationalDigits(nationalDigits)}` : candidate
}

function buildFormattingCandidate(value: string, options: SaplingPhoneFormatOptions): string {
  const { hasLeadingPlus, digits } = extractPhoneInput(value)
  if (!digits) {
    return ''
  }

  if (hasLeadingPlus) {
    return `+${digits}`
  }

  if (digits.startsWith('00')) {
    return `+${digits.slice(2)}`
  }

  const dialingCode = resolveDialingCode(options)
  if (digits.startsWith('0') && dialingCode) {
    return `+${dialingCode}${digits.slice(1)}`
  }

  if (dialingCode && digits.startsWith(dialingCode)) {
    return `+${digits}`
  }

  return digits
}

export function formatSaplingPhoneNumber(
  value: string | null | undefined,
  options: SaplingPhoneFormatOptions = {},
): string {
  const inputValue = value?.trim() ?? ''
  if (!inputValue) {
    return ''
  }

  const candidate = buildFormattingCandidate(inputValue, options)
  if (!candidate) {
    return ''
  }

  const countryCode = resolveCountryCode(options.defaultCountry)
  const formatter = candidate.startsWith('+') ? new AsYouType() : new AsYouType(countryCode)
  const formattedValue = formatter.input(candidate)

  return (
    formatWithSaplingGrouping(candidate, options) ??
    sanitizeFormattedPhone(formattedValue || candidate)
  )
}
