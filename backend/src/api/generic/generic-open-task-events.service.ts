import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { OpenTaskEventsService } from '../current/open-task-events.service';
import { EventItem } from '../../entity/EventItem';
import { EffortEstimateItem } from '../../entity/EffortEstimateItem';
import { SalesOpportunityItem } from '../../entity/SalesOpportunityItem';
import { TicketItem } from '../../entity/TicketItem';
import { InternalCaseItem } from '../../entity/InternalCaseItem';
import { GenericReferenceService } from './generic-reference.service';

const OPEN_TASK_ENTITY_HANDLES = new Set([
  'ticket',
  'event',
  'salesOpportunity',
  'effortEstimate',
  'internalCase',
]);

@Injectable()
export class GenericOpenTaskEventsService {
  constructor(
    private readonly em: EntityManager,
    private readonly genericReferenceService: GenericReferenceService,
    private readonly openTaskEventsService: OpenTaskEventsService,
  ) {}

  async emitCountChangesForHandle(
    entityHandle: string,
    handle: string | number | null,
    previousUserHandles: ReadonlySet<number> = new Set<number>(),
  ): Promise<void> {
    if (handle == null) {
      await this.notifyUsers(previousUserHandles);
      return;
    }

    const nextUserHandles = await this.loadUserHandles(entityHandle, handle);
    await this.notifyUsers(
      this.mergeUserHandles(previousUserHandles, nextUserHandles),
    );
  }

  async emitReferenceCountChanges(
    entityHandle: string,
    referenceName: string,
    handle: string | number,
    previousUserHandles: ReadonlySet<number>,
  ): Promise<void> {
    const nextUserHandles = await this.loadReferenceUserHandles(
      entityHandle,
      referenceName,
      handle,
    );

    await this.notifyUsers(
      this.mergeUserHandles(previousUserHandles, nextUserHandles),
    );
  }

  notifyUsers(userHandles: ReadonlySet<number>): Promise<void> {
    this.openTaskEventsService.notifyUsers(userHandles);
    return Promise.resolve();
  }

  async loadReferenceUserHandles(
    entityHandle: string,
    referenceName: string,
    handle: string | number,
  ): Promise<Set<number>> {
    if (entityHandle !== 'event' || referenceName !== 'participants') {
      return new Set<number>();
    }

    return this.loadUserHandles(entityHandle, handle);
  }

  async loadUserHandles(
    entityHandle: string,
    handle: string | number,
  ): Promise<Set<number>> {
    if (!OPEN_TASK_ENTITY_HANDLES.has(entityHandle)) {
      return new Set<number>();
    }

    switch (entityHandle) {
      case 'ticket':
        return this.loadTicketUserHandles(handle);
      case 'event':
        return this.loadEventUserHandles(handle);
      case 'salesOpportunity':
        return this.loadSalesOpportunityUserHandles(handle);
      case 'effortEstimate':
        return this.loadEffortEstimateUserHandles(handle);
      case 'internalCase':
        return this.loadInternalCaseUserHandles(handle);
      default:
        return new Set<number>();
    }
  }

  private async loadTicketUserHandles(
    handle: string | number,
  ): Promise<Set<number>> {
    const normalizedHandle = this.normalizeNumericOpenTaskHandle(
      'ticket',
      handle,
    );
    if (normalizedHandle == null) {
      return new Set<number>();
    }

    const ticket = await this.em.findOne(
      TicketItem,
      { handle: normalizedHandle },
      {
        populate: ['assigneePerson', 'status'],
      },
    );

    if (!ticket) {
      return new Set<number>();
    }

    const assigneeHandle = this.extractReferenceHandle(ticket.assigneePerson);
    const statusHandle = this.extractReferenceHandle(ticket.status);

    if (typeof assigneeHandle !== 'number' || statusHandle === 'closed') {
      return new Set<number>();
    }

    return new Set<number>([assigneeHandle]);
  }

  private async loadEventUserHandles(
    handle: string | number,
  ): Promise<Set<number>> {
    const normalizedHandle = this.normalizeNumericOpenTaskHandle(
      'event',
      handle,
    );
    if (normalizedHandle == null) {
      return new Set<number>();
    }

    const event = await this.em.findOne(
      EventItem,
      { handle: normalizedHandle },
      {
        populate: ['participants', 'status', 'creatorPerson'],
      },
    );

    if (!event) {
      return new Set<number>();
    }

    const statusHandle = this.extractReferenceHandle(event.status);
    if (statusHandle === 'canceled' || statusHandle === 'completed') {
      return new Set<number>();
    }

    const userHandles = new Set<number>(
      event.participants
        .getItems()
        .map((participant) => participant.handle)
        .filter(
          (participantHandle): participantHandle is number =>
            typeof participantHandle === 'number',
        ),
    );

    if (event.isPrivate === true) {
      const ownerHandle = this.extractReferenceHandle(event.creatorPerson);
      if (typeof ownerHandle === 'number') {
        userHandles.add(ownerHandle);
      }
    }

    return userHandles;
  }

