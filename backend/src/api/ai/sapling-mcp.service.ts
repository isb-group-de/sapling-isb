import { Inject, Injectable, forwardRef } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PersonItem } from '../../entity/PersonItem';
import { CurrentService } from '../current/current.service';
import { GenericService } from '../generic/generic.service';
import { ImportService } from '../import/import.service';
import { TemplateService } from '../template/template.service';
import { AiService } from './ai.service';
import type { McpToolPolicy } from './mcp-policy.types';
import { SaplingMcpCriteriaService } from './sapling-mcp-criteria.service';
import { SaplingMcpExecutionService } from './sapling-mcp-execution.service';
import { SaplingMcpGenericToolService } from './sapling-mcp-generic-tool.service';
import { SaplingMcpImportToolService } from './sapling-mcp-import-tool.service';
import { SaplingMcpMetadataService } from './sapling-mcp-metadata.service';
import { SaplingMcpPermissionService } from './sapling-mcp-permission.service';
import { SaplingMcpResultFormatterService } from './sapling-mcp-result-formatter.service';
import { SaplingMcpSearchToolService } from './sapling-mcp-search-tool.service';
import { SaplingMcpTransportService } from './sapling-mcp-transport.service';
import { SaplingMcpValueService } from './sapling-mcp-value.service';
import { AiWebSearchService } from './ai-web-search.service';

@Injectable()
export class SaplingMcpService {
  constructor(
    private readonly genericService: GenericService,
    private readonly currentService: CurrentService,
    private readonly templateService: TemplateService,
    private readonly importService: ImportService,
    @Inject(forwardRef(() => AiService))
    private readonly aiService: AiService,
    private readonly criteriaService: SaplingMcpCriteriaService,
    private readonly permissionService: SaplingMcpPermissionService,
    private readonly resultFormatter: SaplingMcpResultFormatterService,
    private readonly webSearch: AiWebSearchService,
    private readonly values: SaplingMcpValueService = new SaplingMcpValueService(),
    private readonly metadata: SaplingMcpMetadataService = new SaplingMcpMetadataService(
      currentService,
      templateService,
      criteriaService,
      values,
    ),
    private readonly genericTools: SaplingMcpGenericToolService = new SaplingMcpGenericToolService(
      genericService,
      currentService,
      criteriaService,
      permissionService,
      metadata,
      values,
    ),
    private readonly searchTools: SaplingMcpSearchToolService = new SaplingMcpSearchToolService(
      genericService,
      aiService,
      permissionService,
      values,
    ),
    private readonly importTools: SaplingMcpImportToolService = new SaplingMcpImportToolService(
      importService,
      currentService,
      permissionService,
      metadata,
      values,
    ),
    private readonly execution: SaplingMcpExecutionService = new SaplingMcpExecutionService(
      metadata,
      genericTools,
      searchTools,
      importTools,
      webSearch,
      values,
      resultFormatter,
    ),
    private readonly transport: SaplingMcpTransportService = new SaplingMcpTransportService(
      execution,
    ),
  ) {}

  listTools(policy?: McpToolPolicy) {
    return this.execution.listTools(policy);
  }

  executeTool(
    toolName: string,
    args: Record<string, unknown>,
    user: PersonItem,
    policy?: McpToolPolicy,
  ) {
    return this.execution.executeTool(toolName, args, user, policy);
  }

  preflightTool(
    toolName: string,
    args: Record<string, unknown>,
    user: PersonItem,
    policy?: McpToolPolicy,
  ) {
    return this.execution.preflightTool(toolName, args, user, policy);
  }

  getServerName(): string {
    return this.execution.getServerName();
  }

  handlePost(
    req: Request & { user: PersonItem },
    res: Response,
  ): Promise<void> {
    return this.transport.handlePost(req, res);
  }

  handleGet(req: Request & { user: PersonItem }, res: Response): Promise<void> {
    return this.transport.handleGet(req, res);
  }

  handleDelete(
    req: Request & { user: PersonItem },
    res: Response,
  ): Promise<void> {
    return this.transport.handleDelete(req, res);
  }
}
