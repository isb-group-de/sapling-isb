import { promptText } from '../ai/prompts/ai-prompt-context';
import { EntityManager } from '@mikro-orm/core';
import { AiChatToolActionItem } from '../../entity/AiChatToolActionItem';
import {
  EmailInboxSubscriptionItem,
  type EmailInboxProcessingMode,
} from '../../entity/EmailInboxSubscriptionItem';
import { EventItem } from '../../entity/EventItem';
import {
  InboundEmailItem,
  type InboundEmailLogEntry,
} from '../../entity/InboundEmailItem';
import { InboundEmailStatusItem } from '../../entity/InboundEmailStatusItem';
import { SalesOpportunityItem } from '../../entity/SalesOpportunityItem';
import { TicketItem } from '../../entity/TicketItem';

const MAX_LOG_ENTRIES = 100;
const MAX_PROMPT_BODY_LENGTH = 12_000;

export function isEmailInboxSubscriptionDue(
  subscription: Pick<
    EmailInboxSubscriptionItem,
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
  return (
    now.getTime() - subscription.lastRunAt.getTime() >=
    Math.max(1, subscription.intervalMinutes || 1) * 60_000
  );
}

export function buildInboundEmailAgentPrompt(
  email: InboundEmailItem,
  subscription: EmailInboxSubscriptionItem,
): string {
  const processingMode = readProcessingMode(subscription.processingMode);
  const targetEntity = processingTargetEntity(processingMode);
  const targetInstruction: Record<EmailInboxProcessingMode, string> = {
    ticket: promptText('inbound.text1'),
    salesOpportunity: promptText('inbound.text2'),
    officeTask: promptText('inbound.text3'),
  };
  const body = (email.bodyText || promptText('inbound-email.fragment1'))
    .slice(0, MAX_PROMPT_BODY_LENGTH)
    .trim();

  return [
    promptText('inbound.text4'),
    targetInstruction[processingMode],
    promptText('inbound.text5', { value0: email.fromAddress }),
    promptText('inbound.text6'),
    promptText('inbound.text7', { value0: targetEntity }),
    promptText('inbound.text8'),
    subscription.contextMarkdown?.trim()
      ? promptText('inbound-email.fragment2', {
          value0: subscription.contextMarkdown.trim(),
        })
      : null,
    promptText('inbound.text9', {
      value0: email.fromAddress,
      value1: getRelationHandle(email.person) ?? 'none',
      value2: getRelationHandle(email.company) ?? 'none',
      value3: getRelationHandle(email.sourceDocument) ?? 'none',
    }),
    [
      promptText('inbound-email.fragment3'),
      `From: ${email.fromName ? `${email.fromName} ` : ''}<${email.fromAddress}>`,
      `To: ${(email.toRecipients ?? []).join(', ')}`,
      `Cc: ${(email.ccRecipients ?? []).join(', ')}`,
      `Received: ${email.receivedAt.toISOString()}`,
      `Subject: ${email.subject}`,
      `Internet-Message-ID: ${email.internetMessageId ?? 'unknown'}`,
      `In-Reply-To: ${email.inReplyTo ?? 'none'}`,
      '',
      body,
      promptText('inbound-email.fragment4'),
    ].join('\n'),
  ]
    .filter((part): part is string => !!part)
    .join('\n\n');
}

export function buildInboundEmailActionRepairPrompt(
  email: InboundEmailItem,
  subscription: EmailInboxSubscriptionItem,
): string {
  const processingMode = readProcessingMode(subscription.processingMode);
  const targetEntity = processingTargetEntity(processingMode);

  return [
    promptText('inbound.text10'),
    promptText('inbound.text11', { value0: targetEntity }),
    promptText('inbound.text12'),
    promptText('inbound.text13'),
    processingMode === 'ticket' ? promptText('inbound.text14') : null,
    promptText('inbound.text15', {
      value0: getRelationHandle(email.person) ?? 'none',
      value1: getRelationHandle(email.company) ?? 'none',
    }),
    promptText('inbound.text16'),
  ]
    .filter((part): part is string => !!part)
    .join('\n\n');
}

export function applyInboundActionDefaults(
  processingMode: EmailInboxProcessingMode,
  action: AiChatToolActionItem,
): void {
  if (
    processingMode !== 'ticket' ||
    action.toolName !== 'generic_create' ||
    action.arguments?.entityHandle !== 'ticket'
  ) {
    return;
  }

  const actionArguments = { ...(action.arguments ?? {}) };
  const data = { ...asRecord(actionArguments.data) };
  if (typeof data.title === 'string') {
    data.title = data.title.slice(0, 256);
  }
  const defaults: Record<string, string> = {
    type: 'incident',
    source: 'email',
  };

  for (const [field, defaultHandle] of Object.entries(defaults)) {
    if (data[field] == null || data[field] === '') {
      data[field] = defaultHandle;
    }
  }

  action.arguments = { ...actionArguments, data };
}

