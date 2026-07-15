import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { PersonItem } from '../../entity/PersonItem';
import { GenericService } from '../generic/generic.service';
import { AiService } from './ai.service';
import type { McpToolPolicy } from './mcp-policy.types';
import { SaplingMcpPermissionService } from './sapling-mcp-permission.service';
import { SaplingMcpValueService } from './sapling-mcp-value.service';
import { SAPLING_MCP_USAGE_HINTS } from './prompts/sapling-mcp.prompts';
@Injectable()
export class SaplingMcpSearchToolService {
  private readonly defaultKnowledgeSearchEntityHandles = [
    'knowledgeArticle',
    'ticket',
    'effortEstimate',
    'effortEstimatePosition',
    'salesOpportunity',
  ];

  constructor(
    private readonly genericService: GenericService,
    @Inject(forwardRef(() => AiService))
    private readonly aiService: AiService,
    private readonly permissionService: SaplingMcpPermissionService,
    private readonly values: SaplingMcpValueService,
  ) {}
  async executeTicketSearch(
    args: Record<string, unknown>,
    user: PersonItem,
    policy?: McpToolPolicy,
  ): Promise<unknown> {
    this.values.assertEntityAllowed('ticket', policy);
    await this.permissionService.assertEntityPermission(
      user,
      'ticket',
      'allowRead',
    );
    const query = this.values.requireStringArg(args.query, 'query');
    const searchMode = this.values.asTicketSearchMode(args.searchMode);
    const limit = Math.min(this.values.asPositiveNumber(args.limit) ?? 10, 50);
    const searchFields = this.getTicketSearchFields(searchMode);
    const filter = {
      $or: searchFields.map((field) => ({
        [field]: { $ilike: `%${query}%` },
      })),
    };

    const result = await this.genericService.findAndCount(
      'ticket',
      filter,
      1,
      limit,
      {},
      user,
      [],
    );

    return {
      entityHandle: 'ticket',
      query,
      searchMode,
      searchFields,
      appliedFilter: filter,
      ...result,
      usageHints: [...SAPLING_MCP_USAGE_HINTS.ticketSearch],
    };
  }

  async executeSemanticSearch(
    args: Record<string, unknown>,
    user: PersonItem,
    policy?: McpToolPolicy,
  ): Promise<unknown> {
    const entityHandle = this.values.requireStringArg(
      args.entityHandle,
      'entityHandle',
    );
    this.values.assertEntityAllowed(entityHandle, policy);
    await this.permissionService.assertEntityPermission(
      user,
      entityHandle,
      'allowRead',
    );
    const query = this.values.requireStringArg(args.query, 'query');
    const limit = Math.min(this.values.asPositiveNumber(args.limit) ?? 5, 20);
    const result = await this.aiService.searchVectorDocuments(
      entityHandle,
      query,
      user,
      limit,
    );

    return {
      ...result,
      usageHints: [...SAPLING_MCP_USAGE_HINTS.semanticSearch],
    };
  }

  async executeKnowledgeSearch(
    args: Record<string, unknown>,
    user: PersonItem,
    policy?: McpToolPolicy,
  ): Promise<unknown> {
    const query = this.values.requireStringArg(args.query, 'query');
    const limit = Math.min(this.values.asPositiveNumber(args.limit) ?? 8, 30);
    const requestedEntityHandles = this.values.asStringArray(
      args.entityHandles,
    );
    const entityHandles = this.normalizeKnowledgeSearchEntityHandles(
      requestedEntityHandles,
      policy,
    );
    const perEntityLimit = Math.min(Math.max(limit, 5), 20);
    const skippedEntityHandles: string[] = [];
    const unindexedEntityHandles: string[] = [];
    const indexedEntityHandles: string[] = [];
    const sourceResults: unknown[] = [];
    const errors: Array<{ entityHandle: string; error: string }> = [];
    const combinedResults: Array<{
      entityHandle: string;
      handle: string | number | null;
      score: number;
      record: unknown;
      matches: unknown[];
    }> = [];

    for (const entityHandle of entityHandles) {
      try {
        await this.permissionService.assertEntityPermission(
          user,
          entityHandle,
          'allowRead',
        );
      } catch {
        skippedEntityHandles.push(entityHandle);
        continue;
      }

      try {
        const result = await this.aiService.searchVectorDocuments(
          entityHandle,
          query,
          user,
          perEntityLimit,
        );
        const resultRecord = this.values.asRecord(result);
        sourceResults.push(result);

        if (resultRecord.indexed === false) {
          unindexedEntityHandles.push(entityHandle);
          continue;
        }

        indexedEntityHandles.push(entityHandle);
        const results = Array.isArray(resultRecord.results)
          ? resultRecord.results
          : [];

        for (const item of results) {
          const itemRecord = this.values.asRecord(item);

          if (!itemRecord) {
            continue;
          }

          combinedResults.push({
            entityHandle,
            handle: this.values.asResultHandle(itemRecord.handle),
            score: this.values.asScore(itemRecord.score),
            record: itemRecord.record ?? null,
            matches: Array.isArray(itemRecord.matches)
              ? itemRecord.matches
              : [],
          });
        }
      } catch (error) {
        errors.push({
          entityHandle,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      query,
      entityHandles,
      indexedEntityHandles,
      unindexedEntityHandles,
      skippedEntityHandles,
      results: combinedResults
        .sort(
          (left, right) =>
            right.score - left.score ||
            left.entityHandle.localeCompare(right.entityHandle),
        )
        .slice(0, limit),
      sourceResults,
      errors,
      usageHints: [...SAPLING_MCP_USAGE_HINTS.knowledgeSearch],
    };
  }

  private normalizeKnowledgeSearchEntityHandles(
    requestedEntityHandles: string[],
    policy?: McpToolPolicy,
  ): string[] {
    const requested = requestedEntityHandles
      .map((handle) => handle.trim())
      .filter(Boolean);
    const candidates =
      requested.length > 0
        ? requested
        : this.defaultKnowledgeSearchEntityHandles;
    const defaultAllowed = new Set(this.defaultKnowledgeSearchEntityHandles);
    const policyKnowledgeHandles = this.values.normalizeStringList(
      policy?.allowedKnowledgeEntityHandles,
    );
    const policyEntityHandles = this.values.normalizeStringList(
      policy?.allowedEntityHandles,
    );
    const policyAllowedHandles =
      policyKnowledgeHandles.length > 0
        ? new Set(policyKnowledgeHandles)
        : policyEntityHandles.length > 0
          ? new Set(policyEntityHandles)
          : null;
    const normalized: string[] = [];

    for (const entityHandle of candidates) {
      const normalizedEntityHandle = entityHandle.toLowerCase();
      if (
        !defaultAllowed.has(entityHandle) ||
        (policyAllowedHandles &&
          !policyAllowedHandles.has(normalizedEntityHandle)) ||
        normalized.includes(entityHandle)
      ) {
        continue;
      }

      normalized.push(entityHandle);
    }

    return normalized.length > 0
      ? normalized
      : [...this.defaultKnowledgeSearchEntityHandles];
  }

  private getTicketSearchFields(
    searchMode: 'all' | 'problem' | 'solution',
  ): string[] {
    switch (searchMode) {
      case 'problem':
        return ['number', 'externalNumber', 'title', 'problemDescription'];
      case 'solution':
        return ['number', 'externalNumber', 'title', 'solutionDescription'];
      default:
        return [
          'number',
          'externalNumber',
          'title',
          'problemDescription',
          'solutionDescription',
        ];
    }
  }
}