  private async loadSalesOpportunityUserHandles(
    handle: string | number,
  ): Promise<Set<number>> {
    const normalizedHandle = this.normalizeNumericOpenTaskHandle(
      'salesOpportunity',
      handle,
    );
    if (normalizedHandle == null) {
      return new Set<number>();
    }

    const salesOpportunity = await this.em.findOne(
      SalesOpportunityItem,
      { handle: normalizedHandle },
      {
        populate: ['assigneePerson'],
      },
    );

    if (!salesOpportunity || salesOpportunity.isActive !== true) {
      return new Set<number>();
    }

    const assigneeHandle = this.extractReferenceHandle(
      salesOpportunity.assigneePerson,
    );

    if (typeof assigneeHandle !== 'number') {
      return new Set<number>();
    }

    return new Set<number>([assigneeHandle]);
  }

  private async loadEffortEstimateUserHandles(
    handle: string | number,
  ): Promise<Set<number>> {
    const normalizedHandle = this.normalizeNumericOpenTaskHandle(
      'effortEstimate',
      handle,
    );
    if (normalizedHandle == null) {
      return new Set<number>();
    }

    const effortEstimate = await this.em.findOne(
      EffortEstimateItem,
      { handle: normalizedHandle },
      {
        populate: ['assigneePerson', 'status'],
      },
    );

    if (!effortEstimate || effortEstimate.isActive !== true) {
      return new Set<number>();
    }

    const statusHandle = this.extractReferenceHandle(effortEstimate.status);
    if (statusHandle === 'completed' || statusHandle === 'cancelled') {
      return new Set<number>();
    }

    const assigneeHandle = this.extractReferenceHandle(
      effortEstimate.assigneePerson,
    );
    if (typeof assigneeHandle !== 'number') {
      return new Set<number>();
    }

    return new Set<number>([assigneeHandle]);
  }

  private async loadInternalCaseUserHandles(
    handle: string | number,
  ): Promise<Set<number>> {
    const normalizedHandle = this.normalizeNumericOpenTaskHandle(
      'internalCase',
      handle,
    );
    if (normalizedHandle == null) {
      return new Set<number>();
    }

    const internalCase = await this.em.findOne(
      InternalCaseItem,
      { handle: normalizedHandle },
      {
        populate: ['responsiblePerson', 'status'],
      },
    );

    if (!internalCase) {
      return new Set<number>();
    }

    const statusIsOpen =
      typeof internalCase.status === 'object' &&
      internalCase.status?.isOpen === true;
    if (!statusIsOpen) {
      return new Set<number>();
    }

    const responsibleHandle = this.extractReferenceHandle(
      internalCase.responsiblePerson,
    );
    if (typeof responsibleHandle !== 'number') {
      return new Set<number>();
    }

    return new Set<number>([responsibleHandle]);
  }

  private mergeUserHandles(
    ...userHandleCollections: Iterable<number>[]
  ): Set<number> {
    const mergedUserHandles = new Set<number>();

    for (const userHandleCollection of userHandleCollections) {
      for (const userHandle of userHandleCollection) {
        mergedUserHandles.add(userHandle);
      }
    }

    return mergedUserHandles;
  }

  private extractReferenceHandle(
    reference: unknown,
  ): string | number | undefined {
    if (!reference || typeof reference !== 'object') {
      return undefined;
    }

    const handle = (reference as { handle?: unknown }).handle;
    if (typeof handle === 'string' || typeof handle === 'number') {
      return handle;
    }

    return undefined;
  }

  private normalizeNumericOpenTaskHandle(
    entityHandle:
      | 'ticket'
      | 'event'
      | 'salesOpportunity'
      | 'effortEstimate'
      | 'internalCase',
    handle: string | number,
  ): number | null {
    const normalizedHandle = this.genericReferenceService.normalizeHandleValue(
      entityHandle,
      handle,
    );

    return typeof normalizedHandle === 'number' ? normalizedHandle : null;
  }
}
