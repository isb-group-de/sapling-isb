import { EffortEstimateItem } from '../../entity/EffortEstimateItem';
import { EffortEstimatePositionItem } from '../../entity/EffortEstimatePositionItem';
import { EventItem } from '../../entity/EventItem';
import { KnowledgeArticleItem } from '../../entity/KnowledgeArticleItem';
import { SalesOpportunityItem } from '../../entity/SalesOpportunityItem';
import { buildPersonLabel, summarizeVectorText } from './ai-vector.utils';

export function buildEventSectionContent(
  event: EventItem,
  section: 'overview' | 'description',
): string {
  const lines = compactVectorLines([
    `Event: ${event.handle ?? ''}`.trim(),
    event.title?.trim() ? `Title: ${event.title.trim()}` : null,
    vectorLine('Status', relationLabel(event.status, 'description')),
    vectorLine(
      'Type',
      relationLabel(event.type, 'description', 'title', 'handle'),
    ),
    vectorLine('Start', formatVectorDate(event.startDate)),
    vectorLine('End', formatVectorDate(event.endDate)),
    vectorLine('Creator company', companyLabel(event.creatorCompany)),
    vectorLine('Creator person', personRelationLabel(event.creatorPerson)),
    vectorLine('Assignee company', companyLabel(event.assigneeCompany)),
    vectorLine('Assignee person', personRelationLabel(event.assigneePerson)),
    vectorLine(
      'Ticket',
      relationLabel(event.ticket, 'number', 'title', 'handle'),
    ),
    vectorLine(
      'Sales opportunity',
      relationLabel(event.salesOpportunity, 'title', 'handle'),
    ),
  ]);

  if (section === 'overview') {
    lines.push('Section: Overview');
    if (event.description?.trim()) {
      lines.push(
        `Description summary: ${summarizeVectorText(event.description)}`,
      );
    }
    return lines.join('\n');
  }

  if (!event.description?.trim()) {
    return '';
  }

  lines.push('Section: Description');
  lines.push(event.description.trim());
  return lines.join('\n');
}

export function buildSalesOpportunitySectionContent(
  opportunity: SalesOpportunityItem,
  section: 'overview' | 'description' | 'painPoints',
): string {
  const lines = compactVectorLines([
    `Sales opportunity: ${opportunity.handle ?? ''}`.trim(),
    opportunity.title?.trim() ? `Title: ${opportunity.title.trim()}` : null,
    vectorLine(
      'Stage',
      relationLabel(opportunity.type, 'description', 'handle'),
    ),
    vectorLine(
      'Forecast',
      relationLabel(opportunity.forecast, 'description', 'handle'),
    ),
    vectorLine(
      'Source',
      relationLabel(opportunity.source, 'description', 'handle'),
    ),
    vectorLine('Expected revenue', opportunity.expectedRevenue),
    vectorLine('Probability', opportunity.probability),
    vectorLine('Close date', formatVectorDate(opportunity.closeDate)),
    opportunity.nextStep?.trim()
      ? `Next step: ${opportunity.nextStep.trim()}`
      : null,
    vectorLine('Creator company', companyLabel(opportunity.creatorCompany)),
    vectorLine(
      'Creator person',
      personRelationLabel(opportunity.creatorPerson),
    ),
    vectorLine('Assignee company', companyLabel(opportunity.assigneeCompany)),
    vectorLine(
      'Assignee person',
      personRelationLabel(opportunity.assigneePerson),
    ),
  ]);

  if (section === 'overview') {
    lines.push('Section: Overview');
    if (opportunity.description?.trim()) {
      lines.push(
        `Description summary: ${summarizeVectorText(opportunity.description)}`,
      );
    }
    if (opportunity.painPoints?.trim()) {
      lines.push(
        `Pain points summary: ${summarizeVectorText(opportunity.painPoints)}`,
      );
    }
    return lines.join('\n');
  }

  const body =
    section === 'description'
      ? (opportunity.description?.trim() ?? '')
      : (opportunity.painPoints?.trim() ?? '');

  if (!body) {
    return '';
  }

  lines.push(
    `Section: ${section === 'description' ? 'Description' : 'Pain points'}`,
  );
  lines.push(body);
  return lines.join('\n');
}

export function buildEffortEstimateSectionContent(
  estimate: EffortEstimateItem,
  section: 'overview' | 'requirements',
): string {
  const lines = compactVectorLines([
    `Effort estimate: ${estimate.handle ?? ''}`.trim(),
    estimate.title?.trim() ? `Title: ${estimate.title.trim()}` : null,
    vectorLine(
      'Status',
      relationLabel(estimate.status, 'description', 'handle'),
    ),
    vectorLine(
      'Expected completion',
      formatVectorDate(estimate.expectedCompletionDate),
    ),
    vectorLine('Creator company', companyLabel(estimate.creatorCompany)),
    vectorLine('Creator person', personRelationLabel(estimate.creatorPerson)),
    vectorLine('Assignee company', companyLabel(estimate.assigneeCompany)),
    vectorLine('Assignee person', personRelationLabel(estimate.assigneePerson)),
    vectorLine(
      'Ticket',
      relationLabel(estimate.ticket, 'number', 'title', 'handle'),
    ),
    vectorLine(
      'Sales opportunity',
      relationLabel(estimate.salesOpportunity, 'title', 'handle'),
    ),
  ]);

  if (section === 'overview') {
    lines.push('Section: Overview');
    if (estimate.requirementsMarkdown?.trim()) {
      lines.push(
        `Requirements summary: ${summarizeVectorText(
          estimate.requirementsMarkdown,
        )}`,
      );
    }
    return lines.join('\n');
  }

  if (!estimate.requirementsMarkdown?.trim()) {
    return '';
  }

  lines.push('Section: Requirements');
  lines.push(estimate.requirementsMarkdown.trim());
  return lines.join('\n');
}

