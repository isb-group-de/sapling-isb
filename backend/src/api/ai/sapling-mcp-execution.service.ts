import { ForbiddenException, Injectable } from '@nestjs/common';
import { PersonItem } from '../../entity/PersonItem';
import type { McpToolPolicy } from './mcp-policy.types';
import { SAPLING_MCP_TOOL_DEFINITIONS } from './sapling-mcp-tool-definitions';
import { SAPLING_MCP_USAGE_HINTS } from './prompts/sapling-mcp.prompts';
import { SaplingMcpGenericToolService } from './sapling-mcp-generic-tool.service';
import { SaplingMcpImportToolService } from './sapling-mcp-import-tool.service';
import { SaplingMcpMetadataService } from './sapling-mcp-metadata.service';
import { SaplingMcpResultFormatterService } from './sapling-mcp-result-formatter.service';
import { SaplingMcpSearchToolService } from './sapling-mcp-search-tool.service';
import { SaplingMcpValueService } from './sapling-mcp-value.service';
import { AiWebSearchService } from './ai-web-search.service';
@Injectable()
export class SaplingMcpExecutionService {
  private readonly internalServerName = 'sapling';

  constructor(
    private readonly metadata: SaplingMcpMetadataService,
    private readonly genericTools: SaplingMcpGenericToolService,
    private readonly searchTools: SaplingMcpSearchToolService,
    private readonly importTools: SaplingMcpImportToolService,
    private readonly webSearch: AiWebSearchService,
    private readonly values: SaplingMcpValueService,
    private readonly resultFormatter: SaplingMcpResultFormatterService,
  ) {}
  async listTools(policy?: McpToolPolicy): Promise<
    Array<{
      toolName: string;
      description: string;
      inputSchema: Record<string, unknown>;
    }>
  > {
    const hasWebSearch = await this.webSearch.isConfigured(
      policy?.webSearchProviderHandle,
      policy?.webSearchModelHandle,
    );

    return SAPLING_MCP_TOOL_DEFINITIONS.filter(
      (tool) => tool.toolName !== 'web_search' || hasWebSearch,
    ).map((tool) => ({
      toolName: tool.toolName,
      description: tool.description,
      inputSchema: { ...tool.jsonSchema },
    }));
  }

  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    user: PersonItem,
    policy?: McpToolPolicy,
  ): Promise<{ content: string; modelResult: unknown; rawResult: unknown }> {
    let payload: unknown;

    try {
      this.values.assertInternalToolAllowed(toolName, policy);

      switch (toolName) {
        case 'current_person':
          payload = await this.metadata.executeCurrentPerson(user);
          break;
        case 'entity_catalog':
          payload = this.metadata.executeEntityCatalog(policy, user);
          break;
        case 'entity_schema':
          payload = await this.metadata.executeEntitySchema(args, policy, user);
          break;
        case 'entity_search':
          payload = this.metadata.executeEntitySearch(args, policy, user);
          break;
        case 'generic_list':
          payload = await this.genericTools.executeGenericList(
            args,
            user,
            policy,
          );
          break;
        case 'generic_get':
          payload = await this.genericTools.executeGenericGet(
            args,
            user,
            policy,
          );
          break;
        case 'generic_timeline':
          payload = await this.genericTools.executeGenericTimeline(
            args,
            user,
            policy,
          );
          break;
        case 'ticket_search':
          payload = await this.searchTools.executeTicketSearch(
            args,
            user,
            policy,
          );
          break;
        case 'semantic_search':
          payload = await this.searchTools.executeSemanticSearch(
            args,
            user,
            policy,
          );
          break;
        case 'knowledge_search':
          payload = await this.searchTools.executeKnowledgeSearch(
            args,
            user,
            policy,
          );
          break;
        case 'web_search':
          payload = await this.webSearch.search({
            query: typeof args.query === 'string' ? args.query : '',
            urls: Array.isArray(args.urls)
              ? args.urls.filter(
                  (value): value is string => typeof value === 'string',
                )
              : undefined,
            allowedDomains: Array.isArray(args.allowedDomains)
              ? args.allowedDomains.filter(
                  (value): value is string => typeof value === 'string',
                )
              : undefined,
            searchContextSize:
              args.searchContextSize === 'low' ||
              args.searchContextSize === 'high'
                ? args.searchContextSize
                : 'medium',
            maxSources:
              typeof args.maxSources === 'number' ? args.maxSources : undefined,
            preferredProviderHandle: policy?.webSearchProviderHandle,
            preferredModelHandle: policy?.webSearchModelHandle,
            personHandle: user.handle ?? null,
          });
          break;
        case 'import_get_batch':
          payload = await this.importTools.executeImportGetBatch(
            args,
            user,
            policy,
          );
          break;
        case 'import_list_templates':
          payload = await this.importTools.executeImportListTemplates(
            args,
            user,
            policy,
          );
          break;
        case 'import_suggest_mapping':
          payload = await this.importTools.executeImportSuggestMapping(
            args,
            user,
            policy,
          );
          break;
        case 'import_match_existing_records':
          payload = await this.importTools.executeImportMatchExistingRecords(
            args,
            user,
            policy,
          );
          break;
        case 'import_configure_batch':
          payload = await this.importTools.executeImportConfigureBatch(
            args,
            user,
            policy,
          );
          break;
        case 'import_execute_batch':
          payload = await this.importTools.executeImportExecuteBatch(
            args,
            user,
            policy,
          );
          break;
        case 'generic_create':
          payload = await this.genericTools.executeGenericCreate(
            args,
            user,
            policy,
          );
          break;
        case 'generic_update':
          payload = await this.genericTools.executeGenericUpdate(
            args,
            user,
            policy,
          );
          break;
        case 'generic_delete':
          payload = await this.genericTools.executeGenericDelete(
            args,
            user,
            policy,
          );
          break;
        default:
          throw new ForbiddenException('ai.mcpToolNotFound');
      }
    } catch (error) {
      payload = this.createToolErrorPayload(toolName, error);
    }

    const modelResult = this.resultFormatter.createModelResult(
      toolName,
      payload,
      args,
    );

    return {
      content: JSON.stringify(modelResult, null, 2),
      modelResult,
      rawResult: payload,
    };
  }

  async preflightTool(
    toolName: string,
    args: Record<string, unknown>,
    user: PersonItem,
    policy?: McpToolPolicy,
  ): Promise<{
    content: string;
    modelResult: unknown;
    rawResult: unknown;
  } | null> {
    if (toolName !== 'generic_create' && toolName !== 'generic_update') {
      return null;
    }

    let payload: Record<string, unknown> | null;
    try {
      this.values.assertInternalToolAllowed(toolName, policy);
      payload = await this.genericTools.preflightGenericMutation(
        toolName,
        args,
        user,
        policy,
      );
    } catch (error) {
      payload = this.createToolErrorPayload(toolName, error);
    }

    if (!payload) {
      return null;
    }

    const modelResult = this.resultFormatter.createModelResult(
      toolName,
      payload,
      args,
    );

    return {
      content: JSON.stringify(modelResult, null, 2),
      modelResult,
      rawResult: payload,
    };
  }

  getServerName(): string {
    return this.internalServerName;
  }

  private createToolErrorPayload(toolName: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      ok: false,
      toolName,
      error: message,
      hints: [...SAPLING_MCP_USAGE_HINTS.toolError],
    };
  }
}
