import { EntityManager } from '@mikro-orm/core';
import { BadRequestException, Injectable } from '@nestjs/common';
import { AiProviderModelItem } from '../../entity/AiProviderModelItem';
import { EffortEstimateItem } from '../../entity/EffortEstimateItem';
import { EffortEstimatePositionItem } from '../../entity/EffortEstimatePositionItem';
import { EventItem } from '../../entity/EventItem';
import { KnowledgeArticleItem } from '../../entity/KnowledgeArticleItem';
import { SalesOpportunityItem } from '../../entity/SalesOpportunityItem';
import { TicketItem } from '../../entity/TicketItem';
import { AiVectorDocumentDraft } from './ai.types';
import {
  buildEffortEstimatePositionSectionContent,
  buildEffortEstimateSectionContent,
  buildEventSectionContent,
  buildKnowledgeArticleSectionContent,
  buildSalesOpportunitySectionContent,
  companyLabel,
  formatVectorDate,
  personRelationLabel,
  relationLabel,
} from './ai-vector-content.utils';
import {
  assertVectorizableEntity,
  buildTicketSectionContent,
  buildTicketVectorMetadata,
  createVectorSectionDocuments,
  getVectorSearchRelations,
} from './ai-vector.utils';

@Injectable()
export class AiVectorDocumentBuilderService {
  constructor(private readonly em: EntityManager) {}

  async buildVectorDocuments(
    entityHandle: string,
    embeddingModel: AiProviderModelItem,
  ): Promise<AiVectorDocumentDraft[]> {
    assertVectorizableEntity(entityHandle);

    switch (entityHandle) {
      case 'ticket':
        return this.buildTicketVectorDocuments(embeddingModel);
      case 'event':
        return this.buildEventVectorDocuments(embeddingModel);
      case 'salesOpportunity':
        return this.buildSalesOpportunityVectorDocuments(embeddingModel);
      case 'effortEstimate':
        return this.buildEffortEstimateVectorDocuments(embeddingModel);
      case 'effortEstimatePosition':
        return this.buildEffortEstimatePositionVectorDocuments(embeddingModel);
      case 'knowledgeArticle':
        return this.buildKnowledgeArticleVectorDocuments(embeddingModel);
      default:
        throw new BadRequestException('ai.vectorizationUnsupportedEntity');
    }
  }

  private async buildTicketVectorDocuments(
    embeddingModel: AiProviderModelItem,
  ): Promise<AiVectorDocumentDraft[]> {
    const tickets = await this.em.find(
      TicketItem,
      {},
      {
        populate: [
          'status',
          'priority',
          'creatorCompany',
          'creatorPerson',
          'assigneeCompany',
          'assigneePerson',
        ],
        orderBy: { updatedAt: 'DESC' },
      },
    );
    const documents: AiVectorDocumentDraft[] = [];

    for (const ticket of tickets) {
      if (ticket.handle == null) {
        continue;
      }

      const sourceRecordHandle = String(ticket.handle);
      const title = ticket.title?.trim() || ticket.number?.trim() || null;
      const metadata = buildTicketVectorMetadata(ticket);

      documents.push(
        ...createVectorSectionDocuments(
          sourceRecordHandle,
          'overview',
          buildTicketSectionContent(ticket, 'overview'),
          title,
          metadata,
          embeddingModel,
        ),
      );
      documents.push(
        ...createVectorSectionDocuments(
          sourceRecordHandle,
          'problem',
          buildTicketSectionContent(ticket, 'problem'),
          title,
          metadata,
          embeddingModel,
        ),
      );
      documents.push(
        ...createVectorSectionDocuments(
          sourceRecordHandle,
          'solution',
          buildTicketSectionContent(ticket, 'solution'),
          title,
          metadata,
          embeddingModel,
        ),
      );
    }

    return documents;
  }

