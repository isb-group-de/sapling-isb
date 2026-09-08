import { promptText } from './ai-prompt-context';
export const SAPLING_MCP_TOOL_DESCRIPTIONS = {
  get currentPerson() {
    return promptText('mcp.sapling_mcp_tool_descriptions.currentPerson');
  },
  get entityCatalog() {
    return promptText('mcp.sapling_mcp_tool_descriptions.entityCatalog');
  },
  get entitySchema() {
    return promptText('mcp.sapling_mcp_tool_descriptions.entitySchema');
  },
  get entitySearch() {
    return promptText('mcp.sapling_mcp_tool_descriptions.entitySearch');
  },
  get genericList() {
    return promptText('mcp.sapling_mcp_tool_descriptions.genericList');
  },
  get genericGet() {
    return promptText('mcp.sapling_mcp_tool_descriptions.genericGet');
  },
  get genericTimeline() {
    return promptText('mcp.sapling_mcp_tool_descriptions.genericTimeline');
  },
  get ticketSearch() {
    return promptText('mcp.sapling_mcp_tool_descriptions.ticketSearch');
  },
  get semanticSearch() {
    return promptText('mcp.sapling_mcp_tool_descriptions.semanticSearch');
  },
  get knowledgeSearch() {
    return promptText('mcp.sapling_mcp_tool_descriptions.knowledgeSearch');
  },
  get webSearch() {
    return promptText('mcp.sapling_mcp_tool_descriptions.webSearch');
  },
  get importGetBatch() {
    return promptText('mcp.sapling_mcp_tool_descriptions.importGetBatch');
  },
  get importListTemplates() {
    return promptText('mcp.sapling_mcp_tool_descriptions.importListTemplates');
  },
  get importSuggestMapping() {
    return promptText('mcp.sapling_mcp_tool_descriptions.importSuggestMapping');
  },
  get importMatchExistingRecords() {
    return promptText(
      'mcp.sapling_mcp_tool_descriptions.importMatchExistingRecords',
    );
  },
  get importConfigureBatch() {
    return promptText('mcp.sapling_mcp_tool_descriptions.importConfigureBatch');
  },
  get importExecuteBatch() {
    return promptText('mcp.sapling_mcp_tool_descriptions.importExecuteBatch');
  },
  get genericCreate() {
    return promptText('mcp.sapling_mcp_tool_descriptions.genericCreate');
  },
  get genericUpdate() {
    return promptText('mcp.sapling_mcp_tool_descriptions.genericUpdate');
  },
  get genericDelete() {
    return promptText('mcp.sapling_mcp_tool_descriptions.genericDelete');
  },
} as const;

export const SAPLING_MCP_UNTRUSTED_RESULT_NOTICE = () =>
  promptText('mcp.sapling_mcp_untrusted_result_notice');

