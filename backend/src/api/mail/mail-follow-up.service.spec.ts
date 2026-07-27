import { describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { EmailDeliveryItem } from '../../entity/EmailDeliveryItem';
import { EventStatusItem } from '../../entity/EventStatusItem';
import { EventTypeItem } from '../../entity/EventTypeItem';
import { PersonItem } from '../../entity/PersonItem';
import { MailFollowUpService } from './mail-follow-up.service';

describe('MailFollowUpService', () => {
  it('skips event creation when the configured mail event type is missing', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const creator = { handle: 7, company: { handle: 3 } } as PersonItem;
    const eventEm = {
      findOne: jest.fn((entity: unknown) => {
        if (entity === PersonItem) return Promise.resolve(creator);
        if (entity === EventStatusItem) {
          return Promise.resolve({ handle: 'completed' });
        }
        if (entity === EventTypeItem) return Promise.resolve(null);
        return Promise.resolve(null);
      }),
      create: jest.fn(),
      persist: jest.fn(),
      flush: jest.fn(() => Promise.resolve()),
    };
    const service = new MailFollowUpService();

    await service.createForDelivery(
      { fork: jest.fn(() => eventEm) } as never,
      { handle: 15, createdBy: creator } as EmailDeliveryItem,
    );

    expect(eventEm.create).not.toHaveBeenCalled();
    expect(eventEm.persist).not.toHaveBeenCalled();
    expect(eventEm.flush).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      'mailFollowUpService - missing event configuration for delivery 15',
    );
    warn.mockRestore();
  });
});
