import { EntityManager } from '@mikro-orm/core';
import { Injectable, Logger } from '@nestjs/common';
import { EmailSubscriptionItem } from '../../entity/EmailSubscriptionItem';
import { EmailDeliveryItem } from '../../entity/EmailDeliveryItem';
import { PersonItem } from '../../entity/PersonItem';
import { MessageTemplateService } from '../template/message-template.service';
import { MailService } from './mail.service';
import {
  areChangeLogValuesEqual,
  asChangeLogRecord,
  type ChangeLogPayload,
} from '../generic/generic-change-log.util';

type JsonRecord = Record<string, unknown>;

type AutomationTrigger = 'afterInsert' | 'afterUpdate';

type EmailSubscriptionConditionConfig = {
  observedField: string;
  oldValue?: string | null;
  newValue?: string | null;
};

function normalizeConditionValue(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value) ?? null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeConfigValue(
  value: string | null | undefined,
): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

@Injectable()
export class EmailAutomationService {
  private readonly logger = new Logger(EmailAutomationService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly mailService: MailService,
    private readonly messageTemplateService: MessageTemplateService,
  ) {}

  async handleAfterInsert(
    entityHandle: string,
    item: object,
    currentUser: PersonItem,
  ): Promise<void> {
    const referenceHandle = this.extractReferenceHandle(item);
    if (!referenceHandle) {
      return;
    }

    await this.runSubscriptions({
      trigger: 'afterInsert',
      entityHandle,
      referenceHandle,
      newSnapshot: this.toSnapshot(item),
      currentUser,
    });
  }

  async handleAfterUpdate(
    entityHandle: string,
    referenceHandle: string | number,
    oldSnapshot: ChangeLogPayload,
    newSnapshot: ChangeLogPayload,
    currentUser: PersonItem,
  ): Promise<void> {
    await this.runSubscriptions({
      trigger: 'afterUpdate',
      entityHandle,
      referenceHandle,
      oldSnapshot,
      newSnapshot,
      currentUser,
    });
  }