export const SAPLING_MCP_USAGE_HINTS = {
  get currentPerson() {
    return [
      promptText('mcp.sapling_mcp_usage_hints.currentPerson.0'),
      promptText('mcp.sapling_mcp_usage_hints.currentPerson.1'),
      promptText('mcp.sapling_mcp_usage_hints.currentPerson.2'),
    ];
  },
  get genericList() {
    return [
      promptText('mcp.sapling_mcp_usage_hints.genericList.0'),
      promptText('mcp.sapling_mcp_usage_hints.genericList.1'),
      promptText('mcp.sapling_mcp_usage_hints.genericList.2'),
    ];
  },
  get entitySchema() {
    return [
      promptText('mcp.sapling_mcp_usage_hints.entitySchema.0'),
      promptText('mcp.sapling_mcp_usage_hints.entitySchema.1'),
      promptText('mcp.sapling_mcp_usage_hints.entitySchema.2'),
      promptText('mcp.sapling_mcp_usage_hints.entitySchema.3'),
      promptText('mcp.sapling_mcp_usage_hints.entitySchema.4'),
      promptText('mcp.sapling_mcp_usage_hints.entitySchema.5'),
      promptText('mcp.sapling_mcp_usage_hints.entitySchema.6'),
      promptText('mcp.sapling_mcp_usage_hints.entitySchema.7'),
      promptText('mcp.sapling_mcp_usage_hints.entitySchema.8'),
    ];
  },
  get entitySearch() {
    return [
      promptText('mcp.sapling_mcp_usage_hints.entitySearch.0'),
      promptText('mcp.sapling_mcp_usage_hints.entitySearch.1'),
    ];
  },
  get genericGet() {
    return [promptText('mcp.sapling_mcp_usage_hints.genericGet.0')];
  },
  get userFacingValues() {
    return [
      promptText('mcp.sapling_mcp_usage_hints.userFacingValues.0'),
      promptText('mcp.sapling_mcp_usage_hints.userFacingValues.1'),
      promptText('mcp.sapling_mcp_usage_hints.userFacingValues.2'),
    ];
  },
  get ticketSearch() {
    return [
      promptText('mcp.sapling_mcp_usage_hints.ticketSearch.0'),
      promptText('mcp.sapling_mcp_usage_hints.ticketSearch.1'),
    ];
  },
  get semanticSearch() {
    return [
      promptText('mcp.sapling_mcp_usage_hints.semanticSearch.0'),
      promptText('mcp.sapling_mcp_usage_hints.semanticSearch.1'),
    ];
  },
  get knowledgeSearch() {
    return [
      promptText('mcp.sapling_mcp_usage_hints.knowledgeSearch.0'),
      promptText('mcp.sapling_mcp_usage_hints.knowledgeSearch.1'),
      promptText('mcp.sapling_mcp_usage_hints.knowledgeSearch.2'),
    ];
  },
  get webSearch() {
    return [
      promptText('mcp.sapling_mcp_usage_hints.webSearch.0'),
      promptText('mcp.sapling_mcp_usage_hints.webSearch.1'),
      promptText('mcp.sapling_mcp_usage_hints.webSearch.2'),
      promptText('mcp.sapling_mcp_usage_hints.webSearch.3'),
    ];
  },
  get importTools() {
    return [
      promptText('mcp.sapling_mcp_usage_hints.importTools.0'),
      promptText('mcp.sapling_mcp_usage_hints.importTools.1'),
      promptText('mcp.sapling_mcp_usage_hints.importTools.2'),
      promptText('mcp.sapling_mcp_usage_hints.importTools.3'),
      promptText('mcp.sapling_mcp_usage_hints.importTools.4'),
      promptText('mcp.sapling_mcp_usage_hints.importTools.5'),
    ];
  },
  get toolError() {
    return [
      promptText('mcp.sapling_mcp_usage_hints.toolError.0'),
      promptText('mcp.sapling_mcp_usage_hints.toolError.1'),
      promptText('mcp.sapling_mcp_usage_hints.toolError.2'),
      promptText('mcp.sapling_mcp_usage_hints.toolError.3'),
      promptText('mcp.sapling_mcp_usage_hints.toolError.4'),
      promptText('mcp.sapling_mcp_usage_hints.toolError.5'),
    ];
  },
  get criteriaRepair() {
    return [
      promptText('mcp.sapling_mcp_usage_hints.criteriaRepair.0'),
      promptText('mcp.sapling_mcp_usage_hints.criteriaRepair.1'),
      promptText('mcp.sapling_mcp_usage_hints.criteriaRepair.2'),
    ];
  },
  get mutationRepair() {
    return [
      promptText('mcp.sapling_mcp_usage_hints.mutationRepair.0'),
      promptText('mcp.sapling_mcp_usage_hints.mutationRepair.1'),
      promptText('mcp.sapling_mcp_usage_hints.mutationRepair.2'),
      promptText('mcp.sapling_mcp_usage_hints.mutationRepair.3'),
      promptText('mcp.sapling_mcp_usage_hints.mutationRepair.4'),
    ];
  },
} as const;
