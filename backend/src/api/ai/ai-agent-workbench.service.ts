import { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { AiAgentEvaluationItem } from '../../entity/AiAgentEvaluationItem';
import { AiAgentPlaybookItem } from '../../entity/AiAgentPlaybookItem';
import { AiAgentRunItem } from '../../entity/AiAgentRunItem';
import { AiAgentVersionItem } from '../../entity/AiAgentVersionItem';
import { PersonItem } from '../../entity/PersonItem';
import { AiAgentContextService } from './ai-agent-context.service';
import { AiAgentPolicyService } from './ai-agent-policy.service';
import {
  sanitizeAgent,
  sanitizeAgentEvaluation,
  sanitizeAgentMemory,
  sanitizeAgentPlaybook,
  sanitizeAgentRun,
  sanitizeAgentVersion,
} from './ai-response.utils';
import { CreateAiAgentEvaluationDto } from './dto/chat.dto';

@Injectable()
export class AiAgentWorkbenchService {
  constructor(
    private readonly em: EntityManager,
    private readonly agentPolicy: AiAgentPolicyService,
    private readonly agentContext: AiAgentContextService,
  ) {}

  async getAgentWorkbench(
    agentHandle: string,
    user: PersonItem,
  ): Promise<Record<string, unknown>> {
    const agent = await this.agentPolicy.requireAccessibleAgent(
      agentHandle,
      user,
    );
    const [versions, playbooks, memories, runs, evaluations] =
      await Promise.all([
        this.em.find(
          AiAgentVersionItem,
          { agent: { handle: agent.handle } },
          {
            populate: [
              'agent',
              'provider',
              'model',
              'model.provider',
              'webSearchProvider',
              'webSearchModel',
              'webSearchModel.provider',
            ],
            orderBy: { version: 'DESC' },
            limit: 20,
          },
        ),
        this.em.find(
          AiAgentPlaybookItem,
          { agent: { handle: agent.handle } },
          { populate: ['agent'], orderBy: { sortOrder: 'ASC', title: 'ASC' } },
        ),
        this.agentContext.loadAccessibleMemories(agent, user),
        this.em.find(
          AiAgentRunItem,
          { agent: { handle: agent.handle } },
          {
            populate: ['agent', 'agentVersion', 'playbook', 'person'],
            orderBy: { startedAt: 'DESC' },
            limit: 25,
          },
        ),
        this.em.find(
          AiAgentEvaluationItem,
          { agent: { handle: agent.handle } },
          {
            populate: ['agent', 'agentVersion'],
            orderBy: { updatedAt: 'DESC' },
            limit: 50,
          },
        ),
      ]);

    return {
      agent: sanitizeAgent(agent),
      versions: versions.map((version) => sanitizeAgentVersion(version)),
      playbooks: playbooks.map((playbook) => sanitizeAgentPlaybook(playbook)),
      memories: memories.map((memory) => sanitizeAgentMemory(memory)),
      runs: runs.map((run) => sanitizeAgentRun(run)),
      evaluations: evaluations.map((evaluation) =>
        sanitizeAgentEvaluation(evaluation),
      ),
      stats: this.buildAgentWorkbenchStats(runs, evaluations),
    };
  }

  async listAgentRuns(
    agentHandle: string,
    user: PersonItem,
  ): Promise<AiAgentRunItem[]> {
    const agent = await this.agentPolicy.requireAccessibleAgent(
      agentHandle,
      user,
    );
    const runs = await this.em.find(
      AiAgentRunItem,
      { agent: { handle: agent.handle } },
      {
        populate: ['agent', 'agentVersion', 'playbook', 'person'],
        orderBy: { startedAt: 'DESC' },
        limit: 100,
      },
    );

    return runs.map((run) => sanitizeAgentRun(run));
  }

  async listAgentEvaluations(
    agentHandle: string,
    user: PersonItem,
  ): Promise<AiAgentEvaluationItem[]> {
    const agent = await this.agentPolicy.requireAccessibleAgent(
      agentHandle,
      user,
    );
    const evaluations = await this.em.find(
      AiAgentEvaluationItem,
      { agent: { handle: agent.handle } },
      {
        populate: ['agent', 'agentVersion'],
        orderBy: { updatedAt: 'DESC' },
      },
    );

    return evaluations.map((evaluation) => sanitizeAgentEvaluation(evaluation));
  }

  async createAgentEvaluation(
    agentHandle: string,
    dto: CreateAiAgentEvaluationDto,
    user: PersonItem,
  ): Promise<AiAgentEvaluationItem> {
    const agent = await this.agentPolicy.requireAccessibleAgent(
      agentHandle,
      user,
    );
    const version = await this.agentContext.resolveAgentVersionForChat(
      agent,
      dto.agentVersionHandle,
      null,
    );
    const evaluation = this.em.create(AiAgentEvaluationItem, {
      agent,
      agentVersion: version,
      title: dto.title.trim(),
      prompt: dto.prompt.trim(),
      expectedCriteria: dto.expectedCriteria?.trim() || null,
      targetEntityHandle: dto.targetEntityHandle?.trim() || null,
      targetRecordHandle: dto.targetRecordHandle?.trim() || null,
      status: 'needsReview',
    });

    this.em.persist(evaluation);
    await this.em.flush();
    return sanitizeAgentEvaluation(evaluation);
  }

  private buildAgentWorkbenchStats(
    runs: AiAgentRunItem[],
    evaluations: AiAgentEvaluationItem[],
  ): Record<string, unknown> {
    const evaluationTotal = evaluations.length;
    const evaluationPassed = evaluations.filter(
      (evaluation) => evaluation.status === 'passed',
    ).length;

    return {
      runsTotal: runs.length,
      failedRuns: runs.filter((run) => run.status === 'failed').length,
      pendingActions: runs.reduce(
        (total, run) => total + (run.pendingActions?.length ?? 0),
        0,
      ),
      evaluationTotal,
      evaluationPassed,
      evaluationPassRate:
        evaluationTotal > 0
          ? Math.round((evaluationPassed / evaluationTotal) * 100)
          : null,
    };
  }
}
