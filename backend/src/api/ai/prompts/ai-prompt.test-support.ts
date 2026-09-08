import definitions from '../../../database/seeder/prompts/promptData_001.json';
import { aiPromptContext, type AiPromptScope } from './ai-prompt-context';
const scope: AiPromptScope = { manifest: {}, prompts: {} };
definitions.forEach((row, index) => {
  scope.manifest[row.handle] = index + 1;
  scope.prompts[row.handle] = {
    handle: index + 1,
    content: row.draft,
    variables: row.variables,
  };
});
const getStore = aiPromptContext.getStore.bind(aiPromptContext) as () =>
  AiPromptScope | undefined;
const install = () =>
  jest
    .spyOn(aiPromptContext, 'getStore')
    .mockImplementation(() => getStore() ?? scope);
install();
beforeEach(install);
