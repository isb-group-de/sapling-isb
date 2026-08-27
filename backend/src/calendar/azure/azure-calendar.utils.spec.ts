import { describe, expect, it } from '@jest/globals';

import { resolveAzureOnlineMeetingUrl } from './azure-calendar.utils';

describe('resolveAzureOnlineMeetingUrl', () => {
  it('prefers the structured Microsoft Graph join URL', () => {
    expect(
      resolveAzureOnlineMeetingUrl({
        onlineMeeting: {
          joinUrl: ' https://teams.microsoft.com/l/meetup-join/structured ',
        },
        onlineMeetingUrl:
          'https://teams.microsoft.com/l/meetup-join/deprecated',
      }),
    ).toBe('https://teams.microsoft.com/l/meetup-join/structured');
  });

  it('falls back to a Teams link in the Outlook HTML body', () => {
    expect(
      resolveAzureOnlineMeetingUrl({
        body: {
          contentType: 'html',
          content:
            '<a href="https://teams.microsoft.com/l/meetup-join/abc?context=one&amp;tenant=two">Click here to join the meeting</a>',
        },
      }),
    ).toBe(
      'https://teams.microsoft.com/l/meetup-join/abc?context=one&tenant=two',
    );
  });

  it('unwraps Outlook Safe Links before storing the meeting URL', () => {
    const teamsUrl =
      'https://teams.microsoft.com/l/meetup-join/abc?context=tenant';
    const safeLink = `https://eur01.safelinks.protection.outlook.com/?url=${encodeURIComponent(teamsUrl)}&data=tracking`;

    expect(
      resolveAzureOnlineMeetingUrl({
        body: { content: `<a href="${safeLink}">Join Microsoft Teams</a>` },
      }),
    ).toBe(teamsUrl);
  });

  it('uses a URL location before inspecting body links', () => {
    expect(
      resolveAzureOnlineMeetingUrl({
        locations: [{ locationUri: 'https://conference.example.test/room/42' }],
        body: {
          content:
            '<a href="https://teams.microsoft.com/l/meetup-join/body">Join</a>',
        },
      }),
    ).toBe('https://conference.example.test/room/42');
  });

  it('does not treat an unrelated signature link as a meeting URL', () => {
    expect(
      resolveAzureOnlineMeetingUrl({
        body: {
          content: '<p>Regards</p><a href="https://example.com">Website</a>',
        },
      }),
    ).toBeNull();
  });
});
