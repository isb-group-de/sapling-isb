jest.mock('./ai-agent-context.service', () => ({
  AiAgentContextService: class {},
}));
jest.mock('./ai-chat-runtime.service', () => ({
  AiChatRuntimeService: class {},
}));
jest.mock('./ai-provider-registry.service', () => ({
  AiProviderRegistryService: class {},
}));
jest.mock('./mcp.service', () => ({ McpService: class {} }));
import { AiEvaluationService } from './ai-evaluation.service';
import { AiPromptService } from './prompts/ai-prompt.service';

describe('Controlled agent evaluations', () => {
  it.each([true, false])(
    'never invokes real mutating tools (fixture present: %s)',
    async (available) => {
      const test = {
        handle: 1,
        title: 'Ticket',
        prompt: 'Create a ticket',
        targetEntityHandle: 'ticket',
        expectations: { requiredTools: ['generic_create'] },
        toolFixtures: available ? { generic_create: { handle: 42 } } : {},
      };
      const em = {
        find: jest.fn().mockResolvedValue([test]),
        create: jest.fn((_entity: unknown, data: Record<string, unknown>) => ({
          handle: 11,
          ...data,
        })),
        persist: jest.fn(),
        flush: jest.fn().mockResolvedValue(undefined),
      };
      const mcp = {
        listActiveTools: jest.fn().mockResolvedValue([]),
        executeTool: jest.fn(() => {
          throw Error('Real tool execution is forbidden');
        }),
      };
      const streamOpenAi = jest.fn(async (...args: unknown[]) => {
        const executor = args[10] as (
          entry: unknown,
          arguments_: unknown,
        ) => Promise<unknown>;
        await executor(
          { descriptor: { toolName: 'generic_create', serverName: 'sapling' } },
          { entityHandle: 'ticket' },
        );
        return { toolCalls: [], usagePayload: { inputTokens: 10 } };
      });
      const service = new AiEvaluationService(
        em as never,
        {
          resolveAgentRuntimeContext: jest.fn().mockResolvedValue({
            agent: null,
            version: null,
            instruction: '',
            toolPolicy: {},
          }),
        } as never,
        { streamOpenAi, streamGemini: jest.fn() } as never,
        {
          resolveRuntimeTarget: jest.fn().mockResolvedValue({
            providerKind: 'openai',
            provider: { handle: 'test' },
            model: { providerModel: 'fixture', supportsTools: true },
          }),
        } as never,
        mcp as never,
        new AiPromptService(em as never),
      );
      const [run] = await service.run('test', [1], { handle: 1 } as never);
      expect(mcp.executeTool).not.toHaveBeenCalled();
      expect(run.evaluationResult?.passed).toBe(available);
      expect(run.promptManifest).toBeTruthy();
      expect(run.status).toBe(available ? 'completed' : 'failed');
    },
  );
});
