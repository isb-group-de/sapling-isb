import { describe, expect, it } from 'vitest'
import { formatSaplingPhoneNumber } from '../saplingPhoneUtil'

describe('formatSaplingPhoneNumber', () => {
  it('returns an empty string for empty input', () => {
    expect(formatSaplingPhoneNumber('')).toBe('')
    expect(formatSaplingPhoneNumber(null)).toBe('')
  })

  it('formats local numbers with a default country', () => {
    expect(formatSaplingPhoneNumber('0170 1234567', { defaultCountry: 'de' })).toBe(
      '+49 170 123 456 7',
    )
  })

  it('normalizes 00 prefixes into international format', () => {
    expect(formatSaplingPhoneNumber('0041 79 123 45 67')).toBe('+41 79 123 45 67')
  })

  it('prefers an explicit dialing code over the country fallback', () => {
    expect(
      formatSaplingPhoneNumber('079 123 45 67', {
        defaultCountry: 'DE',
        defaultDialingCode: '+41',
      }),
    ).toBe('+41 791 234 567')
  })

  it('normalizes numbers that already start with the default dialing code', () => {
    expect(
      formatSaplingPhoneNumber('491701234567', {
        defaultCountry: 'DE',
        defaultDialingCode: '49',
      }),
    ).toBe('+49 170 123 456 7')
  })

  it('groups national digits in triples after the dialing code', () => {
    expect(
      formatSaplingPhoneNumber('+49 1234567891', {
        defaultCountry: 'DE',
        defaultDialingCode: '49',
      }),
    ).toBe('+49 123 456 789 1')
  })
})
