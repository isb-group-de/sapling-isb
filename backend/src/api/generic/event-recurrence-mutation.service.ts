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
  findRecurrenceOccurrence,
} from '../../calendar/calendar.recurrence';
import {
  GenericEntityMutationService,
  type GenericPostCommitTask,
} from './generic-entity-mutation.service';
import type {
  MaterializeEventRecurrenceDto,
  MaterializeEventRecurrenceResponseDto,
} from './dto/materialize-event-recurrence.dto';
import type {
  DetachEventOccurrenceDto,
  DetachEventOccurrenceResponseDto,
} from './dto/detach-event-occurrence.dto';

const DETACHED_EVENT_EDITABLE_FIELDS = [
  'title',
  'description',
  'startDate',
  'endDate',
  'isAllDay',
  'isPrivate',
  'preparationDuration',
  'followUpDuration',
  'onlineMeetingURL',
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
] as const;

/** Converts one finite recurring Event into atomic standalone Event records. */
@Injectable()
export class EventRecurrenceMutationService {
  constructor(
    private readonly em: EntityManager,
    private readonly genericEntityMutationService: GenericEntityMutationService,
  ) {}

  async detachOccurrence(
    handle: string | number,
    request: DetachEventOccurrenceDto,
    currentUser: PersonItem,
    scriptContext: ScriptServerContext,
  ): Promise<DetachEventOccurrenceResponseDto> {
    const normalizedHandle = Number(handle);
    if (!Number.isInteger(normalizedHandle) || normalizedHandle <= 0) {
      throw new NotFoundException('global.entityNotFound');
    }

    const occurrenceStart = new Date(request.occurrenceStart);
    const postCommitTasks: GenericPostCommitTask[] = [];
    let detachedEvent: object | null = null;
    const baseContext: ScriptServerContext = {
      ...scriptContext,
      suppressNotificationSubscriptions: true,
      postCommitTasks,
    };

    await this.em.transactional(
      async () => {
        const event = await this.loadRecurringEvent(normalizedHandle);
        const occurrence = findRecurrenceOccurrence(
          new Date(event.startDate),
          new Date(event.endDate),
          event.recurrenceRule,
          occurrenceStart,
        );
        if (!occurrence) {
          throw new BadRequestException('event.recurrenceOccurrenceInvalid');
        }

        const normalizedOccurrenceStart = occurrence.startDate.toISOString();
        const existingExceptions = this.normalizeExceptionDates(
          event.recurrenceExceptionDates,
        );
        if (existingExceptions.includes(normalizedOccurrenceStart)) {
          throw new BadRequestException('event.recurrenceOccurrenceDetached');
        }

        await this.genericEntityMutationService.update(
          'event',
          normalizedHandle,
          {
            recurrenceExceptionDates: [
              ...existingExceptions,
              normalizedOccurrenceStart,
            ].sort(),
          },
          currentUser,
          [],
          {
            ...baseContext,
            calendarDeliveryOperation: 'detach-occurrence',
            calendarDeliveryOccurrenceStart: normalizedOccurrenceStart,
          },
          {
            expectedUpdatedAt: request.expectedUpdatedAt,
            resolution: 'detect',
          },
          { postCommitTasks },
        );

        detachedEvent = await this.genericEntityMutationService.create(
          'event',
          this.buildDetachedOccurrencePayload(event, occurrence, request.event),
          currentUser,
          {
            ...baseContext,
            calendarDeliveryOperation: undefined,
            calendarDeliveryOccurrenceStart: undefined,
          },
          { postCommitTasks },
        );
      },
      { propagation: TransactionPropagation.REQUIRED },
    );

    this.genericEntityMutationService.schedulePostCommitTasks(postCommitTasks);
    if (!detachedEvent) {
      throw new BadRequestException('event.recurrenceOccurrenceInvalid');
    }
    return { seriesHandle: normalizedHandle, detachedEvent };
  }

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

        const excludedStarts = new Set(
          this.normalizeExceptionDates(event.recurrenceExceptionDates),
        );
        const remainingOccurrences = expansion.occurrences.filter(
          (occurrence) =>
            !excludedStarts.has(occurrence.startDate.toISOString()),
        );
        if (remainingOccurrences.length === 0) {
          throw new BadRequestException(
            'event.recurrenceNoRemainingOccurrences',
          );
        }
        const [firstOccurrence, ...laterOccurrences] = remainingOccurrences;

        const updated = await this.genericEntityMutationService.update(
          'event',
          normalizedHandle,
          {
            startDate: firstOccurrence.startDate,
            endDate: firstOccurrence.endDate,
            recurrenceRule: null,
            recurrenceExceptionDates: [],
          },
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

        for (const occurrence of laterOccurrences) {
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

  private async loadRecurringEvent(handle: number): Promise<EventItem> {
    const event = await this.em.findOne(
      EventItem,
      { handle },
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
    if (!parseRecurrenceRule(event.recurrenceRule)) {
      throw new BadRequestException('event.recurrenceRequired');
    }
    return event;
  }

  private buildDetachedOccurrencePayload(
    event: EventItem,
    occurrence: RecurrenceOccurrence,
    submitted: Record<string, unknown>,
  ): Record<string, unknown> {
    const payload = this.buildOccurrencePayload(event, occurrence);
    for (const field of DETACHED_EVENT_EDITABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(submitted, field)) {
        payload[field] = submitted[field];
      }
    }

    const startDate = new Date(payload.startDate as string | Date);
    const endDate = new Date(payload.endDate as string | Date);
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate.getTime() < startDate.getTime()
    ) {
      throw new BadRequestException('event.invalidOccurrenceRange');
    }

    payload.startDate = startDate;
    payload.endDate = endDate;
    payload.recurrenceRule = null;
    payload.recurrenceExceptionDates = [];
    return payload;
  }

  private normalizeExceptionDates(
    values: string[] | null | undefined,
  ): string[] {
    return Array.from(
      new Set(
        (values ?? [])
          .map((value) => new Date(value))
          .filter((value) => !Number.isNaN(value.getTime()))
          .map((value) => value.toISOString()),
      ),
    );
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
