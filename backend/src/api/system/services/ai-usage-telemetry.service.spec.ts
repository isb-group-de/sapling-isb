import {
  AiUsageTelemetryService,
  normalizeUsage,
} from './ai-usage-telemetry.service';

describe('AI usage normalization', () => {
  it.each([
    [{ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }, 15, true],
    [
      { promptTokenCount: 20, candidatesTokenCount: 6, totalTokenCount: 28 },
      28,
      true,
    ],
    [{ input_tokens: 4, output_tokens: 2 }, 6, true],
    [{ type: 'duration', seconds: 5 }, null, false],
    [{ prompt_tokens: 0, completion_tokens: 0 }, 0, true],
    [{ prompt_tokens: 'invalid', completion_tokens: null }, null, false],
  ])(
    'preserves provider totals and distinguishes missing counts: %j',
    (payload, total, reported) => {
      expect(normalizeUsage(payload)).toMatchObject({
        totalTokens: total,
        reported,
      });
    },
  );

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

  it('uses JSONB functions without introducing extra SQL placeholders', async () => {
    const execute = jest.fn().mockResolvedValue([]);
    const em = { getConnection: () => ({ execute }) };
    const service = new AiUsageTelemetryService(
      { fork: () => em } as never,
      {
        currentId: 'test',
        ensure: jest.fn().mockResolvedValue(undefined),
      } as never,
    );

    await service.backfillAgentRuns();

    const [sql, parameters] = execute.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("jsonb_typeof(source.usage->'inputTokens')");
    expect(sql).toContain("jsonb_typeof(source.usage->'prompt_tokens')");
    expect(sql).toContain("jsonb_typeof(source.usage->'promptTokenCount')");
    expect(sql).toContain("'transcription:' || transcription.handle");
    expect(sql.match(/\?/g)).toHaveLength(1);
    expect(parameters).toEqual(['test']);
  });
});
