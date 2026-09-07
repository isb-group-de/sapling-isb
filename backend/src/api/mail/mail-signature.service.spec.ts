import { describe, expect, it, jest } from '@jest/globals';
jest.mock('../../entity/PersonItem', () => ({
  PersonItem: class PersonItem {},
}));
jest.mock('../../entity/EmailSignatureItem', () => ({
  EmailSignatureItem: class EmailSignatureItem {},
}));
import { MailSignatureService } from './mail-signature.service';
import { EmailSignatureItem } from '../../entity/EmailSignatureItem';
import { PersonItem } from '../../entity/PersonItem';

function setup() {
  const person = {
    handle: 7,
    emailSignatureRotation: true,
    defaultEmailSignature: null,
  } as unknown as PersonItem;
  const em = {
    findOneOrFail: jest
      .fn<(...args: unknown[]) => Promise<PersonItem>>()
      .mockResolvedValue(person),
    findOne: jest
      .fn<(...args: unknown[]) => Promise<EmailSignatureItem | null>>()
      .mockResolvedValue(null),
    flush: jest.fn<() => Promise<void>>().mockResolvedValue(),
  };
  return { person, em, service: new MailSignatureService(em as never) };
}

describe('MailSignatureService', () => {
  it.each([undefined, 'none'] as const)(
    'keeps unsigned messages unchanged (%s)',
    async (signatureMode) => {
      const { service, person, em } = setup();
      expect(
        await service.resolve(
          { entityHandle: 'ticket', signatureMode },
          person,
        ),
      ).toBeNull();
      expect(em.findOne).not.toHaveBeenCalled();
      expect(em.findOneOrFail).not.toHaveBeenCalled();
    },
  );

  it('selects only active rotation candidates, unused first, with a stable tie breaker', async () => {
    const { service, person, em } = setup();
    await service.resolve(
      { entityHandle: 'ticket', signatureMode: 'rotation' },
      person,
    );
    expect(em.findOne).toHaveBeenCalledWith(
      EmailSignatureItem,
      { person: { handle: 7 }, isActive: true, useInRotation: true },
      { orderBy: { lastUsedAt: 'ASC NULLS FIRST', handle: 'ASC' } },
    );
    expect(em.flush).not.toHaveBeenCalled();
  });

  it('keeps the preview selection pinned and checks its rotation eligibility again', async () => {
    const { service, person, em } = setup();
    const signature = {
      handle: 12,
      bodyMarkdown: 'Beste Grüße',
    } as EmailSignatureItem;
    em.findOne.mockResolvedValue(signature);
    expect(
      await service.resolve(
        {
          entityHandle: 'ticket',
          signatureMode: 'rotation',
          signatureHandle: 12,
        },
        person,
      ),
    ).toBe(signature);
    expect(em.findOne).toHaveBeenCalledWith(EmailSignatureItem, {
      handle: 12,
      person: { handle: 7 },
      isActive: true,
      useInRotation: true,
    });
  });

  it('allows an active signature excluded from rotation when selected explicitly', async () => {
    const { service, person, em } = setup();
    em.findOne.mockResolvedValue({
      handle: 12,
      useInRotation: false,
    } as EmailSignatureItem);
    await service.resolve(
      { entityHandle: 'ticket', signatureMode: 'fixed', signatureHandle: 12 },
      person,
    );
    expect(em.findOne).toHaveBeenCalledWith(EmailSignatureItem, {
      handle: 12,
      person: { handle: 7 },
      isActive: true,
    });
  });

  it('rejects an unavailable, foreign, or deactivated explicit signature', async () => {
    const { service, person } = setup();
    await expect(
      service.resolve(
        { entityHandle: 'ticket', signatureMode: 'fixed', signatureHandle: 12 },
        person,
      ),
    ).rejects.toThrow('mail.signatureUnavailable');
  });

  it('uses the personal fixed default when no explicit signature is supplied', async () => {
    const { service, person, em } = setup();
    person.defaultEmailSignature = {
      handle: 12,
      person,
      isActive: true,
    } as EmailSignatureItem;
    em.findOne.mockResolvedValue(person.defaultEmailSignature);
    expect(
      await service.resolve(
        { entityHandle: 'ticket', signatureMode: 'fixed' },
        person,
      ),
    ).toBe(person.defaultEmailSignature);
  });

  it('ignores an inactive default without selecting an unrelated signature', async () => {
    const { service, person, em } = setup();
    person.defaultEmailSignature = {
      handle: 12,
      person,
      isActive: false,
    } as EmailSignatureItem;
    expect(
      await service.resolve(
        { entityHandle: 'ticket', signatureMode: 'fixed' },
        person,
      ),
    ).toBeNull();
    expect(em.findOne).not.toHaveBeenCalled();
  });

  it('validates default ownership before changing settings', async () => {
    const { service, person, em } = setup();
    await expect(
      service.saveSettings(person, {
        signatureRotation: false,
        defaultSignatureHandle: 99,
      }),
    ).rejects.toThrow('mail.signatureUnavailable');
    expect(person.emailSignatureRotation).toBe(true);
    expect(em.flush).not.toHaveBeenCalled();
  });

  it('requires a fixed signature when rotation is disabled', async () => {
    const { service, person, em } = setup();
    await expect(
      service.saveSettings(person, {
        signatureRotation: false,
        defaultSignatureHandle: null,
      }),
    ).rejects.toThrow('mail.signatureRequired');
    expect(em.flush).not.toHaveBeenCalled();
  });

  it('fails closed without an authenticated owner', async () => {
    const { service, em } = setup();
    await expect(service.settings({} as PersonItem)).rejects.toThrow(
      'global.permissionDenied',
    );
    expect(em.findOneOrFail).not.toHaveBeenCalled();
  });
});
