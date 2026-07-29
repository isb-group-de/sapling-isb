import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AzureCalendarService } from '../azure/azure.calendar.service';
import { GoogleCalendarService } from '../google/google.calendar.service';
import {
  CALENDAR_SYNC_SCHEDULER_INTERVAL_MS,
  REDIS_ENABLED,
  REDIS_REMOVE_ON_COMPLETE,
  REDIS_REMOVE_ON_FAIL,
} from '../../constants/project.constants';
import {
  CalendarSyncProvider,
  CalendarSyncRange,
  CalendarSyncSubscriptionItem,
} from '../../entity/CalendarSyncSubscriptionItem';
import { PersonItem } from '../../entity/PersonItem';
import { EventTypeItem } from '../../entity/EventTypeItem';
import { EventCategoryItem } from '../../entity/EventCategoryItem';
import {
  CalendarSyncSubscriptionDto,
  OutlookCalendarCategoryDto,
  UpdateCalendarSyncSubscriptionDto,
} from './dto/calendar-sync-subscription.dto';
import {
  DEFAULT_CALENDAR_EVENT_CATEGORY_HANDLE,
  DEFAULT_CALENDAR_EVENT_TYPE_HANDLE,
  normalizeCalendarClassificationMappings,
} from '../calendar-classification.utils';

type CalendarSyncRangeWindow = {
  startDateTime: Date;
  endDateTime: Date;
};

type QueueSummary = {
  queued: number;
};

const DEFAULT_SYNC_RANGE: CalendarSyncRange = 'week';
const DEFAULT_INTERVAL_MINUTES = 60;
const MAX_ERROR_LENGTH = 512;

export function calculateCalendarSyncRange(
  range: CalendarSyncRange,
  now: Date = new Date(),
): CalendarSyncRangeWindow {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);

  switch (range) {
    case 'day':
      end.setUTCDate(end.getUTCDate() + 1);
      break;
    case 'week': {
      const day = start.getUTCDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      start.setUTCDate(start.getUTCDate() + mondayOffset);
      end.setTime(start.getTime());
      end.setUTCDate(end.getUTCDate() + 7);
      break;
    }
    case 'month':
      start.setUTCDate(1);
      end.setTime(start.getTime());
      end.setUTCMonth(end.getUTCMonth() + 1);
      break;
    default:
      end.setUTCDate(end.getUTCDate() + 7);
  }

  return { startDateTime: start, endDateTime: end };
}

export function isCalendarSyncSubscriptionDue(
  subscription: Pick<
    CalendarSyncSubscriptionItem,
    'isActive' | 'intervalMinutes' | 'lastRunAt'
  >,
  now: Date = new Date(),
): boolean {
  if (!subscription.isActive) {
    return false;
  }

  if (!subscription.lastRunAt) {
    return true;
  }

  const intervalMs =
    Math.max(5, subscription.intervalMinutes || DEFAULT_INTERVAL_MINUTES) *
    60 *
    1000;
  return now.getTime() - subscription.lastRunAt.getTime() >= intervalMs;
}

@Injectable()
export class CalendarSyncSubscriptionService implements OnModuleInit {
  constructor(
    private readonly em: EntityManager,
    private readonly azureCalendarService: AzureCalendarService,
    private readonly googleCalendarService: GoogleCalendarService,
    @InjectQueue('calendar-sync') private readonly calendarSyncQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!REDIS_ENABLED) {
      global.log?.warn?.(
        'Redis is disabled. Automatic calendar synchronization is not scheduled.',
      );
      return;
    }

