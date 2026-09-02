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
    'Bitte analysiere dieses Sapling-Ticket und finde passende Faelle, Lösungen und Referenzen.',
    '',
    `Aktuelles Ticket: ${String(handle)}${number ? ` - ${number}` : ''}${title ? ` - ${title}` : ''}`,
    externalNumber ? `Externe Referenz aus der Liste: ${externalNumber}` : null,
    problemDescription
      ? `Bekannte Problembeschreibung aus der Liste: ${problemDescription}`
      : null,
    solutionDescription
      ? `Bekannte Lösung aus der Liste: ${solutionDescription}`
      : null,
    '',
    'Arbeitsweise:',
    '1. Lade das aktuelle Ticket mit generic_get.',
    `   entityHandle: ticket, handle: ${JSON.stringify(handle)}, relations: ["status", "priority", "type", "category", "source", "contract", "supportTeam", "supportQueue", "creatorCompany", "creatorPerson", "assigneeCompany", "assigneePerson", "salesOpportunity", "events", "effortEstimates"]`,
    '2. Baue aus Titel, Problem, Lösung, Status, Priorität, Kunde, Vertrag und verknüpften Datensätzen eine Suchanfrage.',
    '3. Nutze knowledge_search mit entityHandles ["ticket", "knowledgeArticle", "effortEstimate", "effortEstimatePosition", "salesOpportunity"].',
    '4. Nutze ticket_search ergänzend, wenn Ticketnummern, externe Referenzen oder exakte Begriffe relevant sind.',
    '5. Wenn ein Vektorindex fehlt, nenne ihn kurz und nutze die verfügbaren Quellen weiter.',
    '',
    'Gib mir kompakt:',
    '- ähnliche Tickets und deren Lösungen oder Workarounds',
    '- passende Wissensartikel und wiederverwendbare Lösungsschritte',
    '- verwandte Schätzungen, Positionen oder Verkaufschancen, falls sie fachlich passen',
    '- Risiken, offene Rückfragen und nächste sinnvolle Support-Schritte',
    '- eine kurze Antwort auf: Welche Faelle passen zu diesem Ticket?',
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
