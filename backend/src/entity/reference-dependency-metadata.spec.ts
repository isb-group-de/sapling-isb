import { describe, expect, it } from '@jest/globals';

import { AiAgentItem } from './AiAgentItem';
import { AiAgentVersionItem } from './AiAgentVersionItem';
import { AiChatSessionItem } from './AiChatSessionItem';
import { AiEntityGenerationTemplateItem } from './AiEntityGenerationTemplateItem';
import { DvelopConnectionItem } from './DvelopConnectionItem';
import { DvelopEntityMappingItem } from './DvelopEntityMappingItem';
import { EmailSubscriptionItem } from './EmailSubscriptionItem';
import { FavoriteItem } from './FavoriteItem';
import { FavoriteTemplateItem } from './FavoriteTemplateItem';
import { ImportBatchItem } from './ImportBatchItem';
import { InboxSubscriptionItem } from './InboxSubscriptionItem';
import { SharedMailboxContextItem } from './SharedMailboxContextItem';
import { TeamsSubscriptionItem } from './TeamsSubscriptionItem';
import { getSaplingReferenceDependency } from './global/entity.decorator';

type EntityPrototype = object;

describe('reference dependency metadata', () => {
  const bidirectionalDependencies: Array<[string, EntityPrototype, string]> = [
    ['AI agent model', AiAgentItem.prototype, 'model'],
    ['AI agent search model', AiAgentItem.prototype, 'webSearchModel'],
    ['AI agent version model', AiAgentVersionItem.prototype, 'model'],
    [
      'AI agent version search model',
      AiAgentVersionItem.prototype,
      'webSearchModel',
    ],
    ['AI chat session model', AiChatSessionItem.prototype, 'model'],
    ['AI generation model', AiEntityGenerationTemplateItem.prototype, 'model'],
    [
      'd.velop object definition',
      DvelopEntityMappingItem.prototype,
      'objectDefinition',
    ],
    ['email template', EmailSubscriptionItem.prototype, 'template'],
    ['favorite route', FavoriteItem.prototype, 'entityRoute'],
    ['favorite template route', FavoriteTemplateItem.prototype, 'entityRoute'],
    ['import template', ImportBatchItem.prototype, 'importTemplate'],
    ['inbox template', InboxSubscriptionItem.prototype, 'template'],
    ['shared mailbox template', SharedMailboxContextItem.prototype, 'template'],
    ['Teams template', TeamsSubscriptionItem.prototype, 'template'],
  ];

  it.each(bidirectionalDependencies)(
    'allows selecting the %s before its parent reference',
    (_label, prototype, fieldName) => {
      expect(
        getSaplingReferenceDependency(prototype, fieldName)?.requireParent,
      ).not.toBe(true);
    },
  );

  it('keeps scalar-handle dependencies parent-first', () => {
    expect(
      getSaplingReferenceDependency(
        DvelopConnectionItem.prototype,
        'repository',
      ),
    ).toMatchObject({ parentField: 'handle', requireParent: true });
    expect(
      getSaplingReferenceDependency(
        DvelopConnectionItem.prototype,
        'defaultObjectDefinition',
      ),
    ).toMatchObject({ parentField: 'handle', requireParent: true });
  });
});