  private async runSubscriptions(options: {
    trigger: AutomationTrigger;
    entityHandle: string;
    referenceHandle: string | number;
    oldSnapshot?: ChangeLogPayload;
    newSnapshot?: ChangeLogPayload;
    currentUser: PersonItem;
  }): Promise<void> {
    const subscriptions = await this.em.find(
      EmailSubscriptionItem,
      {
        isActive: true,
        entity: { handle: options.entityHandle },
        type: { handle: options.trigger },
      },
      {
        populate: [
          'entity',
          'type',
          'template',
          'senderPerson',
          'senderMailbox',
          'conditions',
        ],
      },
    );

    for (const subscription of subscriptions) {
      try {
        if (!this.matchesCondition(subscription, options)) {
          continue;
        }

        if (
          subscription.allowRepeatedSending === false &&
          (await this.hasExistingDelivery(subscription, options))
        ) {
          continue;
        }

        await this.sendSubscriptionEmail(subscription, options);
      } catch (error) {
        this.logger.error(
          `Email subscription ${subscription.handle ?? 'unknown'} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private matchesCondition(
    subscription: EmailSubscriptionItem,
    options: {
      trigger: AutomationTrigger;
      oldSnapshot?: ChangeLogPayload;
      newSnapshot?: ChangeLogPayload;
    },
  ): boolean {
    if (subscription.template?.isActive === false) {
      return false;
    }

    const conditions = this.normalizeConditions(subscription.conditions);

    if (conditions.length === 0) {
      return true;
    }

    return conditions.every((condition) =>
      this.matchesSingleCondition(condition, options),
    );
  }

  private async sendSubscriptionEmail(
    subscription: EmailSubscriptionItem,
    options: {
      entityHandle: string;
      referenceHandle: string | number;
    },
  ): Promise<void> {
    const templateHandle = subscription.template?.handle;
    if (!templateHandle) {
      return;
    }

    const sender = await this.resolveSender(subscription.senderPerson);
    if (!sender) {
      this.logger.warn(
        `Email subscription ${subscription.handle ?? 'unknown'} has no valid sender.`,
      );
      return;
    }

    const context = await this.messageTemplateService.buildContext({
      entityHandle: options.entityHandle,
      itemHandle: options.referenceHandle,
      currentUser: sender,
      draftValues: {
        emailSubscription: {
          handle: subscription.handle,
          description: subscription.description,
        },
      },
      relations: [subscription.recipientField],
    });
    const recipientValue = this.messageTemplateService.getContextValue(
      context,
      subscription.recipientField,
    );
    const to = await this.resolveRecipientEmails(recipientValue);

    if (to.length === 0) {
      this.logger.warn(
        `Email subscription ${subscription.handle ?? 'unknown'} has no recipients for ${options.entityHandle}/${options.referenceHandle}.`,
      );
      return;
    }

    await this.mailService.sendEmail(
      {
        entityHandle: options.entityHandle,
        itemHandle: options.referenceHandle,
        templateHandle,
        senderEmail: subscription.senderMailbox?.email,
        to,
        draftValues: {
          emailSubscription: {
            handle: subscription.handle,
            description: subscription.description,
          },
        },
      },
      sender,
      {
        subscription,
        deduplicationKey:
          subscription.allowRepeatedSending === false
            ? this.buildDeduplicationKey(subscription, options)
            : undefined,
      },
    );
  }

  private async hasExistingDelivery(
    subscription: EmailSubscriptionItem,
    options: {
      entityHandle: string;
      referenceHandle: string | number;
    },
  ): Promise<boolean> {
    if (!subscription.handle) {
      return false;
    }

    const existing = await this.em.findOne(EmailDeliveryItem, {
      subscription: { handle: subscription.handle },
      entity: { handle: options.entityHandle },
      referenceHandle: String(options.referenceHandle),
    });

    return Boolean(existing);
  }

  private buildDeduplicationKey(
    subscription: EmailSubscriptionItem,
    options: {
      entityHandle: string;
      referenceHandle: string | number;
    },
  ): string | undefined {
    if (!subscription.handle) {
      return undefined;
    }

    return `${subscription.handle}:${options.entityHandle}:${options.referenceHandle}`;
  }

  private matchesSingleCondition(
    condition: EmailSubscriptionConditionConfig,
    options: {
      trigger: AutomationTrigger;
      oldSnapshot?: ChangeLogPayload;
      newSnapshot?: ChangeLogPayload;
    },
  ): boolean {
    const field = condition.observedField.trim();
    const oldValue = this.getSnapshotValue(options.oldSnapshot, field);
    const newValue = this.getSnapshotValue(options.newSnapshot, field);
    const expectedOldValue = normalizeConfigValue(condition.oldValue);
    const expectedNewValue = normalizeConfigValue(condition.newValue);
    const isChangeOnlyCondition =
      expectedOldValue === undefined && expectedNewValue === undefined;

    if (
      options.trigger === 'afterUpdate' &&
      isChangeOnlyCondition &&
      areChangeLogValuesEqual(oldValue, newValue)
    ) {
      return false;
    }

    if (
      expectedOldValue !== undefined &&
      !this.matchesConfiguredValue(oldValue, expectedOldValue)
    ) {
      return false;
    }

    if (
      expectedNewValue !== undefined &&
      !this.matchesConfiguredValue(newValue, expectedNewValue)
    ) {
      return false;
    }

    return true;
  }

  private normalizeConditions(
    value: unknown,
  ): EmailSubscriptionConditionConfig[] {
    if (!Array.isArray(value)) {
      if (
        value &&
        typeof value === 'object' &&
        'getItems' in value &&
        typeof (value as { getItems?: unknown }).getItems === 'function'
      ) {
        return this.normalizeConditions(
          (value as { getItems: () => unknown[] }).getItems(),
        );
      }

      return [];
    }

    return value
      .map((condition) => this.normalizeCondition(condition))
      .filter((condition): condition is EmailSubscriptionConditionConfig =>
        Boolean(condition),
      );
  }

  private normalizeCondition(
    condition: unknown,
  ): EmailSubscriptionConditionConfig | null {
    if (!isRecord(condition)) {
      return null;
    }

    const observedField =
      typeof condition.observedField === 'string'
        ? condition.observedField.trim()
        : typeof condition.field === 'string'
          ? condition.field.trim()
          : '';

    if (!observedField) {
      return null;
    }

    return {
      observedField,
      oldValue: normalizeConditionValue(condition.oldValue),
      newValue: normalizeConditionValue(condition.newValue),
    };
  }

  private async resolveSender(value: unknown): Promise<PersonItem | null> {
    const handle = this.extractPersonHandle(value);
    if (!handle) {
      return null;
    }

    const sender = await this.em.findOne(
      PersonItem,
      { handle },
      { populate: ['type', 'session', 'language'] },
    );

    if (!sender) {
      return null;
    }

    const providerHandle = sender.type?.handle;
    if (providerHandle !== 'azure' && providerHandle !== 'google') {
      return null;
    }

    if (!sender.session?.accessToken && !sender.session?.refreshToken) {
      return null;
    }

    return sender;
  }

  private async resolveRecipientEmails(value: unknown): Promise<string[]> {
    const emails = await this.resolveRecipientEmailEntries(value);
    return [...new Set(emails.map((email) => email.toLowerCase()))];
  }

  private async resolveRecipientEmailEntries(
    value: unknown,
  ): Promise<string[]> {
    if (value == null) {
      return [];
    }

    if (Array.isArray(value)) {
      const nested = await Promise.all(
        value.map((entry) => this.resolveRecipientEmailEntries(entry)),
      );
      return nested.flat();
    }

    if (typeof value === 'string') {
      const normalized = value.trim();
      return normalized.includes('@') ? [normalized] : [];
    }

    if (typeof value === 'number' && Number.isInteger(value)) {
      const person = await this.em.findOne(PersonItem, { handle: value });
      return person?.email?.trim() ? [person.email.trim()] : [];
    }

    if (!isRecord(value)) {
      return [];
    }

    if (typeof value.email === 'string' && value.email.trim()) {
      return [value.email.trim()];
    }

    if (typeof value.handle === 'number' && Number.isInteger(value.handle)) {
      const person = await this.em.findOne(PersonItem, {
        handle: value.handle,
      });
      return person?.email?.trim() ? [person.email.trim()] : [];
    }

    return [];
  }

  private extractPersonHandle(value: unknown): number | null {
    if (typeof value === 'number' && Number.isInteger(value)) {
      return value;
    }

    if (typeof value === 'string' && /^\d+$/.test(value)) {
      return Number(value);
    }

    if (isRecord(value)) {
      return this.extractPersonHandle(value.handle);
    }

    return null;
  }

  private getSnapshotValue(
    snapshot: ChangeLogPayload | undefined,
    expression: string,
  ): unknown {
    const segments = expression
      .split('.')
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (segments.length === 0) {
      return undefined;
    }

    return segments.reduce<unknown>(
      (current, segment) => {
        if (!isRecord(current)) {
          return undefined;
        }

        return current[segment];
      },
      asChangeLogRecord(snapshot ?? null),
    );
  }

  private matchesConfiguredValue(value: unknown, expected: string): boolean {
    const expectedBoolean = this.parseConfiguredBoolean(expected);
    if (expectedBoolean !== null) {
      return this.isBooleanTrue(value) === expectedBoolean;
    }

    return this.valueCandidates(value).some(
      (candidate) => candidate === expected,
    );
  }

  private parseConfiguredBoolean(value: string): boolean | null {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }

    return null;
  }

  private isBooleanTrue(value: unknown): boolean {
    if (value === true) {
      return true;
    }

    if (typeof value === 'string') {
      return value.trim().toLowerCase() === 'true';
    }

    if (Array.isArray(value)) {
      return value.some((entry) => this.isBooleanTrue(entry));
    }

    if (
      isRecord(value) &&
      Object.prototype.hasOwnProperty.call(value, 'handle')
    ) {
      return this.isBooleanTrue(value.handle);
    }

    return false;
  }

  private valueCandidates(value: unknown): string[] {
    if (value == null) {
      return [''];
    }

    if (Array.isArray(value)) {
      return value.flatMap((entry) => this.valueCandidates(entry));
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return [String(value)];
    }

    if (isRecord(value)) {
      const handle = value.handle;
      if (
        typeof handle === 'string' ||
        typeof handle === 'number' ||
        typeof handle === 'boolean'
      ) {
        return [String(handle)];
      }
    }

    return [JSON.stringify(value)];
  }

  private extractReferenceHandle(item: object): string | number | null {
    if (!isRecord(item)) {
      return null;
    }

    const handle = item.handle;
    return typeof handle === 'string' || typeof handle === 'number'
      ? handle
      : null;
  }

  private toSnapshot(item: object): ChangeLogPayload {
    return isRecord(item) ? item : null;
  }
}