  private async buildEventVectorDocuments(
    embeddingModel: AiProviderModelItem,
  ): Promise<AiVectorDocumentDraft[]> {
    const events = await this.em.find(
      EventItem,
      {},
      {
        populate: getVectorSearchRelations('event') as never[],
        orderBy: { updatedAt: 'DESC' },
      },
    );
    const documents: AiVectorDocumentDraft[] = [];

    for (const event of events) {
      if (event.handle == null) {
        continue;
      }

      const sourceRecordHandle = String(event.handle);
      const title = event.title?.trim() || null;
      const metadata = {
        eventHandle: event.handle,
        title,
        status: relationLabel(event.status, 'description'),
        type: relationLabel(event.type, 'description', 'title', 'handle'),
        category: relationLabel(event.category, 'title', 'handle'),
        startDate: formatVectorDate(event.startDate),
        endDate: formatVectorDate(event.endDate),
        assigneeCompany: companyLabel(event.assigneeCompany),
        assigneePerson: personRelationLabel(event.assigneePerson),
        creatorCompany: companyLabel(event.creatorCompany),
        creatorPerson: personRelationLabel(event.creatorPerson),
        ticket: relationLabel(event.ticket, 'number', 'title', 'handle'),
        salesOpportunity: relationLabel(
          event.salesOpportunity,
          'title',
          'handle',
        ),
      };

      documents.push(
        ...createVectorSectionDocuments(
          sourceRecordHandle,
          'overview',
          buildEventSectionContent(event, 'overview'),
          title,
          metadata,
          embeddingModel,
        ),
      );
      documents.push(
        ...createVectorSectionDocuments(
          sourceRecordHandle,
          'description',
          buildEventSectionContent(event, 'description'),
          title,
          metadata,
          embeddingModel,
        ),
      );
    }

    return documents;
  }

  private async buildSalesOpportunityVectorDocuments(
    embeddingModel: AiProviderModelItem,
  ): Promise<AiVectorDocumentDraft[]> {
    const opportunities = await this.em.find(
      SalesOpportunityItem,
      {},
      {
        populate: getVectorSearchRelations('salesOpportunity') as never[],
        orderBy: { updatedAt: 'DESC' },
      },
    );
    const documents: AiVectorDocumentDraft[] = [];

    for (const opportunity of opportunities) {
      if (opportunity.handle == null) {
        continue;
      }

      const sourceRecordHandle = String(opportunity.handle);
      const title = opportunity.title?.trim() || null;
      const metadata = {
        salesOpportunityHandle: opportunity.handle,
        title,
        stage: relationLabel(opportunity.type, 'description', 'handle'),
        forecast: relationLabel(opportunity.forecast, 'description', 'handle'),
        source: relationLabel(opportunity.source, 'description', 'handle'),
        expectedRevenue: opportunity.expectedRevenue ?? null,
        probability: opportunity.probability ?? null,
        closeDate: formatVectorDate(opportunity.closeDate),
        assigneeCompany: companyLabel(opportunity.assigneeCompany),
        assigneePerson: personRelationLabel(opportunity.assigneePerson),
        creatorCompany: companyLabel(opportunity.creatorCompany),
        creatorPerson: personRelationLabel(opportunity.creatorPerson),
      };

      documents.push(
        ...createVectorSectionDocuments(
          sourceRecordHandle,
          'overview',
          buildSalesOpportunitySectionContent(opportunity, 'overview'),
          title,
          metadata,
          embeddingModel,
        ),
      );
      documents.push(
        ...createVectorSectionDocuments(
          sourceRecordHandle,
          'description',
          buildSalesOpportunitySectionContent(opportunity, 'description'),
          title,
          metadata,
          embeddingModel,
        ),
      );
      documents.push(
        ...createVectorSectionDocuments(
          sourceRecordHandle,
          'painPoints',
          buildSalesOpportunitySectionContent(opportunity, 'painPoints'),
          title,
          metadata,
          embeddingModel,
        ),
      );
    }

    return documents;
  }

  private async buildEffortEstimateVectorDocuments(
    embeddingModel: AiProviderModelItem,
  ): Promise<AiVectorDocumentDraft[]> {
    const estimates = await this.em.find(
      EffortEstimateItem,
      {},
      {
        populate: getVectorSearchRelations('effortEstimate') as never[],
        orderBy: { updatedAt: 'DESC' },
      },
    );
    const documents: AiVectorDocumentDraft[] = [];

    for (const estimate of estimates) {
      if (estimate.handle == null) {
        continue;
      }

      const sourceRecordHandle = String(estimate.handle);
      const title = estimate.title?.trim() || null;
      const metadata = {
        effortEstimateHandle: estimate.handle,
        title,
        status: relationLabel(estimate.status, 'description', 'handle'),
        expectedCompletionDate: formatVectorDate(
          estimate.expectedCompletionDate,
        ),
        assigneeCompany: companyLabel(estimate.assigneeCompany),
        assigneePerson: personRelationLabel(estimate.assigneePerson),
        creatorCompany: companyLabel(estimate.creatorCompany),
        creatorPerson: personRelationLabel(estimate.creatorPerson),
        ticket: relationLabel(estimate.ticket, 'number', 'title', 'handle'),
        salesOpportunity: relationLabel(
          estimate.salesOpportunity,
          'title',
          'handle',
        ),
      };

      documents.push(
        ...createVectorSectionDocuments(
          sourceRecordHandle,
          'overview',
          buildEffortEstimateSectionContent(estimate, 'overview'),
          title,
          metadata,
          embeddingModel,
        ),
      );
      documents.push(
        ...createVectorSectionDocuments(
          sourceRecordHandle,
          'requirements',
          buildEffortEstimateSectionContent(estimate, 'requirements'),
          title,
          metadata,
          embeddingModel,
        ),
      );
    }

    return documents;
  }

