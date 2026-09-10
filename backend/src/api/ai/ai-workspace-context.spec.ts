import { describe, expect, it, jest } from '@jest/globals';
jest.mock('./mcp.service', () => ({ McpService: class {} }));
jest.mock('./ai-agent-policy.service', () => ({
  AiAgentPolicyService: class {},
}));
import { AiAgentContextService } from './ai-agent-context.service';

describe('Workspace instruction lifetime', () => {
  it('reuses the saved instruction and keeps separate sessions isolated', async () => {
    const service = new AiAgentContextService(
      {} as never,
      {} as never,
      {
        resolveAgentForChat: jest.fn(async () => null),
        buildToolPolicy: jest.fn(() => undefined),
      } as never,
    );
    const run = (session: object) =>
      service.resolveAgentRuntimeContext(
        null,
        null,
        null,
        null,
        null,
        session as never,
        {} as never,
      );
    const session = {
      workspaceInstruction: 'Prepare a customer from pasted data',
    };
    const first = await run(session);
    const second = await run(session);
    expect(first.instruction).toContain(session.workspaceInstruction);
    expect(second.instruction).toBe(first.instruction);
    expect(first.instruction).toContain('does not override');
    expect(first.toolPolicy).toBeUndefined();
    expect((await run({})).instruction).toBeNull();
  });
});
