import { promptText } from './prompts/ai-prompt-context';
import { EntityManager } from '@mikro-orm/core';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AiAgentItem } from '../../entity/AiAgentItem';
import { PersonItem } from '../../entity/PersonItem';
import type { McpToolPolicy } from './mcp-policy.types';
import { sanitizeAgent } from './ai-response.utils';

@Injectable()
export class AiAgentPolicyService {
  constructor(private readonly em: EntityManager) {}

  async listAccessibleAgents(user: PersonItem): Promise<AiAgentItem[]> {
    const userRoleHandles = await this.getUserRoleHandles(user);
    const isAdministrator = this.isAdministrator(user);
    const agents = await this.em.find(
      AiAgentItem,
      { isActive: true },
      {
        populate: [
          'roles',
          'provider',
          'model',
          'model.provider',
          'webSearchProvider',
          'webSearchModel',
          'webSearchModel.provider',
          'playbooks',
        ],
        orderBy: { sortOrder: 'ASC', title: 'ASC' },
      },
    );

    return agents
      .filter(
        (agent) =>
          isAdministrator || this.isAgentVisibleToRoles(agent, userRoleHandles),
      )
      .map((agent) => sanitizeAgent(agent));
  }

  async resolveAgentForChat(
    requestedAgentHandle: string | null | undefined,
    fallbackAgent: AiAgentItem | string | null | undefined,
    user: PersonItem,
  ): Promise<AiAgentItem | null> {
    const fallbackHandle =
      typeof fallbackAgent === 'string'
        ? fallbackAgent
        : (fallbackAgent?.handle ?? null);
    const agentHandle = requestedAgentHandle ?? fallbackHandle;

    if (agentHandle) {
      return this.requireAccessibleAgent(agentHandle, user);
    }

    const agents = await this.listAccessibleAgents(user);
    const defaultAgent =
      agents.find((agent) => agent.isDefault) ?? agents[0] ?? null;

    return defaultAgent
      ? this.requireAccessibleAgent(defaultAgent.handle, user)
      : null;
  }

  async requireAccessibleAgent(
    agentHandle: string,
    user: PersonItem,
  ): Promise<AiAgentItem> {
    const userRoleHandles = await this.getUserRoleHandles(user);
    const isAdministrator = this.isAdministrator(user);
    const agent = await this.em.findOne(
      AiAgentItem,
      { handle: agentHandle, isActive: true },
      {
        populate: [
          'roles',
          'provider',
          'model',
          'model.provider',
          'webSearchProvider',
          'webSearchModel',
          'webSearchModel.provider',
          'playbooks',
        ],
      },
    );

    if (!agent) {
      throw new NotFoundException('ai.agentNotFound');
    }

    if (
      !isAdministrator &&
      !this.isAgentVisibleToRoles(agent, userRoleHandles)
    ) {
      throw new ForbiddenException('global.permissionDenied');
    }

    return agent;
  }

  buildToolPolicy(
    agent: AiAgentItem | null | undefined,
  ): McpToolPolicy | undefined {
    if (!agent) {
      return undefined;
    }

    const webSearchProviderHandle =
      typeof agent.webSearchProvider === 'string'
        ? agent.webSearchProvider
        : (agent.webSearchProvider?.handle ?? null);
    const webSearchModelHandle =
      typeof agent.webSearchModel === 'string'
        ? agent.webSearchModel
        : (agent.webSearchModel?.handle ?? null);

    return {
      allowedEntityHandles: this.normalizeStringArray(
        agent.allowedEntityHandles,
      ),
      allowedKnowledgeEntityHandles: this.normalizeStringArray(
        agent.allowedKnowledgeEntityHandles,
      ),
      allowedInternalTools: this.normalizeStringArray(
        agent.allowedInternalTools,
      ),
      allowedExternalTools: this.normalizeStringArray(
        agent.allowedExternalTools,
      ),
      blockMutatingTools: true,
      ...(webSearchProviderHandle ? { webSearchProviderHandle } : {}),
      ...(webSearchModelHandle ? { webSearchModelHandle } : {}),
    };
  }

  buildAgentInstruction(agent: AiAgentItem | null | undefined): string | null {
    if (!agent) {
      return null;
    }

    const lines = [
      promptText('agent-policy.fragment1', { value0: agent.title }),
      agent.description?.trim()
        ? promptText('agent-policy.fragment2', {
            value0: agent.description.trim(),
          })
        : null,
      agent.promptMarkdown?.trim() ?? null,
      this.buildScopeInstruction(agent),
      agent.mutationMode === 'readOnly'
        ? promptText('agent-policy.fragment3')
        : promptText('agent-policy.text1'),
    ].filter((line): line is string => !!line);

    return lines.join('\n\n');
  }

  isMutatingTool(toolName: string): boolean {
    return [
      'generic_create',
      'generic_update',
      'generic_delete',
      'import_configure_batch',
      'import_execute_batch',
    ].includes(toolName);
  }

  private buildScopeInstruction(agent: AiAgentItem): string | null {
    const entityHandles = this.normalizeStringArray(agent.allowedEntityHandles);
    const knowledgeHandles = this.normalizeStringArray(
      agent.allowedKnowledgeEntityHandles,
    );

    if (entityHandles.length === 0 && knowledgeHandles.length === 0) {
      return null;
    }

    return [
      entityHandles.length > 0
        ? promptText('agent-policy.fragment4', {
            value0: entityHandles.join(', '),
          })
        : null,
      knowledgeHandles.length > 0
        ? promptText('agent-policy.fragment5', {
            value0: knowledgeHandles.join(', '),
          })
        : null,
    ]
      .filter((line): line is string => !!line)
      .join(' ');
  }

  private async getUserRoleHandles(user: PersonItem): Promise<Set<number>> {
    if (user.handle == null) {
      throw new NotFoundException('auth.userNotFound');
    }

    const person = await this.em.findOne(
      PersonItem,
      { handle: user.handle },
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

  private isAgentVisibleToRoles(
    agent: AiAgentItem,
    userRoleHandles: Set<number>,
  ): boolean {
    const agentRoles = agent.roles.getItems();

    if (agentRoles.length === 0) {
      return true;
    }

    return agentRoles.some(
      (role) => role.handle != null && userRoleHandles.has(role.handle),
    );
  }

  private isAdministrator(user: PersonItem): boolean {
    const rolesSource = user.roles as
      | Array<{ isAdministrator?: boolean }>
      | { getItems?: () => Array<{ isAdministrator?: boolean }> }
      | undefined;
    const roles = Array.isArray(rolesSource)
      ? rolesSource
      : (rolesSource?.getItems?.() ?? []);

    return roles.some((role) => role.isAdministrator === true);
  }

  private normalizeStringArray(value: unknown): string[] {
    const entries = this.readStringArrayEntries(value);

    return entries
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private readStringArrayEntries(value: unknown): unknown[] {
    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value !== 'string' || !value.trim()) {
      return [];
    }

    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return value.split(/[;,]/);
    }
  }
}
