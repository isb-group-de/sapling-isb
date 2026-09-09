import { describe, expect, it } from '@jest/globals';
import { CompanyItem } from '../entity/CompanyItem';
import { EventItem } from '../entity/EventItem';
import { PersonItem } from '../entity/PersonItem';
import {
  buildCalendarHtmlDescription,
  buildCalendarTextDescription,
  CALENDAR_CONTACT_DETAILS_MARKER,
  resolveCalendarContactDetails,
  stripCalendarContactDetails,
} from './calendar-contact.utils';

function createEvent(): EventItem {
  const company = Object.assign(new CompanyItem(), {
    name: 'Muster GmbH',
    phone: ' 030 123456 ',
    mobile: '+49 170 111111',
  });
  const person = Object.assign(new PersonItem(), {
    firstName: 'Ada',
    lastName: 'Lovelace',
    phone: '+49 30 7654321',
    mobile: '+49 170 111111',
  });
  return Object.assign(new EventItem(), {
    description: 'Agenda',
    creatorCompany: company,
    creatorPerson: person,
  });
}

describe('calendar contact details', () => {
  it('resolves customer phone fields from entity decorators', () => {
    expect(resolveCalendarContactDetails(createEvent())).toEqual([
      {
        label: 'Muster GmbH',
        phoneNumbers: ['030 123456', '+49 170 111111'],
      },
      {
        label: 'Ada Lovelace',
        phoneNumbers: ['+49 30 7654321'],
      },
    ]);
  });

  it('adds provider-specific contact blocks without changing the source description', () => {
    expect(buildCalendarTextDescription(createEvent())).toBe(
      `Agenda\n\n${CALENDAR_CONTACT_DETAILS_MARKER}\nMuster GmbH: 030 123456 / +49 170 111111\nAda Lovelace: +49 30 7654321`,
    );
    expect(buildCalendarHtmlDescription(createEvent())).toBe(
      `Agenda<hr><p><strong>${CALENDAR_CONTACT_DETAILS_MARKER}</strong><br><strong>Muster GmbH</strong>: <a href="tel:030 123456">030 123456</a> / <a href="tel:+49 170 111111">+49 170 111111</a><br><strong>Ada Lovelace</strong>: <a href="tel:+49 30 7654321">+49 30 7654321</a></p>`,
    );
    expect(createEvent().description).toBe('Agenda');
  });

  it('removes generated contact details during provider imports', () => {
    expect(
      stripCalendarContactDetails(
        `Agenda\n\n${CALENDAR_CONTACT_DETAILS_MARKER}\n\nMuster GmbH: 030 123456`,
      ),
    ).toBe('Agenda');
    expect(
      stripCalendarContactDetails(
        `Agenda<hr><p><strong>${CALENDAR_CONTACT_DETAILS_MARKER}</strong><br>030 123456</p>`,
      ),
    ).toBe('Agenda');
    expect(
      stripCalendarContactDetails(CALENDAR_CONTACT_DETAILS_MARKER),
    ).toBeUndefined();
  });
});
