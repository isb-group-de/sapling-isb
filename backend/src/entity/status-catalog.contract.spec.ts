import { describe, expect, it } from '@jest/globals';

import { EffortEstimateStatusItem } from './EffortEstimateStatusItem';
import { EmailDeliveryStatusItem } from './EmailDeliveryStatusItem';
import { EventDeliveryStatusItem } from './EventDeliveryStatusItem';
import { EventStatusItem } from './EventStatusItem';
import { InboundEmailStatusItem } from './InboundEmailStatusItem';
import { InternalCaseStatusItem } from './InternalCaseStatusItem';
import { KnowledgeArticleStatusItem } from './KnowledgeArticleStatusItem';
import { MarketingCampaignStatusItem } from './MarketingCampaignStatusItem';
import { SalesOpportunityResultStatusItem } from './SalesOpportunityResultStatusItem';
import { SalesOpportunityStageItem } from './SalesOpportunityStageItem';
import { TeamsDeliveryStatusItem } from './TeamsDeliveryStatusItem';
import { TicketStatusItem } from './TicketStatusItem';
import { WebhookDeliveryStatusItem } from './WebhookDeliveryStatusItem';
import { getSaplingOptions } from './global/entity.decorator';

const STATUS_CATALOGS = [
  [EffortEstimateStatusItem, 'description'],
  [EmailDeliveryStatusItem, 'description'],
  [EventDeliveryStatusItem, 'description'],
  [EventStatusItem, 'description'],
  [InboundEmailStatusItem, 'description'],
  [InternalCaseStatusItem, 'description'],
  [KnowledgeArticleStatusItem, 'description'],
  [MarketingCampaignStatusItem, 'title'],
  [SalesOpportunityResultStatusItem, 'title'],
  [SalesOpportunityStageItem, 'title'],
  [TeamsDeliveryStatusItem, 'description'],
  [TicketStatusItem, 'description'],
  [WebhookDeliveryStatusItem, 'description'],
] as const;

describe('status catalog metadata contract', () => {
  it.each(STATUS_CATALOGS)(
    '%p exposes open-state defaults and orders chips exclusively by sortOrder',
    (StatusCatalog, valueField) => {
      const item = new StatusCatalog() as {
        isOpen?: boolean;
        sortOrder?: number;
      };

      expect(item.isOpen).toBe(true);
      expect(typeof item.sortOrder).toBe('number');
      expect(getSaplingOptions(StatusCatalog.prototype, 'sortOrder')).toContain(
        'isOrderASC',
      );
      expect(
        getSaplingOptions(StatusCatalog.prototype, valueField),
      ).not.toContain('isOrderASC');
    },
  );
});