export function bindInboundSenderCustomer(
  email: InboundEmailItem,
  action: AiChatToolActionItem,
): {
  prepared: boolean;
  personHandle: string | number | null;
  companyHandle: string | number | null;
} {
  const personHandle = getRelationHandle(email.person);
  const companyHandle = getRelationHandle(email.company);
  const actionArguments = { ...(action.arguments ?? {}) };
  const data = { ...asRecord(actionArguments.data) };

  if (action.toolName === 'generic_update') {
    delete data.creatorPerson;
    delete data.creatorCompany;
    action.arguments = { ...actionArguments, data };
    return { prepared: true, personHandle, companyHandle };
  }

  if (personHandle == null || companyHandle == null) {
    return { prepared: false, personHandle, companyHandle };
  }

  data.creatorPerson = personHandle;
  data.creatorCompany = companyHandle;
  action.arguments = { ...actionArguments, data };
  return { prepared: true, personHandle, companyHandle };
}

export function processingTargetEntity(mode: EmailInboxProcessingMode): string {
  return mode === 'officeTask' ? 'event' : mode;
}

export function readProcessingMode(value: unknown): EmailInboxProcessingMode {
  const handle = getRelationHandle(value);
  if (
    handle === 'ticket' ||
    handle === 'salesOpportunity' ||
    handle === 'officeTask'
  ) {
    return handle;
  }
  throw new Error('emailInboxSubscription.processingModeInvalid');
}

export function statusReference(
  em: EntityManager,
  handle: string,
): InboundEmailStatusItem {
  return em.getReference(InboundEmailStatusItem, handle as never);
}

export function appendInboundEmailLog(
  email: InboundEmailItem,
  level: InboundEmailLogEntry['level'],
  code: string,
  message: string,
  details?: Record<string, unknown>,
): void {
  email.processingLog = [
    ...(email.processingLog ?? []),
    createInboundEmailLogEntry(level, code, message, details),
  ].slice(-MAX_LOG_ENTRIES);
}

export function createInboundEmailLogEntry(
  level: InboundEmailLogEntry['level'],
  code: string,
  message: string,
  details?: Record<string, unknown>,
): InboundEmailLogEntry {
  return {
    at: new Date().toISOString(),
    level,
    code,
    message,
    ...(details ? { details } : {}),
  };
}

export function markInboundEmailForManualReview(
  em: EntityManager,
  email: InboundEmailItem,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): void {
  email.status = statusReference(em, 'manualReview');
  email.processingMessage = message;
  email.processedAt = new Date();
  appendInboundEmailLog(email, 'warning', code, message, details);
}

export function linkInboundTargetRecord(
  email: InboundEmailItem,
  targetEntity: string,
  targetHandle: string | number,
): void {
  switch (targetEntity) {
    case 'ticket':
      email.ticket = { handle: Number(targetHandle) } as TicketItem;
      return;
    case 'salesOpportunity':
      email.salesOpportunity = {
        handle: Number(targetHandle),
      } as SalesOpportunityItem;
      return;
    case 'event':
      email.officeTask = { handle: Number(targetHandle) } as EventItem;
  }
}

export function getRelationHandle(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  if (value && typeof value === 'object' && 'handle' in value) {
    const handle = (value as { handle?: unknown }).handle;
    return typeof handle === 'string' || typeof handle === 'number'
      ? handle
      : null;
  }
  return null;
}

export function buildEmlFilename(subject: string, receivedAt: Date): string {
  const safeSubject =
    subject
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100) || 'inbound-email';
  return `${receivedAt.toISOString().replace(/[:.]/g, '-')}-${safeSubject}.eml`;
}

export function truncateError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.length > 1024 ? `${message.slice(0, 1021)}...` : message;
}

export function describeAiProcessingFailure(
  error: unknown,
  agentHandle: string | number,
): {
  code: string;
  processingMessage: string;
  logMessage: string;
  details: Record<string, unknown>;
} {
  const rawError = truncateError(error);
  const statusCode = readErrorStatus(error);
  const isAuthorizationFailure =
    (statusCode === 401 || /(^|\s)401(\s|$)/.test(rawError)) &&
    /insufficient permissions|unauthori[sz]ed|authentication|api key/i.test(
      rawError,
    );

  if (isAuthorizationFailure) {
    return {
      code: 'ai.providerAuthorizationFailed',
      processingMessage: promptText('inbound.text17'),
      logMessage: promptText('inbound.text18'),
      details: {
        error: rawError,
        statusCode: statusCode ?? 401,
        agentHandle,
      },
    };
  }

  return {
    code: 'ai.failed',
    processingMessage: rawError,
    logMessage:
      'AI processing failed. The message requires manual review or retry.',
    details: { error: rawError, agentHandle },
  };
}

export function maxDate(left: Date | null | undefined, right: Date): Date {
  return !left || right.getTime() > left.getTime() ? right : left;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function readRecordHandle(value: unknown): string | number | null {
  return typeof value === 'string' || typeof value === 'number' ? value : null;
}

function readErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null;
  }
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' && Number.isInteger(status) ? status : null;
}
