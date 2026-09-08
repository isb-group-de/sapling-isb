import {
  aiPromptContext,
  promptText,
  renderPrompt,
  validatePrompt,
} from './ai-prompt-context';
import { AiPromptService } from './ai-prompt.service';

describe('Published prompts', () => {
  it('uses the winner of a cross-instance race when pinning a legacy session', async () => {
    const session = { handle: 9, promptManifest: null };
    const em = {
      nativeUpdate: jest.fn().mockResolvedValue(0),
      findOneOrFail: jest
        .fn()
        .mockResolvedValue({ promptManifest: { test: 77 } }),
      find: jest.fn().mockResolvedValue([
        {
          handle: 77,
          template: { handle: 'test' },
          content: 'pinned by another instance',
          variables: [],
        },
      ]),
    };
    const text = await new AiPromptService(em as never).runSession(
      session as never,
      async () => promptText('test'),
    );
    expect(text).toBe('pinned by another instance');
    expect(session.promptManifest).toEqual({ test: 77 });
    expect(em.nativeUpdate).toHaveBeenCalledWith(
      expect.anything(),
      { handle: 9, promptManifest: null },
      expect.anything(),
    );
  });
  it('rejects unknown, removed or executable placeholders', () => {
    expect(() => validatePrompt('{{missing}}', [])).toThrow();
    expect(() => validatePrompt('Hello', ['name'])).toThrow();
    expect(() => validatePrompt('{{person.name}}', [])).toThrow();
  });

  it('does not interpret placeholders in supplied data', () => {
    expect(
      renderPrompt('Mail: {{body}}', ['body'], { body: '{{secret}}' }),
    ).toBe('Mail: {{secret}}');
    expect(() => renderPrompt('{{body}}', ['body'])).toThrow();
  });

  it('never falls back to code when a published prompt is unavailable', () => {
    aiPromptContext.run({ manifest: {}, prompts: {} }, () =>
      expect(() => promptText('chat.ai_system_prompt_base')).toThrow(
        'ai.promptNotPublished',
      ),
    );
  });

  it('keeps concurrent scopes isolated', async () => {
    const read = (content: string, delay: number) =>
      aiPromptContext.run(
        {
          manifest: { test: delay },
          prompts: { test: { handle: delay, content, variables: [] } },
        },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, delay));
          return promptText('test');
        },
      );
    expect(await Promise.all([read('old', 10), read('new', 1)])).toEqual([
      'old',
      'new',
    ]);
  });

  it('loads exact versions from a session manifest instead of current publication', async () => {
    const find = jest.fn().mockResolvedValue([
      {
        handle: 4,
        template: { handle: 'test' },
        content: 'old',
        variables: [],
      },
    ]);
    const service = new AiPromptService({ find } as never);
    const result = await service.run(
      () => Promise.resolve(promptText('test')),
      { test: 4 },
    );
    expect(result).toBe('old');
    expect(find).toHaveBeenCalledWith(
      expect.anything(),
      { handle: { $in: [4] } },
      expect.anything(),
    );
  });

  it('refuses a version that belongs to another template', async () => {
    const find = jest.fn().mockResolvedValue([
      {
        handle: 4,
        template: { handle: 'other' },
        content: 'old',
        variables: [],
      },
    ]);
    await expect(
      new AiPromptService({ find } as never).load({ test: 4 }),
    ).rejects.toThrow('ai.promptManifestInvalid');
  });
});
