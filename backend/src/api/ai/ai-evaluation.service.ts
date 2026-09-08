import { EntityManager } from '@mikro-orm/core';
import { createHash } from 'crypto';
import { Injectable, BadRequestException } from '@nestjs/common';
import { AiAgentEvaluationItem } from '../../entity/AiAgentEvaluationItem';
import { AiAgentRunItem } from '../../entity/AiAgentRunItem';
import { AiChatMessageItem } from '../../entity/AiChatMessageItem';
import { AiChatSessionItem } from '../../entity/AiChatSessionItem';
import { PersonItem } from '../../entity/PersonItem';
import { AiAgentContextService } from './ai-agent-context.service';
import {
  AiChatRuntimeService,
  type AiRuntimeToolExecutor,
} from './ai-chat-runtime.service';
import { AiProviderRegistryService } from './ai-provider-registry.service';
import { McpService } from './mcp.service';
import { AiPromptService } from './prompts/ai-prompt.service';
import {
  aiPromptContext,
  type AiPromptManifest,
} from './prompts/ai-prompt-context';
import { buildSystemInstruction } from './prompts/ai.prompts';
import {
  extractModelHandle,
  extractProviderHandle,
  sanitizeAgentRun,
} from './ai-response.utils';
import {
  evaluateAgentResult,
  validateExpectations,
} from './ai-evaluation.utils';

@Injectable()
export class AiEvaluationService {
  constructor(
    private readonly em: EntityManager,
    private readonly context: AiAgentContextService,
    private readonly runtime: AiChatRuntimeService,
    private readonly providers: AiProviderRegistryService,
    private readonly mcp: McpService,
    private readonly prompts: AiPromptService,
  ) {}

  async preview(agent: string, user: PersonItem, playbook?: string) {
    return this.prompts.run(async () => {
      const context = await this.context.resolveAgentRuntimeContext(
        agent,
        null,
        playbook,
        null,
        null,
        new AiChatSessionItem(),
        user,
      );
      return {
        content: buildSystemInstruction({
          includeToolGuidance: true,
          user,
          agentInstruction: context.instruction,
        }),
        manifest: aiPromptContext.getStore()!.manifest,
      };
    });
  }

  async run(
    agent: string,
    handles: number[],
    user: PersonItem,
    manifest?: AiPromptManifest,
  ) {
    if (
      handles.length < 1 ||
      handles.length > 20 ||
      new Set(handles).size !== handles.length
    )
      throw new BadRequestException('ai.evaluationSelectionInvalid');
    const cases = await this.em.find(
      AiAgentEvaluationItem,
      { handle: { $in: handles }, agent: { handle: agent } },
      { populate: ['agent', 'agentVersion'], orderBy: { handle: 'ASC' } },
    );
    if (cases.length !== handles.length)
      throw new BadRequestException('ai.evaluationNotFound');
    return this.prompts.run(async () => {
      const results: AiAgentRunItem[] = [];
      for (const test of cases) {
        const expected = validateExpectations(test.expectations ?? {});
        const context = await this.context.resolveAgentRuntimeContext(
          agent,
          test.agentVersion?.handle,
          null,
          test.targetEntityHandle,
          null,
          new AiChatSessionItem(),
          user,
        );
        const target = await this.providers.resolveRuntimeTarget(
          extractProviderHandle(context.version?.provider) ??
            extractProviderHandle(context.agent?.provider),
          extractModelHandle(context.version?.model) ??
            extractModelHandle(context.agent?.model),
        );
        const tools = await this.mcp.listActiveTools(user, context.toolPolicy);
        const startedAt = new Date();
        const run = this.em.create(AiAgentRunItem, {
          agent: context.agent,
          agentVersion: context.version,
          person: user.handle,
          status: 'running',
          provider: target.provider.handle,
          model: target.model.providerModel,
          startedAt,
          promptManifest: aiPromptContext.getStore()!.manifest,
          evaluationResult: {
            evaluationHandle: test.handle,
            title: test.title,
            expectations: expected,
            testChecksum: createHash('sha256')
              .update(
                JSON.stringify({
                  prompt: test.prompt,
                  expectations: expected,
                  fixtures: test.toolFixtures,
                  criteria: test.expectedCriteria,
                }),
              )
              .digest('hex'),
          },
        } as never);
        this.em.persist(run);
        await this.em.flush();
        let text = '';
        const fixtureFailures: string[] = [];
        const attempted: {
          toolName: string;
          arguments: Record<string, unknown>;
        }[] = [];
        // No call to McpService.executeTool: even unknown/external/mutating tools stay isolated.
        const executor: AiRuntimeToolExecutor = (entry, args) => {
          const { toolName, serverName } = entry.descriptor;
          attempted.push({ toolName, arguments: args });
          const key = Object.hasOwn(
            test.toolFixtures ?? {},
            `${serverName}.${toolName}`,
          )
            ? `${serverName}.${toolName}`
            : toolName;
          if (!Object.hasOwn(test.toolFixtures ?? {}, key)) {
            fixtureFailures.push(`${serverName}.${toolName}`);
            throw new Error(
              `ai.evaluationFixtureMissing:${serverName}.${toolName}`,
            );
          }
          const result = test.toolFixtures![key];
          return Promise.resolve({
            serverHandle: entry.descriptor.serverHandle,
            serverName,
            toolName,
            arguments: args,
            content: JSON.stringify(result),
            rawResult: result,
            modelResult: result,
          });
        };
        try {
          const history = [
            { role: 'user', content: test.prompt },
          ] as AiChatMessageItem[];
          const method: typeof this.runtime.streamOpenAi = (...args) =>
            target.providerKind === 'gemini'
              ? this.runtime.streamGemini(...args)
              : this.runtime.streamOpenAi(...args);
          const result = await method(
            history,
            target.provider,
            target.model.providerModel,
            tools,
            user,
            10,
            undefined,
            {
              onTextDelta: (delta) => {
                text += delta;
                return Promise.resolve();
              },
              signal: AbortSignal.timeout(120_000),
            },
            target.model.supportsTools,
            context.instruction,
            executor,
          );
          const verdict = evaluateAgentResult(expected, text, attempted);
          verdict.failures.push(
            ...fixtureFailures.map((key) => `missingFixture:${key}`),
          );
          verdict.passed = verdict.failures.length === 0;
          run.status = 'completed';
          run.evaluationResult = {
            ...run.evaluationResult,
            ...verdict,
            manualReviewRequired: Boolean(test.expectedCriteria),
            criteria: test.expectedCriteria ?? null,
          };
          run.toolCalls = result.toolCalls;
          run.usagePayload = result.usagePayload;
        } catch (error) {
          run.status = 'failed';
          run.errorPayload = {
            message:
              error instanceof Error ? error.message : 'ai.evaluationFailed',
          };
          run.evaluationResult = {
            ...run.evaluationResult,
            ...evaluateAgentResult(expected, text, attempted),
            passed: false,
          };
          run.toolCalls = attempted;
        }
        run.responseText = text;
        run.completedAt = new Date();
        run.durationMs = run.completedAt.getTime() - startedAt.getTime();
        await this.em.flush();
        results.push(sanitizeAgentRun(run));
      }
      return results;
    }, manifest);
  }
}
