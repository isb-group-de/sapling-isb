import { AsyncLocalStorage } from 'async_hooks';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';

export type AiPromptManifest = Record<string, number>;
export interface PublishedPrompt {
  handle: number;
  content: string;
  variables: string[];
}
export interface AiPromptScope {
  manifest: AiPromptManifest;
  prompts: Record<string, PublishedPrompt>;
  diagnostics?: {
    provider?: string;
    model?: string;
    usagePayload?: Record<string, unknown>;
  };
}
export const aiPromptContext = new AsyncLocalStorage<AiPromptScope>();

export function annotatePromptInvocation(
  data: NonNullable<AiPromptScope['diagnostics']>,
): void {
  const diagnostics = aiPromptContext.getStore()?.diagnostics;
  if (diagnostics) Object.assign(diagnostics, data);
}

export function validatePrompt(content: string, variables: string[]): void {
  if (!content.trim() || content.length > 100_000)
    throw new BadRequestException('ai.promptContentInvalid');
  const used = [
    ...content.matchAll(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g),
  ].map((m) => m[1]);
  const remainder = content.replace(/\{\{\s*[a-zA-Z][a-zA-Z0-9_]*\s*\}\}/g, '');
  if (
    remainder.includes('{{') ||
    remainder.includes('}}') ||
    used.some((name) => !variables.includes(name)) ||
    variables.some((name) => !used.includes(name))
  ) {
    throw new BadRequestException('ai.promptVariablesInvalid');
  }
}

/** Single substitution pass: values, including tool/email data, never become templates. */
export function renderPrompt(
  content: string,
  variables: string[],
  values: Record<string, unknown> = {},
): string {
  validatePrompt(content, variables);
  if (
    variables.some(
      (name) => !Object.hasOwn(values, name) || values[name] === undefined,
    )
  )
    throw new BadRequestException('ai.promptVariableMissing');
  return content.replace(
    /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g,
    (_, name: string) => {
      const value = values[name];
      if (value == null) return '';
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      )
        return String(value);
      throw new BadRequestException({
        message: 'ai.promptVariableInvalid',
        details: { variable: name },
      });
    },
  );
}

export function promptText(
  key: string,
  values?: Record<string, unknown>,
): string {
  const prompt = aiPromptContext.getStore()?.prompts[key];
  if (!prompt)
    throw new ServiceUnavailableException({
      message: 'ai.promptNotPublished',
      details: { prompt: key },
    });
  return renderPrompt(prompt.content, prompt.variables, values);
}

export function currentPromptManifest(): AiPromptManifest | null {
  return aiPromptContext.getStore()?.manifest ?? null;
}
