import { Module, forwardRef } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AuthModule } from '../../auth/auth.module';
import { DocumentModule } from '../document/document.module';
import { GenericModule } from '../generic/generic.module';
import { CurrentModule } from '../current/current.module';
import { TemplateModule } from '../template/template.module';
import { AiService } from './ai.service';
import { AiChatRuntimeService } from './ai-chat-runtime.service';
import { AiAgentRunLifecycleService } from './ai-agent-run-lifecycle.service';
import { AiAgentPolicyService } from './ai-agent-policy.service';
import { AiAgentContextService } from './ai-agent-context.service';
import { AiAgentWorkbenchService } from './ai-agent-workbench.service';
import { AiChatPersistenceService } from './ai-chat-persistence.service';
import { AiChatSessionService } from './ai-chat-session.service';
import { AiChatMessageService } from './ai-chat-message.service';
import { AiChatToolActionService } from './ai-chat-tool-action.service';
import { AiChatStreamService } from './ai-chat-stream.service';
import { AiChatMediaService } from './ai-chat-media.service';
import { AiProviderRegistryService } from './ai-provider-registry.service';
import { AiVectorService } from './ai-vector.service';
import { AiVectorDocumentBuilderService } from './ai-vector-document-builder.service';
import { AiVectorEmbeddingService } from './ai-vector-embedding.service';
import { AiVectorIndexService } from './ai-vector-index.service';
import { AiVectorSearchService } from './ai-vector-search.service';
import { AiController } from './ai.controller';
import { AiMcpController } from './ai-mcp.controller';
import { AiVectorizationController } from './ai-vectorization.controller';
import { AiMediaController } from './ai-media.controller';
import { AiAgentController } from './ai-agent.controller';
import { AiAgentItem } from '../../entity/AiAgentItem';
import { AiChatSessionItem } from '../../entity/AiChatSessionItem';
import { AiChatMessageItem } from '../../entity/AiChatMessageItem';
import { AiChatTranscriptionItem } from '../../entity/AiChatTranscriptionItem';
import { AiChatToolActionItem } from '../../entity/AiChatToolActionItem';
import { AiProviderTypeItem } from '../../entity/AiProviderTypeItem';
import { AiProviderModelItem } from '../../entity/AiProviderModelItem';
import { McpServerConfigItem } from '../../entity/McpServerConfigItem';
import { AiVectorDocumentItem } from '../../entity/AiVectorDocumentItem';
import { McpService } from './mcp.service';
import { SaplingMcpService } from './sapling-mcp.service';
import { SaplingMcpCriteriaService } from './sapling-mcp-criteria.service';
import { SaplingMcpPermissionService } from './sapling-mcp-permission.service';
import { SaplingMcpResultFormatterService } from './sapling-mcp-result-formatter.service';
import { SaplingMcpValueService } from './sapling-mcp-value.service';
import { SaplingMcpMetadataService } from './sapling-mcp-metadata.service';
import { SaplingMcpGenericToolService } from './sapling-mcp-generic-tool.service';
import { SaplingMcpReferenceValueService } from './sapling-mcp-reference-value.service';
import { SaplingMcpSearchToolService } from './sapling-mcp-search-tool.service';
import { SaplingMcpImportToolService } from './sapling-mcp-import-tool.service';
import { SaplingMcpExecutionService } from './sapling-mcp-execution.service';
import { SaplingMcpTransportService } from './sapling-mcp-transport.service';
import { AiAgentEvaluationItem } from '../../entity/AiAgentEvaluationItem';
import { AiAgentMemoryItem } from '../../entity/AiAgentMemoryItem';
import { AiAgentPlaybookItem } from '../../entity/AiAgentPlaybookItem';
import { AiAgentRunItem } from '../../entity/AiAgentRunItem';
import { AiAgentVersionItem } from '../../entity/AiAgentVersionItem';
import { AiChatAttachmentItem } from '../../entity/AiChatAttachmentItem';
import { AiChatQueuedInputItem } from '../../entity/AiChatQueuedInputItem';
import { AiChatCoordinatorService } from './ai-chat-coordinator.service';
import { AiChatQueueService } from './ai-chat-queue.service';
import { ImportModule } from '../import/import.module';
import { AiWebSearchService } from './ai-web-search.service';
import { SystemModule } from '../system/system.module';

/**
 * @class
 * @version         1.0
 * @author          Martin Rosbund
 * @summary         Module for AI operations, including controller and service registration.
 *
 * @property        {AiController} AiController  Controller for AI endpoints
 * @property        {AiService} AiService        Service for AI logic
 */
@Module({
  imports: [
    AuthModule,
    DocumentModule,
    GenericModule,
    TemplateModule,
    CurrentModule,
    forwardRef(() => ImportModule),
    SystemModule,
    MikroOrmModule.forFeature([
      AiChatSessionItem,
      AiChatMessageItem,
      AiChatAttachmentItem,
      AiChatQueuedInputItem,
      AiChatTranscriptionItem,
      AiChatToolActionItem,
      AiAgentItem,
      AiAgentVersionItem,
      AiAgentRunItem,
      AiAgentEvaluationItem,
      AiAgentPlaybookItem,
      AiAgentMemoryItem,
      AiProviderTypeItem,
      AiProviderModelItem,
      AiVectorDocumentItem,
      McpServerConfigItem,
    ]),
  ],
  providers: [
    AiService,
    AiChatRuntimeService,
    AiAgentRunLifecycleService,
    AiAgentPolicyService,
    AiAgentContextService,
    AiAgentWorkbenchService,
    AiChatPersistenceService,
    AiChatSessionService,
    AiChatMessageService,
    AiChatToolActionService,
    AiChatStreamService,
    AiChatCoordinatorService,
    AiChatQueueService,
    AiChatMediaService,
    AiProviderRegistryService,
    AiWebSearchService,
    AiVectorDocumentBuilderService,
    AiVectorEmbeddingService,
    AiVectorIndexService,
    AiVectorSearchService,
    AiVectorService,
    McpService,
    SaplingMcpService,
    SaplingMcpCriteriaService,
    SaplingMcpPermissionService,
    SaplingMcpResultFormatterService,
    SaplingMcpValueService,
    SaplingMcpMetadataService,
    SaplingMcpGenericToolService,
    SaplingMcpReferenceValueService,
    SaplingMcpSearchToolService,
    SaplingMcpImportToolService,
    SaplingMcpExecutionService,
    SaplingMcpTransportService,
  ],
  controllers: [
    AiController,
    AiMcpController,
    AiVectorizationController,
    AiMediaController,
    AiAgentController,
  ],
  exports: [
    AiService,
    AiProviderRegistryService,
    McpService,
    SaplingMcpService,
  ],
})
export class AiModule {}
