import { serializeToolResultForModel } from './prompts/ai.prompts';

export const AI_TOOL_RESULT_MAX_CHARACTERS = 48_000;
export const AI_TOOL_RESULT_TOTAL_CHARACTERS = 128_000;
const AI_TOOL_RESULT_MIN_CHARACTERS = 1_024;

export const OPENAI_COMPATIBLE_CONTINUATION_PROMPT =
  'Continue answering the original user request using the tool results above. If a result was truncated, retrieve only the missing data with narrower filters, a smaller limit, and successive pages. Do not repeat completed calls unnecessarily.';

export const OPENAI_COMPATIBLE_PARTIAL_RESULT_MESSAGE =
  '\n\nDie Datenabfragen wurden ausgeführt, aber das lokale Modell konnte die Ergebnisse auch nach einem kompakten Wiederanlauf nicht vollständig auswerten. Die bereits abgeschlossenen Abfragen wurden gespeichert; bitte grenze die Anfrage ein oder setze sie in einer Folgefrage fort.';

export class AiToolResultContextBudget {
  private remainingCharacters = AI_TOOL_RESULT_TOTAL_CHARACTERS;

  serialize(data: unknown): string {
    const maxCharacters = Math.min(
      AI_TOOL_RESULT_MAX_CHARACTERS,
      Math.max(AI_TOOL_RESULT_MIN_CHARACTERS, this.remainingCharacters),
    );
    const serialized = serializeToolResultForModel(data, maxCharacters);
    this.remainingCharacters = Math.max(
      0,
      this.remainingCharacters - serialized.length,
    );
    return serialized;
  }
}

export function isMissingUserQueryProviderError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /\bno user query found in messages\b/i.test(error.message)
  );
}
