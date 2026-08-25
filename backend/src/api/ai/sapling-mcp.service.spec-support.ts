import { jest } from '@jest/globals';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: class {
    registerTool() {
      return;
    }

    connect() {
      return Promise.resolve();
    }
  },
}));
jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: class {},
}));
jest.mock('@modelcontextprotocol/sdk/types.js', () => ({
  isInitializeRequest: jest.fn(),
}));
jest.mock('../generic/generic.service', () => ({ GenericService: class {} }));
jest.mock('../current/current.service', () => ({ CurrentService: class {} }));
jest.mock('../template/template.service', () => ({
  TemplateService: class {},
}));
jest.mock('../import/import.service', () => ({ ImportService: class {} }));
jest.mock('./ai.service', () => ({ AiService: class {} }));
jest.mock('../../entity/PersonItem', () => ({ PersonItem: class {} }));
jest.mock('../../entity/global/entity.registry', () => ({
  ENTITY_HANDLES: [
    'person',
    'project',
    'ticket',
    'ticketStatus',
    'event',
    'salesOpportunity',
    'effortEstimate',
    'effortEstimatePosition',
    'knowledgeArticle',
  ],
}));

import { SaplingMcpService } from './sapling-mcp.service';
import { SaplingMcpCriteriaService } from './sapling-mcp-criteria.service';
import { SaplingMcpResultFormatterService } from './sapling-mcp-result-formatter.service';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';

export const createTemplateField = (
  overrides: Partial<EntityTemplateDto>,
): EntityTemplateDto => ({
  name: '',
  type: 'string',
  isAutoIncrement: false,
  isUnique: false,
  referenceName: '',
  isReference: false,
  isRequired: false,
  nullable: false,
  isPersistent: true,
  options: [],
  formGroup: null,
  formGroupOrder: null,
  formOrder: null,
  formWidth: null,
  ...overrides,
});

export const createService = ({
  genericService = {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getRecordTimeline: jest.fn(),
    findAndCount: jest.fn(),
  },
  currentService = { getPerson: jest.fn() },
  templateService = { getEntityTemplate: jest.fn().mockReturnValue([]) },
  importService = {},
  aiService = { searchVectorDocuments: jest.fn() },
  permissionService = { assertEntityPermission: jest.fn() },
}: {
  genericService?: Record<string, jest.Mock>;
  currentService?: Record<string, jest.Mock>;
  templateService?: { getEntityTemplate: jest.Mock<any> };
  importService?: Record<string, jest.Mock> | Record<string, unknown>;
  aiService?: { searchVectorDocuments: jest.Mock };
  permissionService?: { assertEntityPermission: jest.Mock };
} = {}) =>
  new SaplingMcpService(
    genericService as never,
    currentService as never,
    templateService as never,
    importService as never,
    aiService as never,
    new SaplingMcpCriteriaService(templateService as never),
    permissionService as never,
    new SaplingMcpResultFormatterService(templateService as never),
  );
