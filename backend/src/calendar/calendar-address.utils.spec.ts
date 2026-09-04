import { describe, expect, it } from '@jest/globals';
import { CompanyItem } from '../entity/CompanyItem';
import { CountryItem } from '../entity/CountryItem';
import { EventItem } from '../entity/EventItem';
import { resolveCalendarEventLocation } from './calendar-address.utils';

describe('resolveCalendarEventLocation', () => {
  it('concatenates all non-empty address fields in declaration order', () => {
    const country = Object.assign(new CountryItem(), {
      handle: 'DE',
      name: ' Deutschland ',
    });
    const company = Object.assign(new CompanyItem(), {
      name: ' Muster GmbH ',
      street: ' Musterstraße 1 ',
      zip: '10115',
      city: ' Berlin ',
      country,
    });
    const event = Object.assign(new EventItem(), { creatorCompany: company });

    expect(resolveCalendarEventLocation(event)).toBe(
      'Muster GmbH, Musterstraße 1, 10115, Berlin, Deutschland',
    );
  });

  it('omits empty values and returns null without a customer company', () => {
    const company = Object.assign(new CompanyItem(), {
      name: 'Muster GmbH',
      street: '   ',
    });

    expect(
      resolveCalendarEventLocation(
        Object.assign(new EventItem(), { creatorCompany: company }),
      ),
    ).toBe('Muster GmbH');
    expect(resolveCalendarEventLocation(new EventItem())).toBeNull();
  });
});
