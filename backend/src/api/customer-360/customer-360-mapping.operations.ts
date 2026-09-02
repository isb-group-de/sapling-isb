import type { Customer360ActivityItem } from './customer-360.types';

type GenericRecord = Record<string, unknown>;

export class Customer360MappingOperations {
  protected mapEvent(item: GenericRecord): Customer360ActivityItem {
    const typeHandle = this.stringValue(
      this.recordValue(item.type, 'handle') ?? item.type,
    );
    const recordHandle = this.referenceHandle(item.handle) ?? '';
    const ticketHandle = this.referenceHandle(item.ticket);
    const opportunityHandle = this.referenceHandle(item.salesOpportunity);
    const kind =
      typeHandle === 'call'
        ? 'call'
        : ['online', 'project', 'sales'].includes(typeHandle)
          ? 'appointment'
          : 'event';
    return {
      id: `event:${recordHandle}`,
      kind,
      direction: 'none',
      occurredAt: this.isoValue(item.startDate ?? item.createdAt),
      entityHandle: 'event',
      recordHandle,
      title: this.stringValue(item.title),
      summary: this.stringValue(item.description) || null,
      participants: this.collectionLabels(item.participants),
      status: item.status,
      attachmentHandles: [],
      source:
        ticketHandle != null
          ? {
              entityHandle: 'ticket',
              recordHandle: ticketHandle,
            }
          : opportunityHandle != null
            ? {
                entityHandle: 'salesOpportunity',
                recordHandle: opportunityHandle,
              }
            : null,
    };
  }

  protected mapInboundEmail(item: GenericRecord): Customer360ActivityItem {
    const recordHandle = this.referenceHandle(item.handle) ?? '';
    const sourceDocumentHandle = this.handleValue(item.sourceDocument);
    const ticketHandle = this.referenceHandle(item.ticket);
    const opportunityHandle = this.referenceHandle(item.salesOpportunity);
    const officeTaskHandle = this.referenceHandle(item.officeTask);
    return {
      id: `inboundEmail:${recordHandle}`,
      kind: 'emailInbound',
      direction: 'inbound',
      occurredAt: this.isoValue(item.receivedAt ?? item.createdAt),
      entityHandle: 'inboundEmail',
      recordHandle,
      title: this.stringValue(item.subject),
      summary: this.stringValue(item.bodyText) || null,
      participants: [
        this.stringValue(item.fromName),
        this.stringValue(item.fromAddress),
        ...this.stringArray(item.toRecipients),
      ].filter(Boolean),
      status: item.status,
      attachmentHandles:
        sourceDocumentHandle == null ? [] : [sourceDocumentHandle],
      source:
        ticketHandle != null
          ? {
              entityHandle: 'ticket',
              recordHandle: ticketHandle,
            }
          : opportunityHandle != null
            ? {
                entityHandle: 'salesOpportunity',
                recordHandle: opportunityHandle,
              }
            : officeTaskHandle != null
              ? {
                  entityHandle: 'event',
                  recordHandle: officeTaskHandle,
                }
              : null,
    };
  }

  protected mapOutboundEmail(item: GenericRecord): Customer360ActivityItem {
    const sourceEntity = this.stringValue(
      this.recordValue(item.entity, 'handle') ?? item.entity,
    );
    const recordHandle = this.referenceHandle(item.handle) ?? '';
    const referenceHandle = this.referenceHandle(item.referenceHandle);
    return {
      id: `emailDelivery:${recordHandle}`,
      kind: 'emailOutbound',
      direction: 'outbound',
      occurredAt: this.isoValue(item.completedAt ?? item.createdAt),
      entityHandle: 'emailDelivery',
      recordHandle,
      title: this.stringValue(item.subject),
      summary: this.stringValue(item.bodyMarkdown) || null,
      participants: [
        ...this.stringArray(item.toRecipients),
        ...this.stringArray(item.ccRecipients),
      ],
      status: item.status,
      attachmentHandles: this.numberArray(item.attachmentHandles),
      source:
        sourceEntity && referenceHandle != null
          ? {
              entityHandle: sourceEntity,
              recordHandle: referenceHandle,
            }
          : null,
    };
  }

  protected countCriticalTickets(items: GenericRecord[], now: Date): number {
    return items.filter((item) =>
      [item.firstResponseDueAt, item.resolutionDueAt, item.deadlineDate].some(
        (value) => {
          const date = this.dateValue(value);
          return date != null && date < now;
        },
      ),
    ).length;
  }

  protected andWhere(left: object, right: object): object {
    if (Object.keys(right).length === 0) return left;
    if (Object.keys(left).length === 0) return right;
    return { $and: [left, right] };
  }

  protected activityDateWhere(
    field: string,
    before: Date | null,
    after: Date | null,
  ): object {
    const range: Record<string, Date> = {};
    if (before) range.$lt = before;
    if (after) range.$gte = after;
    return Object.keys(range).length > 0 ? { [field]: range } : {};
  }

  protected handleValue(value: unknown): number | null {
    const candidate = this.recordValue(value, 'handle') ?? value;
    if (typeof candidate !== 'string' && typeof candidate !== 'number') {
      return null;
    }
    const parsed = Number(candidate);
    return Number.isInteger(parsed) ? parsed : null;
  }

  protected referenceHandle(value: unknown): string | number | null {
    const candidate = this.recordValue(value, 'handle') ?? value;
    return typeof candidate === 'string' || typeof candidate === 'number'
      ? candidate
      : null;
  }

  protected recordValue(value: unknown, field: string): unknown {
    return value && typeof value === 'object'
      ? (value as GenericRecord)[field]
      : undefined;
  }

  protected relationLabel(value: unknown): string {
    if (!value || typeof value !== 'object') return this.stringValue(value);
    const record = value as GenericRecord;
    return (
      [record.firstName, record.lastName].filter(Boolean).join(' ') ||
      this.stringValue(record.name ?? record.title ?? record.handle)
    );
  }

  protected collectionLabels(value: unknown): string[] {
    return Array.isArray(value)
      ? value.map((item) => this.relationLabel(item)).filter(Boolean)
      : [];
  }

  protected firstDate(items: GenericRecord[], field: string): Date | null {
    return (
      items
        .map((item) => this.dateValue(item[field]))
        .filter((value): value is Date => value != null)
        .sort((left, right) => left.getTime() - right.getTime())[0] ?? null
    );
  }

  protected dateValue(value: unknown): Date | null {
    if (!value) return null;
    if (
      !(value instanceof Date) &&
      typeof value !== 'string' &&
      typeof value !== 'number'
    ) {
      return null;
    }
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  protected isoValue(value: unknown): string {
    return this.dateValue(value)?.toISOString() ?? new Date(0).toISOString();
  }

  protected stringValue(value: unknown): string {
    return typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : '';
  }

  protected stringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.map((item) => this.stringValue(item)).filter(Boolean)
      : [];
  }

  protected numberArray(value: unknown): number[] {
    return Array.isArray(value)
      ? value.map(Number).filter((item) => Number.isFinite(item))
      : [];
  }

  protected numberValue(value: unknown): number {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }
}
