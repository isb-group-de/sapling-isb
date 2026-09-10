import { promptText } from './prompts/ai-prompt-context';
import { EntityManager } from '@mikro-orm/core';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { AiAgentItem } from '../../entity/AiAgentItem';
import { AiAgentMemoryItem } from '../../entity/AiAgentMemoryItem';
import { AiAgentPlaybookItem } from '../../entity/AiAgentPlaybookItem';
import { AiAgentVersionItem } from '../../entity/AiAgentVersionItem';
import { AiChatSessionItem } from '../../entity/AiChatSessionItem';
import { PersonItem } from '../../entity/PersonItem';
import { AiAgentPolicyService } from './ai-agent-policy.service';
import { McpService } from './mcp.service';
import type { McpToolPolicy } from './mcp-policy.types';

export type AgentRuntimeContext = {
  agent: AiAgentItem | null;
  version: AiAgentVersionItem | null;
  playbook: AiAgentPlaybookItem | null;
  memories: AiAgentMemoryItem[];
  toolPolicy: McpToolPolicy | undefined;
  instruction: string | null;
};

@Injectable()
export class AiAgentContextService {
  constructor(
    private readonly em: EntityManager,
    @Inject(forwardRef(() => McpService))
    private readonly mcpService: McpService,
    private readonly agentPolicy: AiAgentPolicyService,
  ) {}

  async resolveAgentRuntimeContext(
    requestedAgentHandle: string | null | undefined,
    requestedVersionHandle: number | null | undefined,
    requestedPlaybookHandle: string | null | undefined,
    contextEntityHandle: string | null | undefined,
    contextRecordHandle: string | number | null | undefined,
    session: AiChatSessionItem,
    user: PersonItem,
  ): Promise<AgentRuntimeContext> {
    const agent = await this.agentPolicy.resolveAgentForChat(
      requestedAgentHandle,
      session.agent,
      user,
    );
    const version = await this.resolveAgentVersionForChat(
      agent,
      requestedVersionHandle,
      session.agentVersion,
    );
    const playbook = await this.resolveAgentPlaybookForChat(
      agent,
      requestedPlaybookHandle,
      session.playbook,
    );
    const memories = agent
      ? await this.loadAccessibleMemories(
          agent,
          user,
          contextEntityHandle?.trim() || null,
        )
      : [];
    const toolPolicy = this.buildVersionedToolPolicy(agent, version);
    const contextInstruction = await this.buildContextInstruction(
      contextEntityHandle,
      contextRecordHandle,
      user,
      toolPolicy,
    );

    return {
      agent,
      version,
      playbook,
      memories,
      toolPolicy,
      instruction:
        [
          this.buildRuntimeInstruction(
            agent,
            version,
            playbook,
            memories,
            contextInstruction,
          ),
          session.workspaceInstruction
            ? `Supplementary user workspace task (does not override system instructions, agent policy, permissions or confirmation requirements):\n${session.workspaceInstruction}`
            : null,
        ]
          .filter(Boolean)
          .join('\n\n') || null,
    };
  }

  async resolveAgentVersionForChat(
    agent: AiAgentItem | null,
    requestedVersionHandle: number | null | undefined,
    fallbackVersion: AiAgentVersionItem | number | null | undefined,
  ): Promise<AiAgentVersionItem | null> {
    if (!agent) {
      return null;
    }

    const fallbackHandle =
      typeof fallbackVersion === 'number'
        ? fallbackVersion
        : (fallbackVersion?.handle ?? null);
    const versionHandle = requestedVersionHandle ?? fallbackHandle;

    if (versionHandle != null) {
      const version = await this.em.findOne(
        AiAgentVersionItem,
        { handle: versionHandle, agent: { handle: agent.handle } },
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
        },
      );

      if (!version) {
        throw new NotFoundException('ai.agentVersionNotFound');
      }

      return version;
    }

