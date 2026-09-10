import { AiPromptTemplateItem } from './AiPromptTemplateItem';
import { AiPromptVersionItem } from './AiPromptVersionItem';
import { AiAgentEvaluationItem } from './AiAgentEvaluationItem';
import { AiAgentRunItem } from './AiAgentRunItem';
import { AiChatSessionItem } from './AiChatSessionItem';
import { AiProviderModelItem } from './AiProviderModelItem';
import { AutomationExecutionItem } from './AutomationExecutionItem';
import { EmailDeliveryItem } from './EmailDeliveryItem';
import { EventDeliveryItem } from './EventDeliveryItem';
import { InboundEmailItem } from './InboundEmailItem';
import {
  getSaplingFormLayout,
  hasSaplingOption,
} from './global/entity.decorator';
import translations from '../database/seeder/json-default/translation/translationData_0001_insert.json';

describe('Prompt, evaluation and diagnostic field metadata', () => {
  it.each([
    [
      AiPromptTemplateItem,
      ['title', 'purpose', 'publishedVersion', 'updatedAt'],
    ],
    [
      AiPromptVersionItem,
      ['template', 'version', 'changeNote', 'author', 'publishedAt'],
    ],
  ] as const)('provides useful default columns for %p', (entity, fields) => {
    for (const field of fields) {
      expect(getSaplingFormLayout(entity.prototype, field)).toMatchObject({
        tableVisible: true,
        mobileVisible: true,
      });
    }
  });

  it('exposes all prompt fields in translated form groups', () => {
    for (const [entity, fields] of [
      [
        AiPromptTemplateItem,
        [
          'handle',
          'title',
          'description',
          'purpose',
          'draft',
          'variables',
          'publishedVersion',
          'updatedAt',
        ],
      ],
      [
        AiPromptVersionItem,
        [
          'handle',
          'template',
          'version',
          'content',
          'variables',
          'changeNote',
          'author',
          'checksum',
          'publishedAt',
        ],
      ],
    ] as const) {
      for (const field of fields) {
        const layout = getSaplingFormLayout(entity.prototype, field);
        expect(layout.formVisible).toBe(true);
        expect(layout.width).toBeGreaterThan(0);
        expect(
          ['de', 'en'].every((language) =>
            translations.some(
              (entry) =>
                `${entry.entity}.${entry.property}` === layout.group &&
                entry.language === language &&
                entry.value,
            ),
          ),
        ).toBe(true);
      }
    }
    expect(
      hasSaplingOption(AiPromptTemplateItem.prototype, 'draft', 'isMarkdown'),
    ).toBe(true);
    expect(
      getSaplingFormLayout(AiPromptTemplateItem.prototype, 'draft').width,
    ).toBe(4);
  });

  it('keeps every published-version field read-only and the draft editable', () => {
    for (const field of [
      'handle',
      'template',
      'version',
      'content',
      'variables',
      'changeNote',
      'author',
      'checksum',
      'publishedAt',
    ]) {
      expect(
        hasSaplingOption(AiPromptVersionItem.prototype, field, 'isReadOnly'),
      ).toBe(true);
    }
    for (const field of ['title', 'description', 'draft']) {
      expect(
        hasSaplingOption(AiPromptTemplateItem.prototype, field, 'isReadOnly'),
      ).toBe(false);
    }
  });

  it.each([
    [AiAgentEvaluationItem, ['toolFixtures', 'expectations']],
    [AiAgentRunItem, ['purpose', 'evaluationResult', 'promptManifest']],
    [AiChatSessionItem, ['promptManifest']],
    [AiProviderModelItem, ['isDefaultMarkdown']],
    [AutomationExecutionItem, ['ruleSnapshot']],
    [EmailDeliveryItem, ['ruleSnapshot']],
    [EventDeliveryItem, ['queueWaitMs', 'providerDurationMs']],
    [InboundEmailItem, ['promptManifest']],
  ] as const)(
    'exposes the new fields of %p intentionally',
    (entity, fields) => {
      for (const field of fields) {
        const layout = getSaplingFormLayout(entity.prototype, field);
        expect(layout.formVisible).toBe(true);
        expect(typeof layout.tableVisible).toBe('boolean');
        expect(layout.group).toBeTruthy();
      }
    },
  );
});
