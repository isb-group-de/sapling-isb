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
@Injectable()
export class SaplingMcpExecutionService {
  private readonly internalServerName = 'sapling';

  constructor(
    private readonly metadata: SaplingMcpMetadataService,
    private readonly genericTools: SaplingMcpGenericToolService,
    private readonly searchTools: SaplingMcpSearchToolService,
    private readonly importTools: SaplingMcpImportToolService,
    private readonly values: SaplingMcpValueService,
    private readonly resultFormatter: SaplingMcpResultFormatterService,
  ) {}
  listTools(): Promise<
    Array<{
      toolName: string;
      description: string;
      inputSchema: Record<string, unknown>;
    }>
  > {
    return Promise.resolve(
      SAPLING_MCP_TOOL_DEFINITIONS.map((tool) => ({
        toolName: tool.toolName,
        description: tool.description,
        inputSchema: { ...tool.jsonSchema },
      })),
    );
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
          payload = this.metadata.executeEntityCatalog(policy);
          break;
        case 'entity_schema':
          payload = this.metadata.executeEntitySchema(args, policy);
          break;
        case 'entity_search':
          payload = this.metadata.executeEntitySearch(args, policy);
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
