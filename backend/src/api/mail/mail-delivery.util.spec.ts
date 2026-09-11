import { describe, expect, it } from '@jest/globals';
import { EmailDeliveryItem } from '../../entity/EmailDeliveryItem';
import {
  buildMailEventDescription,
  buildMailEventTitle,
} from './mail-delivery.util';

describe('mail delivery event content', () => {
  it('keeps the event title within its bounded database column', () => {
    const delivery = {
      toRecipients: [`${'recipient'.repeat(20)}@example.com`],
    } as EmailDeliveryItem;

    const title = buildMailEventTitle(delivery);

    expect(title).toHaveLength(128);
    expect(title).toMatch(/\.\.\.$/);
  });

  it('preserves the complete Markdown body in the communication event description', () => {
    const bodyMarkdown = `${'# Nachricht\n\n'}${'Langer E-Mail-Inhalt. '.repeat(200)}`;
    const delivery = {
      subject: 'Vollständiger Inhalt',
      bodyMarkdown,
    } as EmailDeliveryItem;

    expect(buildMailEventDescription(delivery)).toBe(
      `Betreff: Vollständiger Inhalt\n\n${bodyMarkdown}`,
    );
  });
});
