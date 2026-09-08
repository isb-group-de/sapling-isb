import { promptText } from '../api/ai/prompts/ai-prompt-context';
export function buildGeneratedArticleDescription(
  item: Record<string, unknown>,
): string {
  const title = typeof item.title === 'string' ? item.title : '';
  const handle =
    typeof item.handle === 'string' || typeof item.handle === 'number'
      ? `#${String(item.handle)}`
      : '';
  return [handle, title].filter(Boolean).join(' - ');
}

export function buildTicketReferencePrompt(
  handle: string | number,
  item: Record<string, unknown>,
): string {
  const number = normalizeString(item.number);
  const title = normalizeString(item.title);
  const externalNumber = normalizeString(item.externalNumber);
  const problemDescription = normalizeString(item.problemDescription);
  const solutionDescription = normalizeString(item.solutionDescription);

  return [
    promptText('ticket.text1'),
    '',
    promptText('ticket.text2', {
      value0: String(handle),
      value1: number ? ` - ${number}` : '',
      value2: title ? ` - ${title}` : '',
    }),
    externalNumber
      ? promptText('ticket.detail1', { value0: externalNumber })
      : null,
    problemDescription
      ? promptText('ticket.detail2', { value0: problemDescription })
      : null,
    solutionDescription
      ? promptText('ticket.detail3', { value0: solutionDescription })
      : null,
    '',
    'Arbeitsweise:',
    promptText('ticket.detail4'),
    promptText('ticket.text3', { value0: JSON.stringify(handle) }),
    promptText('ticket.text4'),
    promptText('ticket.text5'),
    promptText('ticket.text6'),
    promptText('ticket.text7'),
    '',
    promptText('ticket.detail5'),
    promptText('ticket.detail6'),
    promptText('ticket.detail7'),
    promptText('ticket.text8'),
    promptText('ticket.detail8'),
    promptText('ticket.detail9'),
  ]
    .filter(
      (line): line is string => typeof line === 'string' && line.length > 0,
    )
    .join('\n');
}

export function buildAiChatPromptUrl(
  prompt: string,
  title: string,
  handle?: string | number,
): string {
  const params = new URLSearchParams({
    prompt,
    title,
    autoSend: 'true',
    newChat: 'true',
    agentHandle: 'ticketSupportAgent',
    playbookHandle: 'supportTicketResolution',
    contextEntityHandle: 'ticket',
  });
  if (handle != null) params.set('contextRecordHandle', String(handle));
  return `sapling-ai-chat://prompt?${params.toString()}`;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}
