import type { EntityManager } from '@mikro-orm/core';
import { EffortEstimateItem } from '../../entity/EffortEstimateItem';
import { EventItem } from '../../entity/EventItem';
import { InboxNotificationItem } from '../../entity/InboxNotificationItem';
import { InternalCaseItem } from '../../entity/InternalCaseItem';
import { PersonItem } from '../../entity/PersonItem';
import { SalesOpportunityItem } from '../../entity/SalesOpportunityItem';
import { TicketItem } from '../../entity/TicketItem';
import type { InboxService } from '../inbox/inbox.service';

export interface OpenTaskSnapshot {
  count: number;
  tickets: TicketItem[];
  tasks: EventItem[];
  salesOpportunities: SalesOpportunityItem[];
  effortEstimates: EffortEstimateItem[];
  internalCases: InternalCaseItem[];
  notifications: InboxNotificationItem[];
}

export class CurrentOpenTaskService {
  constructor(
    private readonly em: EntityManager,
    private readonly inboxService: InboxService,
  ) {}

  async getOpenTickets(user: PersonItem): Promise<TicketItem[]> {
    return (
      (await this.em.find(
        TicketItem,
        {
          assigneePerson: { handle: user.handle },
          status: { handle: { $nin: ['closed'] } },
        },
        { populate: ['status', 'priority'] },
      )) || []
    );
  }

  async getOpenEvents(user: PersonItem): Promise<EventItem[]> {
    return (
      (await this.em.find(
        EventItem,
        {
          $or: [
            { isPrivate: false, participants: { handle: user.handle } },
            {
              isPrivate: true,
              $or: [
                { creatorPerson: { handle: user.handle } },
                { participants: { handle: user.handle } },
              ],
            },
          ],
          status: { handle: { $nin: ['canceled', 'completed'] } },
        },
        { populate: ['status', 'type'] },
      )) || []
    );
  }

  async getOpenSalesOpportunities(
    user: PersonItem,
  ): Promise<SalesOpportunityItem[]> {
    return (
      (await this.em.find(
        SalesOpportunityItem,
        { assigneePerson: { handle: user.handle }, isActive: true },
        {
          populate: ['type', 'forecast', 'assigneeCompany', 'creatorCompany'],
        },
      )) || []
    );
  }

  async getOpenEffortEstimates(
    user: PersonItem,
  ): Promise<EffortEstimateItem[]> {
    return (
      (await this.em.find(
        EffortEstimateItem,
        {
          assigneePerson: { handle: user.handle },
          isActive: true,
          status: { handle: { $nin: ['completed', 'cancelled'] } },
        },
        {
          populate: [
            'status',
            'assigneeCompany',
            'assigneePerson',
            'creatorCompany',
            'creatorPerson',
            'salesOpportunity',
            'ticket',
          ],
        },
      )) || []
    );
  }

  async getOpenInternalCases(user: PersonItem): Promise<InternalCaseItem[]> {
    return (
      (await this.em.find(
        InternalCaseItem,
        {
          responsiblePerson: { handle: user.handle },
          status: { isOpen: true },
        },
        {
          populate: [
            'status',
            'category',
            'customerCompany',
            'customerPerson',
            'responsibleCompany',
            'responsiblePerson',
          ],
        },
      )) || []
    );
  }

  async getSnapshot(user: PersonItem): Promise<OpenTaskSnapshot> {
    const [
      tickets,
      tasks,
      salesOpportunities,
      effortEstimates,
      internalCases,
      notifications,
    ] = await Promise.all([
      this.getOpenTickets(user),
      this.getOpenEvents(user),
      this.getOpenSalesOpportunities(user),
      this.getOpenEffortEstimates(user),
      this.getOpenInternalCases(user),
      this.inboxService.getUnreadNotifications(user),
    ]);

    return {
      count:
        tickets.length +
        tasks.length +
        salesOpportunities.length +
        effortEstimates.length +
        internalCases.length +
        notifications.length,
      tickets,
      tasks,
      salesOpportunities,
      effortEstimates,
      internalCases,
      notifications,
    };
  }
}
