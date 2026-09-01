import { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { CompanyItem } from '../../entity/CompanyItem';
import { normalizeEmailAddress } from './mail-delivery.util';
import { CustomerAssociationResolverService } from './customer-association-resolver.service';

export interface CustomerCcContext {
  entityHandle: string;
  itemHandle?: string | number;
  draftValues?: Record<string, unknown>;
  to?: string[];
  cc?: string[];
  bcc?: string[];
}

@Injectable()
export class CustomerCcService {
  constructor(
    private readonly customerAssociationResolver: CustomerAssociationResolverService,
  ) {}

  async resolveAdditionalCc(
    em: EntityManager,
    context: CustomerCcContext,
  ): Promise<string[]> {
    const association = await this.customerAssociationResolver.resolve(
      em,
      context.entityHandle,
      context.itemHandle,
      context.draftValues,
    );

    return this.resolveAdditionalCcForCompany(em, association.company, context);
  }

  async resolveAdditionalCcForCompany(
    em: EntityManager,
    company: CompanyItem | null,
    recipients: Pick<CustomerCcContext, 'to' | 'cc' | 'bcc'>,
  ): Promise<string[]> {
    if (company?.handle == null) {
      return [];
    }

    const configuredCompany = await em.findOne(
      CompanyItem,
      { handle: company.handle },
      { populate: ['automaticCcPersons'] },
    );
    const configuredEmails =
      configuredCompany?.automaticCcPersons
        .getItems()
        .filter((person) => person.isActive !== false)
        .map((person) => normalizeEmailAddress(person.email))
        .filter((email): email is string => Boolean(email)) ?? [];

    return findMissingCcRecipients(configuredEmails, recipients);
  }
}

export function findMissingCcRecipients(
  configuredEmails: string[],
  recipients: Pick<CustomerCcContext, 'to' | 'cc' | 'bcc'>,
): string[] {
  const occupied = new Set(
    [
      ...(recipients.to ?? []),
      ...(recipients.cc ?? []),
      ...(recipients.bcc ?? []),
    ]
      .map(emailKey)
      .filter((email): email is string => Boolean(email)),
  );
  const additionalCc: string[] = [];

  for (const value of configuredEmails) {
    const normalized = normalizeEmailAddress(value);
    const key = emailKey(normalized);
    if (!normalized || !key || occupied.has(key)) {
      continue;
    }

    occupied.add(key);
    additionalCc.push(normalized);
  }

  return additionalCc;
}

function emailKey(value: string | null | undefined): string | null {
  return normalizeEmailAddress(value)?.toLowerCase() ?? null;
}