export function buildEffortEstimatePositionSectionContent(
  position: EffortEstimatePositionItem,
  section: 'overview' | 'offerText',
): string {
  const lines = compactVectorLines([
    `Effort estimate position: ${position.handle ?? ''}`.trim(),
    position.title?.trim() ? `Title: ${position.title.trim()}` : null,
    vectorLine('Estimated hours', position.estimatedHours),
    vectorLine('Optional', position.isOptional ? 'yes' : 'no'),
    vectorLine('Estimate', relationLabel(position.estimate, 'title', 'handle')),
    vectorLine('Template', relationLabel(position.template, 'title', 'handle')),
  ]);

  if (section === 'overview') {
    lines.push('Section: Overview');
    if (position.offerTextMarkdown?.trim()) {
      lines.push(
        `Offer text summary: ${summarizeVectorText(position.offerTextMarkdown)}`,
      );
    }
    return lines.join('\n');
  }

  if (!position.offerTextMarkdown?.trim()) {
    return '';
  }

  lines.push('Section: Offer text');
  lines.push(position.offerTextMarkdown.trim());
  return lines.join('\n');
}

export function buildKnowledgeArticleSectionContent(
  article: KnowledgeArticleItem,
  section: 'overview' | 'problem' | 'solution' | 'documentation',
): string {
  const lines = compactVectorLines([
    `Knowledge article: ${article.handle ?? ''}`.trim(),
    article.title?.trim() ? `Title: ${article.title.trim()}` : null,
    vectorLine(
      'Status',
      relationLabel(article.status, 'description', 'handle'),
    ),
    vectorLine(
      'Visibility',
      relationLabel(article.visibility, 'description', 'handle'),
    ),
    vectorLine('Category', relationLabel(article.category, 'title', 'handle')),
    vectorLine(
      'Product',
      relationLabel(article.product, 'title', 'name', 'handle'),
    ),
    article.contextKey?.trim()
      ? `Context key: ${article.contextKey.trim()}`
      : null,
    article.tags?.trim() ? `Tags: ${article.tags.trim()}` : null,
    vectorLine('Published at', formatVectorDate(article.publishedAt)),
    vectorLine('Valid until', formatVectorDate(article.validUntil)),
    vectorLine(
      'Source ticket',
      relationLabel(article.sourceTicket, 'number', 'title', 'handle'),
    ),
    vectorLine(
      'Source sales opportunity',
      relationLabel(article.sourceSalesOpportunity, 'title', 'handle'),
    ),
    vectorLine(
      'Source effort estimate',
      relationLabel(article.sourceEffortEstimate, 'title', 'handle'),
    ),
    vectorLine('Author', personRelationLabel(article.authorPerson)),
    vectorLine('Reviewer', personRelationLabel(article.reviewerPerson)),
  ]);

  if (section === 'overview') {
    lines.push('Section: Overview');
    if (article.summary?.trim()) {
      lines.push(`Summary: ${summarizeVectorText(article.summary)}`);
    }
    if (article.problemMarkdown?.trim()) {
      lines.push(
        `Problem summary: ${summarizeVectorText(article.problemMarkdown)}`,
      );
    }
    if (article.solutionMarkdown?.trim()) {
      lines.push(
        `Solution summary: ${summarizeVectorText(article.solutionMarkdown)}`,
      );
    }
    if (article.documentationMarkdown?.trim()) {
      lines.push(
        `Documentation summary: ${summarizeVectorText(
          article.documentationMarkdown,
        )}`,
      );
    }
    return lines.join('\n');
  }

  const sectionBodies = {
    documentation: article.documentationMarkdown?.trim() ?? '',
    problem: article.problemMarkdown?.trim() ?? '',
    solution: article.solutionMarkdown?.trim() ?? '',
  } satisfies Record<'documentation' | 'problem' | 'solution', string>;
  const body = sectionBodies[section];

  if (!body) {
    return '';
  }

  const sectionLabels = {
    documentation: 'Documentation',
    problem: 'Problem',
    solution: 'Solution',
  } satisfies Record<'documentation' | 'problem' | 'solution', string>;
  lines.push(`Section: ${sectionLabels[section]}`);
  lines.push(body);
  return lines.join('\n');
}

function compactVectorLines(
  lines: Array<string | null | undefined | false>,
): string[] {
  return lines.filter(
    (line): line is string =>
      typeof line === 'string' && line.trim().length > 0,
  );
}

function vectorLine(label: string, value: unknown): string | null {
  const normalized = normalizeVectorValue(value);
  return normalized ? `${label}: ${normalized}` : null;
}

export function relationLabel(
  value: unknown,
  ...properties: string[]
): string | null {
  if (!value || typeof value === 'string') {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  const record = value as Record<string, unknown>;

  for (const property of properties) {
    const normalized = normalizeVectorValue(record[property]);

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function companyLabel(value: unknown): string | null {
  return relationLabel(value, 'name', 'title', 'handle');
}

export function personRelationLabel(value: unknown): string | null {
  if (!value || typeof value === 'string') {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  const record = value as {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  };
  return (
    buildPersonLabel(record.firstName, record.lastName, record.email) || null
  );
}

function normalizeVectorValue(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || null;
  }

  return null;
}

export function formatVectorDate(value?: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value.trim() || null;
}
