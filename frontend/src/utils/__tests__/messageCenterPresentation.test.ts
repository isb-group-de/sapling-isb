import { describe, expect, it } from 'vitest'
import {
  formatMessageDescription,
  formatMessageTitle,
  getMessageEntityLabel,
  normalizeEntityHandle,
  type MessageTranslator,
} from '../messageCenterPresentation'

const translations: Record<string, string> = {
  'exception.deleteReferencedRecord':
    'Der Datensatz kann nicht gelöscht werden, weil er noch von „{entity}“ verwendet wird.',
  'exception.unknownError': 'Unbekannter Fehler',
  'messageCenter.detailsUnavailable': 'Weitere Informationen sind derzeit nicht verfügbar.',
  'navigation.eventDelivery': 'Kalenderübertragungen',
  'exception.referenceDependencyMismatch':
    '„{field}“ gehört nicht mehr zu „{parentField}“. Bitte passen Sie eines der beiden Felder an.',
  'ticket.creatorPerson': 'Kunde (Person)',
  'ticket.creatorCompany': 'Kunde (Firma)',
}
const translationExists = (key: string) => key in translations
const translate: MessageTranslator = (key, params) =>
  translations[key].replace(/\{(\w+)\}/g, (_match, name: string) => String(params?.[name] ?? ''))

describe('messageCenterPresentation', () => {
  it('renders structured entity parameters with the localized navigation label', () => {
    expect(
      formatMessageDescription(
        {
          description: 'exception.deleteReferencedRecord',
          descriptionParams: { entityHandle: 'eventDelivery' },
        },
        translate,
        translationExists,
      ),
    ).toBe(
      'Der Datensatz kann nicht gelöscht werden, weil er noch von „Kalenderübertragungen“ verwendet wird.',
    )
  })

  it('renders reference dependency errors with localized field labels', () => {
    expect(
      formatMessageDescription(
        {
          description: 'exception.referenceDependencyMismatch',
          descriptionParams: {
            entityHandle: 'ticket',
            fieldName: 'creatorPerson',
            parentFieldName: 'creatorCompany',
          },
        },
        translate,
        translationExists,
      ),
    ).toBe(
      '„Kunde (Person)“ gehört nicht mehr zu „Kunde (Firma)“. Bitte passen Sie eines der beiden Felder an.',
    )
  })

  it('sanitizes legacy table names while backend versions overlap', () => {
    expect(
      formatMessageDescription(
        {
          description:
            'Der Datensatz kann nicht gelöscht werden, weil er noch von "event_delivery_item" verwendet wird.',
        },
        translate,
        translationExists,
      ),
    ).toBe(
      'Der Datensatz kann nicht gelöscht werden, weil er noch von "Kalenderübertragungen" verwendet wird.',
    )
  })

  it('does not leak missing translation keys', () => {
    expect(formatMessageTitle('global.missingKey', translate, translationExists)).toBe(
      'Unbekannter Fehler',
    )
    expect(
      formatMessageDescription(
        { description: 'exception.missingDescription' },
        translate,
        translationExists,
      ),
    ).toBe('Weitere Informationen sind derzeit nicht verfügbar.')
  })

  it('keeps dotted user content such as filenames visible', () => {
    expect(
      formatMessageDescription({ description: 'kundenimport.csv' }, translate, translationExists),
    ).toBe('kundenimport.csv')
  })

  it('normalizes database table names before looking up entity translations', () => {
    expect(normalizeEntityHandle('public.event_delivery_item')).toBe('eventDelivery')
    expect(getMessageEntityLabel('event_delivery_item', translate, translationExists)).toBe(
      'Kalenderübertragungen',
    )
  })
})