  private async buildEffortEstimatePositionVectorDocuments(
    embeddingModel: AiProviderModelItem,
  ): Promise<AiVectorDocumentDraft[]> {
    const positions = await this.em.find(
      EffortEstimatePositionItem,
      {},
      {
        populate: getVectorSearchRelations('effortEstimatePosition') as never[],
        orderBy: { updatedAt: 'DESC' },
      },
    );
    const documents: AiVectorDocumentDraft[] = [];

    for (const position of positions) {
      if (position.handle == null) {
        continue;
      }

      const sourceRecordHandle = String(position.handle);
      const title = position.title?.trim() || null;
      const metadata = {
        effortEstimatePositionHandle: position.handle,
        title,
        estimatedHours: position.estimatedHours ?? null,
        isOptional: position.isOptional,
        estimate: relationLabel(position.estimate, 'title', 'handle'),
        template: relationLabel(position.template, 'title', 'handle'),
      };

      documents.push(
        ...createVectorSectionDocuments(
          sourceRecordHandle,
          'overview',
          buildEffortEstimatePositionSectionContent(position, 'overview'),
          title,
          metadata,
          embeddingModel,
        ),
      );
      documents.push(
        ...createVectorSectionDocuments(
          sourceRecordHandle,
          'offerText',
          buildEffortEstimatePositionSectionContent(position, 'offerText'),
          title,
          metadata,
          embeddingModel,
        ),
      );
    }

    return documents;
  }

  private async buildKnowledgeArticleVectorDocuments(
    embeddingModel: AiProviderModelItem,
  ): Promise<AiVectorDocumentDraft[]> {
    const articles = await this.em.find(
      KnowledgeArticleItem,
      {},
      {
        populate: getVectorSearchRelations('knowledgeArticle') as never[],
        orderBy: { updatedAt: 'DESC' },
      },
    );
    const documents: AiVectorDocumentDraft[] = [];

    for (const article of articles) {
      if (article.handle == null) {
        continue;
      }

      const sourceRecordHandle = String(article.handle);
      const title = article.title?.trim() || null;
      const metadata = {
        knowledgeArticleHandle: article.handle,
        title,
        status: relationLabel(article.status, 'description', 'handle'),
        visibility: relationLabel(article.visibility, 'description', 'handle'),
        category: relationLabel(article.category, 'title', 'handle'),
        product: relationLabel(article.product, 'title', 'name', 'handle'),
        tags: article.tags?.trim() || null,
        contextKey: article.contextKey?.trim() || null,
        publishedAt: formatVectorDate(article.publishedAt),
        validUntil: formatVectorDate(article.validUntil),
        sourceTicket: relationLabel(
          article.sourceTicket,
          'number',
          'title',
          'handle',
        ),
        sourceSalesOpportunity: relationLabel(
          article.sourceSalesOpportunity,
          'title',
          'handle',
        ),
        sourceEffortEstimate: relationLabel(
          article.sourceEffortEstimate,
          'title',
          'handle',
        ),
        authorPerson: personRelationLabel(article.authorPerson),
        reviewerPerson: personRelationLabel(article.reviewerPerson),
      };

      documents.push(
        ...createVectorSectionDocuments(
          sourceRecordHandle,
          'overview',
          buildKnowledgeArticleSectionContent(article, 'overview'),
          title,
          metadata,
          embeddingModel,
        ),
      );
      documents.push(
        ...createVectorSectionDocuments(
          sourceRecordHandle,
          'problem',
          buildKnowledgeArticleSectionContent(article, 'problem'),
          title,
          metadata,
          embeddingModel,
        ),
      );
      documents.push(
        ...createVectorSectionDocuments(
          sourceRecordHandle,
          'solution',
          buildKnowledgeArticleSectionContent(article, 'solution'),
          title,
          metadata,
          embeddingModel,
        ),
      );
      documents.push(
        ...createVectorSectionDocuments(
          sourceRecordHandle,
          'documentation',
          buildKnowledgeArticleSectionContent(article, 'documentation'),
          title,
          metadata,
          embeddingModel,
        ),
      );
    }

    return documents;
  }
}
