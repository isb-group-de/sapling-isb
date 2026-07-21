import { EntityManager, RequiredEntityData } from '@mikro-orm/core';
import { Injectable, Logger } from '@nestjs/common';
import { CompanyItem } from '../../entity/CompanyItem';
import { EmailDeliveryItem } from '../../entity/EmailDeliveryItem';
import { EventItem } from '../../entity/EventItem';
import { EventStatusItem } from '../../entity/EventStatusItem';
import { EventTypeItem } from '../../entity/EventTypeItem';
import { PersonItem } from '../../entity/PersonItem';
import { SalesOpportunityItem } from '../../entity/SalesOpportunityItem';
import { TicketItem } from '../../entity/TicketItem';
import {
  buildMailEventDescription,
  buildMailEventTitle,
  normalizeEmailAddress,
} from './mail-delivery.util';

const MAIL_EVENT_DURATION_MINUTES = 5;

interface MailEventSourceRefs {
  creatorCompanyRef: CompanyItem | undefined;
  creatorPersonRef: PersonItem | undefined;
  sourcePersonRef: PersonItem | null;
  ticketRef?: TicketItem;
  salesOpportunityRef?: SalesOpportunityItem;
}

@Injectable()
export class MailFollowUpService {
  private readonly logger = new Logger(MailFollowUpService.name);

  /** Follow-up failures are deliberately isolated from successful delivery. */
  async createForDelivery(
    em: EntityManager,
    delivery: EmailDeliveryItem,
  ): Promise<void> {
    try {
      const eventEm = em.fork();
      const creator = await eventEm.findOne(
        PersonItem,
        { handle: delivery.createdBy?.handle },
        { populate: ['company'] },
      );

      if (!creator) {
        this.logger.warn(
          `mailFollowUpService - missing creator for delivery ${delivery.handle}`,
        );
        return;
      }

      const [eventType, eventStatus] = await Promise.all([
        eventEm.findOne(EventTypeItem, { handle: 'mail' }),
        eventEm.findOne(EventStatusItem, { handle: 'completed' }),
      ]);
      if (!eventType || !eventStatus) {
        this.logger.warn(
          `mailFollowUpService - missing event configuration for delivery ${delivery.handle}`,
        );
        return;
      }
      const startDate = delivery.completedAt ?? new Date();
      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + MAIL_EVENT_DURATION_MINUTES);
      const creatorCompanyRef =
        creator.company?.handle != null
          ? eventEm.getReference(CompanyItem, creator.company.handle as never)
          : undefined;
      const creatorPersonRef =
        creator.handle != null
          ? eventEm.getReference(PersonItem, creator.handle as never)
          : undefined;
      const sourceRefs = await this.resolveSourceRefs(
        eventEm,
        delivery,
        creatorCompanyRef,
        creatorPersonRef,
      );
      const event = eventEm.create(EventItem, {
        title: buildMailEventTitle(delivery),
        description: buildMailEventDescription(delivery),
        startDate,
        endDate,
        isAllDay: false,
        onlineMeetingURL: '',
        type: eventType,
        status: eventStatus,
        assigneeCompany: creatorCompanyRef,
        assigneePerson: creatorPersonRef,
        creatorCompany: sourceRefs.creatorCompanyRef,
        creatorPerson: sourceRefs.creatorPersonRef,
        ticket: sourceRefs.ticketRef,
        salesOpportunity: sourceRefs.salesOpportunityRef,
      } as RequiredEntityData<EventItem>);

      await this.attachParticipants(
        eventEm,
        event,
        creatorPersonRef,
        sourceRefs.sourcePersonRef,
        delivery.toRecipients ?? [],
      );
      eventEm.persist(event);
      await eventEm.flush();
    } catch (error) {
      this.logger.error(
        `mailFollowUpService - failed for delivery ${delivery.handle}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  private async resolveSourceRefs(
    eventEm: EntityManager,
    delivery: EmailDeliveryItem,
    defaultCreatorCompanyRef: CompanyItem | undefined,
    defaultCreatorPersonRef: PersonItem | undefined,
  ): Promise<MailEventSourceRefs> {
    let creatorCompanyRef = defaultCreatorCompanyRef;
    let creatorPersonRef = defaultCreatorPersonRef;
    let sourcePersonRef: PersonItem | null = null;
    let ticketRef: TicketItem | undefined;
    let salesOpportunityRef: SalesOpportunityItem | undefined;
    const sourceEntityHandle = delivery.entity?.handle;
    const sourceReferenceHandle = delivery.referenceHandle;
    const hasSourceReference =
      sourceReferenceHandle != null && sourceReferenceHandle !== '';

    if (sourceEntityHandle === 'ticket' && hasSourceReference) {
      const ticketHandle = Number(sourceReferenceHandle);
      if (Number.isFinite(ticketHandle)) {
        ticketRef = eventEm.getReference(TicketItem, ticketHandle as never);
      }
    } else if (
      sourceEntityHandle === 'salesOpportunity' &&
      hasSourceReference
    ) {
      const opportunityHandle = Number(sourceReferenceHandle);
      if (Number.isFinite(opportunityHandle)) {
        salesOpportunityRef = eventEm.getReference(
          SalesOpportunityItem,
          opportunityHandle as never,
        );
      }
    }

    if (sourceEntityHandle === 'person' && hasSourceReference) {
      const sourcePersonHandle = Number(sourceReferenceHandle);
      if (Number.isFinite(sourcePersonHandle)) {
        const sourcePerson = await eventEm.findOne(
          PersonItem,
          { handle: sourcePersonHandle },
          { populate: ['company'] },
        );
        if (sourcePerson?.handle != null) {
          creatorPersonRef = eventEm.getReference(
            PersonItem,
            sourcePerson.handle as never,
          );
          if (sourcePerson.company?.handle != null) {
            creatorCompanyRef = eventEm.getReference(
              CompanyItem,
              sourcePerson.company.handle as never,
            );
          }
          sourcePersonRef = creatorPersonRef;
        }
      }
    }

    return {
      creatorCompanyRef,
      creatorPersonRef,
      sourcePersonRef,
      ticketRef,
      salesOpportunityRef,
    };
  }

  private async attachParticipants(
    eventEm: EntityManager,
    event: EventItem,
    creatorPersonRef: PersonItem | undefined,
    sourcePersonRef: PersonItem | null,
    recipientEmails: string[],
  ): Promise<void> {
    if (creatorPersonRef) {
      event.participants.add(creatorPersonRef);
    }

    const recipientPersons = await this.findPersonsByEmails(
      eventEm,
      recipientEmails,
    );
    for (const person of recipientPersons) {
      if (person.handle != null) {
        event.participants.add(
          eventEm.getReference(PersonItem, person.handle as never),
        );
      }
    }
    if (sourcePersonRef) {
      event.participants.add(sourcePersonRef);
    }
  }

  private async findPersonsByEmails(
    em: EntityManager,
    emails: string[],
  ): Promise<PersonItem[]> {
    const normalized = Array.from(
      new Set(
        emails
          .map((email) => normalizeEmailAddress(email))
          .filter((value): value is string => Boolean(value)),
      ),
    );
    return normalized.length === 0
      ? []
      : em.find(PersonItem, { email: { $in: normalized } });
  }
}