    await this.calendarSyncQueue.add(
      'schedule-calendar-imports',
      {},
      {
        jobId: 'calendar-sync-scheduler',
        repeat: { every: CALENDAR_SYNC_SCHEDULER_INTERVAL_MS },
        removeOnComplete: REDIS_REMOVE_ON_COMPLETE,
        removeOnFail: REDIS_REMOVE_ON_FAIL,
      },
    );
  }

  async getCurrentSubscription(
    user: PersonItem,
  ): Promise<CalendarSyncSubscriptionDto> {
    const em = this.em.fork();
    const person = await this.loadPerson(em, user.handle);
    const subscription = person
      ? await this.findOrCreateSubscription(em, person, false)
      : null;
    const provider = this.getCalendarProvider(person);

    return this.toDto(
      subscription,
      this.isCalendarSyncAvailable(person),
      provider ?? 'azure',
    );
  }

  async getCurrentOutlookCategories(
    user: PersonItem,
  ): Promise<OutlookCalendarCategoryDto[]> {
    const em = this.em.fork();
    const person = await this.loadPerson(em, user.handle);
    if (
      !person ||
      this.getCalendarProvider(person) !== 'azure' ||
      !person.session
    ) {
      throw new ForbiddenException('calendar.azureUserRequired');
    }

    return this.azureCalendarService.getMasterCategories(person);
  }

  async updateCurrentSubscription(
    user: PersonItem,
    dto: UpdateCalendarSyncSubscriptionDto,
  ): Promise<CalendarSyncSubscriptionDto> {
    const em = this.em.fork();
    const person = await this.loadPerson(em, user.handle);

    if (!person) {
      throw new BadRequestException('calendarSyncSubscription.personNotFound');
    }

    if (!this.isCalendarSyncAvailable(person)) {
      throw new ForbiddenException('calendar.calendarUserRequired');
    }
    const provider = this.getCalendarProvider(person);
    if (!provider) {
      throw new ForbiddenException('calendar.calendarUserRequired');
    }

    const subscription = await this.findOrCreateSubscription(em, person, true);
    if (!subscription) {
      throw new BadRequestException(
        'calendarSyncSubscription.subscriptionNotFound',
      );
    }

    if (dto.isActive != null) {
      subscription.isActive = dto.isActive;
    }

    if (dto.syncRange != null) {
      subscription.syncRange = dto.syncRange;
    }

    if (dto.intervalMinutes != null) {
      subscription.intervalMinutes = dto.intervalMinutes;
    }
    subscription.provider = provider;

    if (dto.defaultEventTypeHandle != null) {
      subscription.defaultEventType = await this.requireEventType(
        em,
        dto.defaultEventTypeHandle,
      );
    }

    if (dto.defaultEventCategoryHandle != null) {
      subscription.defaultEventCategory = await this.requireEventCategory(
        em,
        dto.defaultEventCategoryHandle,
      );
    }

    if (dto.classificationMappings != null) {
      const mappings = normalizeCalendarClassificationMappings(
        dto.classificationMappings,
      );
      await this.assertClassificationMappings(
        em,
        subscription.provider,
        mappings,
      );
      subscription.classificationMappings = mappings;
    }

    await em.flush();
    return this.toDto(subscription, true, subscription.provider);
  }

  async enqueueDueSubscriptions(now: Date = new Date()): Promise<QueueSummary> {
    const em = this.em.fork();
    const subscriptions = await em.find(
      CalendarSyncSubscriptionItem,
      { isActive: true },
      { populate: ['person', 'person.type', 'person.session'] },
    );
    let queued = 0;

    for (const subscription of subscriptions) {
      if (!isCalendarSyncSubscriptionDue(subscription, now)) {
        continue;
      }

      if (
        !this.isCalendarSyncAvailable(subscription.person) ||
        this.getCalendarProvider(subscription.person) !== subscription.provider
      ) {
        continue;
      }

      if (typeof subscription.handle !== 'number') {
        continue;
      }

      await this.calendarSyncQueue.add(
        'import-calendar-for-subscription',
        { subscriptionHandle: subscription.handle },
        {
          removeOnComplete: REDIS_REMOVE_ON_COMPLETE,
          removeOnFail: REDIS_REMOVE_ON_FAIL,
        },
      );
      subscription.lastRunAt = now;
      queued += 1;
    }

    if (queued > 0) {
      await em.flush();
    }

    return { queued };
  }

  async executeSubscriptionImport(subscriptionHandle: number): Promise<void> {
    const em = this.em.fork();
    const subscription = await em.findOne(
      CalendarSyncSubscriptionItem,
      { handle: subscriptionHandle },
      { populate: ['person', 'person.type'] },
    );

    if (!subscription || !subscription.isActive) {
      return;
    }

    const person = subscription.person as PersonItem;
    if (this.getCalendarProvider(person) !== subscription.provider) {
      subscription.lastError = 'calendar.calendarUserRequired';
      await em.flush();
      return;
    }

    subscription.lastRunAt = new Date();
    subscription.lastError = null;
    await em.flush();

    try {
      const range = calculateCalendarSyncRange(subscription.syncRange);
      const result =
        subscription.provider === 'google'
          ? await this.googleCalendarService.importEvents(person, range)
          : await this.azureCalendarService.importEvents(person, range);
      subscription.lastSuccessAt = new Date();
      subscription.lastImportedCount = result.imported;
      subscription.lastCreatedCount = result.created;
      subscription.lastUpdatedCount = result.updated;
      subscription.lastSkippedCount = result.skipped;
      subscription.lastError = null;
      await em.flush();
    } catch (error) {
      subscription.lastError = truncateError(error);
      await em.flush();
      throw error;
    }
  }

  private async loadPerson(
    em: EntityManager,
    handle?: number,
  ): Promise<PersonItem | null> {
    if (handle == null) {
      return null;
    }

    return em.findOne(
      PersonItem,
      { handle },
      { populate: ['type', 'session'] },
    );
  }

  private async findOrCreateSubscription(
    em: EntityManager,
    person: PersonItem,
    createWhenMissing: boolean,
  ): Promise<CalendarSyncSubscriptionItem | null> {
    const subscription = await em.findOne(
      CalendarSyncSubscriptionItem,
      { person: { handle: person.handle } },
      { populate: ['defaultEventType', 'defaultEventCategory'] },
    );

    if (subscription || !createWhenMissing) {
      return subscription;
    }

    const provider = this.getCalendarProvider(person);
    if (!provider) {
      return null;
    }

    const created = new CalendarSyncSubscriptionItem();
    created.description =
      provider === 'google'
        ? 'Google calendar import'
        : 'Outlook calendar import';
    created.provider = provider;
    created.isActive = false;
    created.syncRange = DEFAULT_SYNC_RANGE;
    created.intervalMinutes = DEFAULT_INTERVAL_MINUTES;
    created.defaultEventType = await this.requireEventType(
      em,
      DEFAULT_CALENDAR_EVENT_TYPE_HANDLE,
    );
    created.defaultEventCategory = await this.requireEventCategory(
      em,
      DEFAULT_CALENDAR_EVENT_CATEGORY_HANDLE,
    );
    created.classificationMappings = [];
    created.person = person;
    em.persist(created);
    return created;
  }

  private isCalendarSyncAvailable(person?: PersonItem | null): boolean {
    return Boolean(this.getCalendarProvider(person) && person?.session);
  }

  private getCalendarProvider(
    person?: PersonItem | null,
  ): CalendarSyncProvider | null {
    if (!person || person.isActive === false) {
      return null;
    }

    const typeHandle =
      typeof person.type === 'string' ? person.type : person.type?.handle;
    return typeHandle === 'azure' || typeHandle === 'google'
      ? typeHandle
      : null;
  }

  private async requireEventType(
    em: EntityManager,
    handle: string,
  ): Promise<EventTypeItem> {
    const eventType = await em.findOne(EventTypeItem, {
      handle: handle.trim(),
    });
    if (!eventType) {
      throw new BadRequestException(
        'calendarSyncSubscription.eventTypeNotFound',
      );
    }
    return eventType;
  }

  private async requireEventCategory(
    em: EntityManager,
    handle: string,
  ): Promise<EventCategoryItem> {
    const eventCategory = await em.findOne(EventCategoryItem, {
      handle: handle.trim(),
    });
    if (!eventCategory) {
      throw new BadRequestException(
        'calendarSyncSubscription.eventCategoryNotFound',
      );
    }
    return eventCategory;
  }

  private async assertClassificationMappings(
    em: EntityManager,
    provider: CalendarSyncProvider,
    mappings: ReturnType<typeof normalizeCalendarClassificationMappings>,
  ): Promise<void> {
    if (
      provider === 'google' &&
      mappings.some(
        (mapping) => !/^(?:[1-9]|1[01])$/.test(mapping.externalValue),
      )
    ) {
      throw new BadRequestException(
        'calendarSyncSubscription.invalidGoogleColor',
      );
    }

    const typeHandles = Array.from(
      new Set(
        mappings
          .map((mapping) => mapping.eventTypeHandle)
          .filter((handle): handle is string => Boolean(handle)),
      ),
    );
    const categoryHandles = Array.from(
      new Set(
        mappings
          .map((mapping) => mapping.eventCategoryHandle)
          .filter((handle): handle is string => Boolean(handle)),
      ),
    );
    const [eventTypes, eventCategories] = await Promise.all([
      typeHandles.length
        ? em.find(EventTypeItem, { handle: { $in: typeHandles } })
        : Promise.resolve([]),
      categoryHandles.length
        ? em.find(EventCategoryItem, { handle: { $in: categoryHandles } })
        : Promise.resolve([]),
    ]);

    if (eventTypes.length !== typeHandles.length) {
      throw new BadRequestException(
        'calendarSyncSubscription.eventTypeNotFound',
      );
    }
    if (eventCategories.length !== categoryHandles.length) {
      throw new BadRequestException(
        'calendarSyncSubscription.eventCategoryNotFound',
      );
    }
  }

  private toDto(
    subscription: CalendarSyncSubscriptionItem | null,
    isAvailable: boolean,
    provider: CalendarSyncProvider,
  ): CalendarSyncSubscriptionDto {
    return {
      handle: subscription?.handle,
      isAvailable,
      provider,
      isActive: subscription?.isActive ?? false,
      syncRange: subscription?.syncRange ?? DEFAULT_SYNC_RANGE,
      intervalMinutes:
        subscription?.intervalMinutes ?? DEFAULT_INTERVAL_MINUTES,
      defaultEventTypeHandle:
        getRelationHandle(subscription?.defaultEventType) ??
        DEFAULT_CALENDAR_EVENT_TYPE_HANDLE,
      defaultEventCategoryHandle:
        getRelationHandle(subscription?.defaultEventCategory) ??
        DEFAULT_CALENDAR_EVENT_CATEGORY_HANDLE,
      classificationMappings: normalizeCalendarClassificationMappings(
        subscription?.classificationMappings,
      ),
      lastRunAt: subscription?.lastRunAt ?? null,
      lastSuccessAt: subscription?.lastSuccessAt ?? null,
      lastError: subscription?.lastError ?? null,
      lastImportedCount: subscription?.lastImportedCount ?? 0,
      lastCreatedCount: subscription?.lastCreatedCount ?? 0,
      lastUpdatedCount: subscription?.lastUpdatedCount ?? 0,
      lastSkippedCount: subscription?.lastSkippedCount ?? 0,
    };
  }
}

function getRelationHandle(
  value?: string | { handle?: string } | null,
): string | null {
  return typeof value === 'string' ? value : (value?.handle ?? null);
}

function truncateError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'calendarSyncSubscription.importFailed';

  return message.length <= MAX_ERROR_LENGTH
    ? message
    : message.slice(0, MAX_ERROR_LENGTH - 3) + '...';
}
