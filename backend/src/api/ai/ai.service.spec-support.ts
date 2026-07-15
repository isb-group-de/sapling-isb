import { jest } from '@jest/globals';

jest.mock('@mikro-orm/core', () => ({ EntityManager: class {} }));
jest.mock('openai', () => ({ OpenAI: class {} }));
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {},
  SchemaType: {},
  TaskType: {},
}));
jest.mock('../../entity/PersonItem', () => ({ PersonItem: class {} }));
jest.mock('../../entity/TicketItem', () => ({ TicketItem: class {} }));
jest.mock('../../entity/AiChatSessionItem', () => ({
  AiChatSessionItem: class {},
}));
jest.mock('../../entity/AiChatMessageItem', () => ({
  AiChatMessageItem: class {},
}));
jest.mock('../../entity/AiChatAttachmentItem', () => ({
  AiChatAttachmentItem: class {},
}));
jest.mock('../../entity/AiChatTranscriptionItem', () => ({
  AiChatTranscriptionItem: class {},
}));
jest.mock('../../entity/AiAgentItem', () => ({
  AiAgentItem: class {},
}));
jest.mock('../../entity/AiAgentVersionItem', () => ({
  AiAgentVersionItem: class {},
}));
jest.mock('../../entity/AiAgentRunItem', () => ({
  AiAgentRunItem: class {},
}));
jest.mock('../../entity/AiAgentEvaluationItem', () => ({
  AiAgentEvaluationItem: class {},
}));
jest.mock('../../entity/AiAgentPlaybookItem', () => ({
  AiAgentPlaybookItem: class {},
}));
jest.mock('../../entity/AiAgentMemoryItem', () => ({
  AiAgentMemoryItem: class {},
}));
jest.mock('../../entity/AiChatToolActionItem', () => ({
  AiChatToolActionItem: class {},
}));
jest.mock('../../entity/AiProviderTypeItem', () => ({
  AiProviderTypeItem: class {},
}));
jest.mock('../../entity/AiProviderModelItem', () => ({
  AiProviderModelItem: class {},
}));
jest.mock('../../entity/DocumentItem', () => ({ DocumentItem: class {} }));
jest.mock('../../entity/ImportBatchItem', () => ({
  ImportBatchItem: class {},
}));
jest.mock('./dto/chat.dto', () => ({
  AiChatMessageListMetaDto: class {},
  AiChatMessageListResponseDto: class {},
  ApplyAiChatSessionPlaybookDto: class {},
  CreateAiAgentEvaluationDto: class {},
  CreateAiAgentTestRunDto: class {},
  CreateAiChatMessageDto: class {},
  CreateAiChatSessionDto: class {},
  ListAiChatMessagesQueryDto: class {},
  UpdateAiChatSessionDto: class {},
}));
jest.mock('./dto/vectorization.dto', () => ({
  VectorizeEntityDto: class {},
  VectorizeEntityResponseDto: class {},
}));
jest.mock('./dto/transcription.dto', () => ({
  AiChatTranscriptionResponseDto: class {},
  CreateAiChatTranscriptionDto: class {},
}));
jest.mock('./mcp.service', () => ({ McpService: class {} }));
jest.mock('../document/document.service', () => ({
  DocumentService: class {},
}));
jest.mock('../generic/generic.service', () => ({ GenericService: class {} }));
jest.mock('./ai-provider-registry.service', () => ({
  AiProviderRegistryService: class {},
}));
jest.mock('./ai-vector.service', () => ({ AiVectorService: class {} }));
jest.mock('../import/import.service', () => ({ ImportService: class {} }));

import { AiService } from './ai.service';
import { AiAgentPolicyService } from './ai-agent-policy.service';
import { AiChatRuntimeService } from './ai-chat-runtime.service';
import {
  alignAssistantContentWithNavigationLinks,
  buildNavigationLink,
  buildNavigationLinks,
} from './ai-navigation.utils';

export type ExecuteToolResult = {
  serverHandle: number;
  serverName: string;
  toolName: string;
  content: string;
  modelResult?: Record<string, unknown>;
  rawResult: Record<string, unknown>;
};

export type ExecuteToolMock = (
  serverName: string,
  toolName: string,
  args: Record<string, unknown>,
  user: unknown,
) => Promise<ExecuteToolResult>;

export const asMock = (value: unknown): jest.Mock => value as jest.Mock;
export const createAgentRunLifecycle = () => ({
  createRun: jest
    .fn<() => Promise<Record<string, unknown>>>()
    .mockResolvedValue({
      handle: 1,
      status: 'running',
      startedAt: new Date('2026-04-20T08:15:30.000Z'),
    }),
  completeRun: jest.fn(),
  buildSources: jest.fn<() => Record<string, unknown>[]>().mockReturnValue([]),
});
export const createService = (
  em: unknown = {},
  mcpService: unknown = {},
  documentService: unknown = {},
  providerRegistry: unknown = {},
  vectorService: unknown = {},
  chatRuntime: unknown = new AiChatRuntimeService(mcpService as never),
  agentPolicy: unknown = {},
  importService: unknown = {},
  agentRunLifecycle: unknown = createAgentRunLifecycle(),
) =>
  new AiService(
    em as never,
    mcpService as never,
    documentService as never,
    providerRegistry as never,
    vectorService as never,
    chatRuntime as never,
    agentRunLifecycle as never,
    agentPolicy as never,
    importService as never,
  );

export {
  AiAgentPolicyService,
  AiChatRuntimeService,
  alignAssistantContentWithNavigationLinks,
  buildNavigationLink,
  buildNavigationLinks,
};
