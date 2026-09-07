import { EntityManager } from '@mikro-orm/core';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { EmailSignatureItem } from '../../entity/EmailSignatureItem';
import { PersonItem } from '../../entity/PersonItem';
import { MailSignatureSettingsDto } from './dto/mail-signature.dto';
import { MailPreviewDto } from './dto/mail.dto';

@Injectable()
export class MailSignatureService {
  constructor(private readonly em: EntityManager) {}

  async settings(currentUser: PersonItem) {
    if (currentUser.handle == null)
      throw new ForbiddenException('global.permissionDenied');
    const person = await this.em.findOneOrFail(
      PersonItem,
      { handle: currentUser.handle },
      {
        populate: ['defaultEmailSignature'],
      },
    );
    const signature = person.defaultEmailSignature;
    return {
      signatureRotation: person.emailSignatureRotation ?? true,
      defaultSignatureHandle:
        signature?.isActive &&
        (signature.person as PersonItem | undefined)?.handle ===
          currentUser.handle
          ? (signature.handle ?? null)
          : null,
    };
  }

  async saveSettings(currentUser: PersonItem, dto: MailSignatureSettingsDto) {
    if (currentUser.handle == null)
      throw new ForbiddenException('global.permissionDenied');
    if (!dto.signatureRotation && dto.defaultSignatureHandle == null) {
      throw new BadRequestException('mail.signatureRequired');
    }
    const person = await this.em.findOneOrFail(PersonItem, {
      handle: currentUser.handle,
    });
    const signature =
      dto.defaultSignatureHandle == null
        ? null
        : await this.em.findOne(EmailSignatureItem, {
            handle: dto.defaultSignatureHandle,
            person: { handle: currentUser.handle },
            isActive: true,
          });
    if (dto.defaultSignatureHandle != null && !signature) {
      throw new BadRequestException('mail.signatureUnavailable');
    }
    person.emailSignatureRotation = dto.signatureRotation;
    person.defaultEmailSignature = signature;
    await this.em.flush();
    return this.settings(currentUser);
  }

  async resolve(
    dto: MailPreviewDto,
    currentUser: PersonItem,
  ): Promise<EmailSignatureItem | null> {
    // Existing integrations remain opt-in; the manual composer always sends a mode.
    if (!dto.signatureMode || dto.signatureMode === 'none') return null;
    const settings = await this.settings(currentUser);
    const rotating = dto.signatureMode === 'rotation';
    const handle =
      dto.signatureHandle ??
      (rotating ? null : settings.defaultSignatureHandle);
    if (handle != null) {
      const signature = await this.em.findOne(EmailSignatureItem, {
        handle,
        person: { handle: currentUser.handle },
        isActive: true,
        ...(rotating ? { useInRotation: true } : {}),
      });
      if (!signature)
        throw new BadRequestException('mail.signatureUnavailable');
      return signature;
    }
    if (!rotating) return null;
    return this.em.findOne(
      EmailSignatureItem,
      {
        person: { handle: currentUser.handle },
        isActive: true,
        useInRotation: true,
      },
      { orderBy: { lastUsedAt: 'ASC NULLS FIRST', handle: 'ASC' } },
    );
  }
}
