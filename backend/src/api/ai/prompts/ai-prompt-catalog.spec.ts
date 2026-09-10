import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as ts from 'typescript';
import definitions from '../../../database/seeder/json-default/aiPromptTemplate/aiPromptTemplateData_0001_insert.json';
import { AI_PROMPT_USAGE } from './ai-prompt-usage';
import { validatePrompt } from './ai-prompt-context';

describe('Published prompt catalog coverage', () => {
  it('provides valid, uniquely keyed defaults for every indexed usage', () => {
    const keys = definitions.map((definition) => definition.handle);
    expect(new Set(keys).size).toBe(keys.length);
    for (const definition of definitions)
      expect(() =>
        validatePrompt(definition.draft, definition.variables),
      ).not.toThrow();
    expect(
      new Set(AI_PROMPT_USAGE.flatMap((entry) => [...entry.keys])),
    ).toEqual(new Set(keys));
  });

  it('keeps the administrator usage index consistent with executable call sites', () => {
    for (const entry of AI_PROMPT_USAGE) {
      const source = readFileSync(
        resolve(__dirname, '../../..', entry.source),
        'utf8',
      );
      const file = ts.createSourceFile(
        entry.source,
        source,
        ts.ScriptTarget.Latest,
        true,
      );
      const keys = new Set<string>();
      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          node.expression.getText(file) === 'promptText' &&
          node.arguments[0] &&
          ts.isStringLiteral(node.arguments[0])
        )
          keys.add(node.arguments[0].text);
        node.forEachChild(visit);
      };
      visit(file);
      expect(keys).toEqual(new Set(entry.keys));
    }
  });
});
