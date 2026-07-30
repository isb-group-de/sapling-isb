import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, TransactionPropagation } from '@mikro-orm/core';
import { EventItem } from '../../entity/EventItem';
import { PersonItem } from '../../entity/PersonItem';
import type { ScriptServerContext } from '../../script/core/script.interface';
import {
  expandFiniteRecurrence,
  parseRecurrenceRule,
  RECURRENCE_MAX_OCCURRENCES,
  type RecurrenceOccurrence,
} from '../../calendar/calendar.recurrence';
import {
  GenericEntityMutationService,
  type GenericPostCommitTask,
} from './generic-entity-mutation.service';
import type {
  MaterializeEventRecurrenceDto,
  MaterializeEventRecurrenceResponseDto,
} from './dto/materialize-event-recurrence.dto';

/** Converts one finite recurring Event into atomic standalone Event records. */
@Injectable()
export class EventRecurrenceMutationService {
  constructor(
    private readonly em: EntityManager,
    private readonly genericEntityMutationService: GenericEntityMutationService,
  ) {}

  async materialize(
    handle: string | number,
    request: MaterializeEventRecurrenceDto,
    currentUser: PersonItem,
    scriptContext: ScriptServerContext,
  ): Promise<MaterializeEventRecurrenceResponseDto> {
    const normalizedHandle = Number(handle);
    if (!Number.isInteger(normalizedHandle) || normalizedHandle <= 0) {
      throw new NotFoundException('global.entityNotFound');
    }

    const postCommitTasks: GenericPostCommitTask[] = [];
    const handles: Array<string | number> = [];
    const materializationContext: ScriptServerContext = {
      ...scriptContext,
      suppressNotificationSubscriptions: true,
      postCommitTasks,
    };
    const sourceMaterializationContext: ScriptServerContext = {
      ...materializationContext,
      calendarDeliveryOperation: 'remove-recurrence',
    };
    const occurrenceMaterializationContext: ScriptServerContext = {
      ...materializationContext,
      calendarDeliveryOperation: undefined,
    };

    await this.em.transactional(
      async () => {
        const event = await this.em.findOne(
          EventItem,
          { handle: normalizedHandle },
          {
            populate: [
              'type',
              'category',
              'assigneeCompany',
              'assigneePerson',
              'creatorCompany',
              'creatorPerson',
              'ticket',
              'salesOpportunity',
              'status',
              'participants',
            ],
          },
        );
        if (!event) {
          throw new NotFoundException('global.entityNotFound');
        }

        const expansion = expandFiniteRecurrence(
          new Date(event.startDate),
          new Date(event.endDate),
          event.recurrenceRule,
          RECURRENCE_MAX_OCCURRENCES,
        );
        if (!parseRecurrenceRule(event.recurrenceRule)) {
          throw new BadRequestException('event.recurrenceRequired');
        }
        if (!expansion.isFinite) {
          throw new BadRequestException('event.recurrenceFiniteRequired');
        }
        if (expansion.occurrences.length === 0) {
          throw new BadRequestException('event.recurrenceRequired');
        }
        if (!expansion.isComplete) {
          throw new BadRequestException('event.recurrenceTooManyOccurrences');
        }

        const updated = await this.genericEntityMutationService.update(
          'event',
          normalizedHandle,
          { recurrenceRule: null },
          currentUser,
          [],
          sourceMaterializationContext,
          {
            expectedUpdatedAt: request.expectedUpdatedAt,
            resolution: 'detect',
          },
          { postCommitTasks },
        );
        handles.push(this.extractHandle(updated) ?? normalizedHandle);

        for (const occurrence of expansion.occurrences.slice(1)) {
          const created = await this.genericEntityMutationService.create(
            'event',
            this.buildOccurrencePayload(event, occurrence),
            currentUser,
            occurrenceMaterializationContext,
            { postCommitTasks },
          );
          const createdHandle = this.extractHandle(created);
          if (createdHandle != null) {
            handles.push(createdHandle);
          }
        }
      },
      { propagation: TransactionPropagation.REQUIRED },
    );

    this.genericEntityMutationService.schedulePostCommitTasks(postCommitTasks);
    return {
      materializedCount: handles.length,
      handles,
    };
  }

  private buildOccurrencePayload(
    event: EventItem,
    occurrence: RecurrenceOccurrence,
  ): Record<string, unknown> {
    return {
      title: event.title,
      description: event.description ?? null,
      startDate: occurrence.startDate,
      endDate: occurrence.endDate,
      isAllDay: event.isAllDay,
      isPrivate: event.isPrivate,
      recurrenceRule: null,
      preparationDuration: event.preparationDuration,
      followUpDuration: event.followUpDuration,
      onlineMeetingURL: event.onlineMeetingURL ?? null,
      type: this.getReferenceHandle(event.type),
      category: this.getReferenceHandle(event.category),
      assigneeCompany: this.getReferenceHandle(event.assigneeCompany),
      assigneePerson: this.getReferenceHandle(event.assigneePerson),
      creatorCompany: this.getReferenceHandle(event.creatorCompany),
      creatorPerson: this.getReferenceHandle(event.creatorPerson),
      ticket: this.getReferenceHandle(event.ticket),
      salesOpportunity: this.getReferenceHandle(event.salesOpportunity),
      status: this.getReferenceHandle(event.status),
      participants: event.participants
        .getItems()
        .map((participant) => participant.handle)
        .filter((participantHandle): participantHandle is number =>
          Number.isInteger(participantHandle),
        ),
    };
  }

  private getReferenceHandle(value: unknown): string | number | null {
    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    if (!value || typeof value !== 'object') {
      return null;
    }

    const reference = value as {
      handle?: unknown;
      unwrap?: () => { handle?: unknown };
    };
    const handle =
      reference.handle ??
      (typeof reference.unwrap === 'function'
        ? reference.unwrap()?.handle
        : undefined);
    return typeof handle === 'string' || typeof handle === 'number'
      ? handle
      : null;
  }

  private extractHandle(item: object): string | number | null {
    const handle = (item as { handle?: unknown }).handle;
    return typeof handle === 'string' || typeof handle === 'number'
      ? handle
      : null;
  }
}
