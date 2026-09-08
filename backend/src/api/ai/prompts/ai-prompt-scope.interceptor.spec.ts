import { lastValueFrom, of } from 'rxjs';
import { AiPromptScopeInterceptor } from './ai-prompt-scope.interceptor';

describe('Standalone prompt scope', () => {
  function harness(path: string, name?: string, method = 'POST') {
    const prompts = {
      run: jest.fn((work: () => Promise<unknown>) => work()),
      record: jest.fn(
        (_purpose: string, _person: unknown, work: () => Promise<unknown>) =>
          work(),
      ),
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          path,
          method,
          body: { name },
          user: { handle: 1 },
        }),
      }),
    };
    return {
      prompts,
      result: lastValueFrom(
        new AiPromptScopeInterceptor(prompts as never).intercept(
          context as never,
          { handle: () => of('ok') },
        ),
      ),
    };
  }

  it.each([
    ['/api/script/runClient', 'normalAction'],
    ['/api/ai/speech/providers', undefined],
  ])('does not load the prompt catalogue for %s', async (path, name) => {
    const { prompts, result } = harness(path, name, name ? 'POST' : 'GET');
    expect(await result).toBe('ok');
    expect(prompts.run).not.toHaveBeenCalled();
    expect(prompts.record).not.toHaveBeenCalled();
  });

  it('records the manifest scope when a record action builds an AI request', async () => {
    const { prompts, result } = harness(
      '/api/script/runClient',
      'aiFindTicketReferences',
    );
    expect(await result).toBe('ok');
    expect(prompts.record).toHaveBeenCalledWith(
      'record-action-prompt',
      { handle: 1 },
      expect.any(Function),
    );
  });
});
