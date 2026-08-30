import { normalizeUsage } from './ai-usage-telemetry.service';

describe('AI usage normalization', () => {
  it('normalizes OpenAI-compatible usage', () => {
    expect(
      normalizeUsage({ input_tokens: 8, output_tokens: 4, total_tokens: 12 }),
    ).toEqual({
      inputTokens: 8,
      outputTokens: 4,
      totalTokens: 12,
      reported: true,
    });
  });

  it('derives total tokens without turning missing usage into zero', () => {
    expect(
      normalizeUsage({ promptTokenCount: 5, candidatesTokenCount: 3 }),
    ).toEqual({
      inputTokens: 5,
      outputTokens: 3,
      totalTokens: 8,
      reported: true,
    });
    expect(normalizeUsage(null)).toEqual({
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      reported: false,
    });
  });
});