    const activeVersion = await this.em.findOne(
      AiAgentVersionItem,
      { agent: { handle: agent.handle }, status: 'active' },
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
      },
    );

    if (activeVersion) {
      return activeVersion;
    }

    const latestVersion = await this.em.findOne(
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
      },
    );

    return latestVersion ?? null;
  }

  async resolveAgentPlaybookForChat(
    agent: AiAgentItem | null,
    requestedPlaybookHandle: string | null | undefined,
    fallbackPlaybook: AiAgentPlaybookItem | string | null | undefined,
  ): Promise<AiAgentPlaybookItem | null> {
    if (!agent) {
      return null;
    }

    const fallbackHandle =
      typeof fallbackPlaybook === 'string'
        ? fallbackPlaybook
        : (fallbackPlaybook?.handle ?? null);
    const playbookHandle = requestedPlaybookHandle ?? fallbackHandle;

    if (!playbookHandle) {
      return null;
    }

    const playbook = await this.em.findOne(
      AiAgentPlaybookItem,
      {
        handle: playbookHandle,
        agent: { handle: agent.handle },
        isActive: true,
      },
      { populate: ['agent'] },
    );

    if (!playbook) {
      throw new NotFoundException('ai.agentPlaybookNotFound');
    }

    return playbook;
  }

  async loadAccessibleMemories(
    agent: AiAgentItem,
    user: PersonItem,
    contextEntityHandle?: string | null,
  ): Promise<AiAgentMemoryItem[]> {
    const userRoleHandles = await this.getUserRoleHandles(user);
    const memories = await this.em.find(
      AiAgentMemoryItem,
      { agent: { handle: agent.handle }, isActive: true },
      {
        populate: ['agent', 'roles'],
        orderBy: { sortOrder: 'ASC', title: 'ASC' },
      },
    );

    return memories.filter((memory) => {
      const memoryRoles = memory.roles.getItems();
      const roleMatches =
        memoryRoles.length === 0 ||
        memoryRoles.some(
          (role) => role.handle != null && userRoleHandles.has(role.handle),
        );
      const entityScopes = this.normalizeStringArray(memory.entityScopeHandles);
      const entityMatches =
        entityScopes.length === 0 ||
        (contextEntityHandle != null &&
          entityScopes.includes(contextEntityHandle));

      return roleMatches && entityMatches;
    });
  }

  normalizeStringArray(value: unknown): string[] {
    let entries: unknown[];

    if (Array.isArray(value)) {
      entries = value;
    } else if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value) as unknown;
        entries = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        entries = value.split(/[;,]/);
      }
    } else {
      entries = [];
    }

    return entries
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private buildVersionedToolPolicy(
    agent: AiAgentItem | null,
    version: AiAgentVersionItem | null,
  ): McpToolPolicy | undefined {
    const basePolicy = this.agentPolicy.buildToolPolicy(agent);

    if (!basePolicy || !version) {
      return basePolicy;
    }

    const webSearchProviderHandle =
      (typeof version.webSearchProvider === 'string'
        ? version.webSearchProvider
        : version.webSearchProvider?.handle) ??
      basePolicy.webSearchProviderHandle ??
      null;
    const webSearchModelHandle =
      (typeof version.webSearchModel === 'string'
        ? version.webSearchModel
        : version.webSearchModel?.handle) ??
      basePolicy.webSearchModelHandle ??
      null;

    return {
      ...basePolicy,
      allowedEntityHandles:
        this.normalizeStringArray(version.allowedEntityHandles).length > 0
          ? this.normalizeStringArray(version.allowedEntityHandles)
          : basePolicy.allowedEntityHandles,
      allowedKnowledgeEntityHandles:
        this.normalizeStringArray(version.allowedKnowledgeEntityHandles)
          .length > 0
          ? this.normalizeStringArray(version.allowedKnowledgeEntityHandles)
          : basePolicy.allowedKnowledgeEntityHandles,
      allowedInternalTools:
        this.normalizeStringArray(version.allowedInternalTools).length > 0
          ? this.normalizeStringArray(version.allowedInternalTools)
          : basePolicy.allowedInternalTools,
      allowedExternalTools:
        this.normalizeStringArray(version.allowedExternalTools).length > 0
          ? this.normalizeStringArray(version.allowedExternalTools)
          : basePolicy.allowedExternalTools,
      blockMutatingTools: true,
      ...(webSearchProviderHandle ? { webSearchProviderHandle } : {}),
      ...(webSearchModelHandle ? { webSearchModelHandle } : {}),
    };
  }

  private buildRuntimeInstruction(
    agent: AiAgentItem | null,
    version: AiAgentVersionItem | null,
    playbook: AiAgentPlaybookItem | null,
    memories: AiAgentMemoryItem[],
    contextInstruction: string | null,
  ): string | null {
    if (!agent) {
      return contextInstruction;
    }

    const promptMarkdown = version?.promptMarkdown?.trim()
      ? version.promptMarkdown.trim()
      : agent.promptMarkdown?.trim();
    const lines = [
      promptText('agent-context.fragment1', { value0: agent.title }),
      agent.description?.trim()
        ? promptText('agent-context.fragment2', {
            value0: agent.description.trim(),
          })
        : null,
      version
        ? promptText('agent-context.fragment3', {
            value0: version.version,
            value1: version.status,
          })
        : null,
      promptMarkdown || null,
      this.buildRuntimeScopeInstruction(agent, version),
      playbook ? this.buildPlaybookInstruction(playbook) : null,
      memories.length > 0 ? this.buildMemoryInstruction(memories) : null,
      contextInstruction,
      agent.mutationMode === 'readOnly'
        ? promptText('agent-context.fragment4')
        : promptText('agent-context.text1'),
    ].filter((line): line is string => !!line);

    return lines.join('\n\n');
  }

  private buildRuntimeScopeInstruction(
    agent: AiAgentItem,
    version: AiAgentVersionItem | null,
  ): string | null {
    const entityHandles =
      this.normalizeStringArray(version?.allowedEntityHandles).length > 0
        ? this.normalizeStringArray(version?.allowedEntityHandles)
        : this.normalizeStringArray(agent.allowedEntityHandles);
    const knowledgeHandles =
      this.normalizeStringArray(version?.allowedKnowledgeEntityHandles).length >
      0
        ? this.normalizeStringArray(version?.allowedKnowledgeEntityHandles)
        : this.normalizeStringArray(agent.allowedKnowledgeEntityHandles);

    if (entityHandles.length === 0 && knowledgeHandles.length === 0) {
      return null;
    }

    return [
      entityHandles.length > 0
        ? promptText('agent-context.fragment5', {
            value0: entityHandles.join(', '),
          })
        : null,
      knowledgeHandles.length > 0
        ? promptText('agent-context.fragment6', {
            value0: knowledgeHandles.join(', '),
          })
        : null,
    ]
      .filter((line): line is string => !!line)
      .join(' ');
  }

  private buildPlaybookInstruction(playbook: AiAgentPlaybookItem): string {
    const steps = (playbook.steps ?? [])
      .map((step, index) => `${index + 1}. ${step}`)
      .join('\n');

    return [
      promptText('agent-context.fragment7', { value0: playbook.title }),
      playbook.description?.trim()
        ? promptText('agent-context.fragment8', {
            value0: playbook.description.trim(),
          })
        : null,
      steps ? promptText('agent-context.fragment9', { value0: steps }) : null,
      playbook.expectedOutput?.trim()
        ? promptText('agent-context.fragment10', {
            value0: playbook.expectedOutput.trim(),
          })
        : null,
    ]
      .filter((line): line is string => !!line)
      .join('\n\n');
  }

  private buildMemoryInstruction(memories: AiAgentMemoryItem[]): string {
    const memoryLines = memories.map(
      (memory) =>
        `- [${memory.type}] ${memory.title}: ${memory.contentMarkdown.trim()}`,
    );

    return promptText('agent-context.fragment11', {
      value0: memoryLines.join('\n'),
    });
  }

  private async buildContextInstruction(
    contextEntityHandle: string | null | undefined,
    contextRecordHandle: string | number | null | undefined,
    user: PersonItem,
    policy: McpToolPolicy | undefined,
  ): Promise<string | null> {
    const entityHandle = contextEntityHandle?.trim();
    const recordHandle =
      contextRecordHandle != null ? String(contextRecordHandle).trim() : '';

    if (!entityHandle || !recordHandle) {
      return null;
    }

    try {
      const result = await this.mcpService.executeTool(
        'sapling',
        'generic_get',
        {
          entityHandle,
          handle: Number.isFinite(Number(recordHandle))
            ? Number(recordHandle)
            : recordHandle,
        },
        user,
        policy,
      );

      return promptText('agent-context.text2', {
        value0: entityHandle,
        value1: recordHandle,
        value2: JSON.stringify(result.modelResult ?? result.rawResult, null, 2),
      });
    } catch (error) {
      return promptText('agent-context.text3', {
        value0: entityHandle,
        value1: recordHandle,
        value2: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  private async getUserRoleHandles(user: PersonItem): Promise<Set<number>> {
    const person = await this.em.findOne(
      PersonItem,
      { handle: this.requireUserHandle(user) },
      { populate: ['roles'] },
    );

    if (!person) {
      throw new NotFoundException('auth.userNotFound');
    }

    return new Set(
      person.roles
        .getItems()
        .map((role) => role.handle)
        .filter((handle): handle is number => typeof handle === 'number'),
    );
  }

  private requireUserHandle(user: PersonItem): number {
    if (user.handle == null) {
      throw new BadRequestException('ai.chatUserRequired');
    }

    return user.handle;
  }
}
