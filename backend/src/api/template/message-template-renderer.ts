import type { PersonItem } from '../../entity/PersonItem';
import { MessageTemplateMetadata } from './message-template-metadata';
import type {
  JsonRecord,
  MessageTemplateRenderOptions,
  PlaceholderFormatter,
} from './message-template.types';

type ParsedPlaceholderExpression = {
  path: string;
  formatters: PlaceholderFormatter[];
};

export class MessageTemplateRenderer {
  private readonly placeholderFormatters = new Map<
    string,
    (
      value: unknown,
      formatter: PlaceholderFormatter,
      renderOptions: MessageTemplateRenderOptions,
    ) => unknown
  >([
    [
      'date',
      (value, _formatter, options) =>
        this.formatTemporalValue(value, 'date', options),
    ],
    [
      'datetime',
      (value, _formatter, options) =>
        this.formatTemporalValue(value, 'datetime', options),
    ],
    [
      'dateTime',
      (value, _formatter, options) =>
        this.formatTemporalValue(value, 'datetime', options),
    ],
  ]);

  constructor(private readonly metadata: MessageTemplateMetadata) {}

  replaceRecipients(
    input: string[] | string | undefined,
    context: JsonRecord,
  ): string[] {
    return this.normalizeRecipients(input).map((recipient) =>
      this.replacePlaceholders(recipient, context),
    );
  }

  replacePlaceholders(
    template: string,
    context: JsonRecord,
    renderOptions: MessageTemplateRenderOptions = {},
  ): string {
    return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, expression) => {
      const parsed = this.parsePlaceholderExpression(String(expression).trim());
      if (!parsed) {
        return '';
      }

      const fieldType = renderOptions.entityHandle
        ? this.metadata.resolveExpressionFieldType(
            renderOptions.entityHandle,
            parsed.path,
          )
        : undefined;
      return this.stringifyPlaceholderValue(
        this.getContextValue(context, parsed.path),
        parsed.formatters,
        renderOptions,
        fieldType,
      );
    });
  }

  getContextValue(context: JsonRecord, expression: string): unknown {
    return expression.split('.').reduce<unknown>((current, key) => {
      if (Array.isArray(current)) {
        return current.flatMap((entry) => {
          const value = this.resolveContextSegment(entry, key);
          if (Array.isArray(value)) return value;
          return value === undefined || value === null ? [] : [value];
        });
      }
      return this.resolveContextSegment(current, key);
    }, context);
  }

  private normalizeRecipients(input: string[] | string | undefined): string[] {
    if (!input) return [];
    const values = Array.isArray(input) ? input : input.split(/[;,]/);
    return values.map((value) => value.trim()).filter(Boolean);
  }

  private resolveContextSegment(current: unknown, key: string): unknown {
    const normalizedCurrent = this.normalizeContextValue(current);
    if (Array.isArray(normalizedCurrent)) {
      return normalizedCurrent.flatMap((entry) => {
        const value = this.resolveContextSegment(entry, key);
        if (Array.isArray(value)) return value;
        return value === undefined || value === null ? [] : [value];
      });
    }
    if (!isRecord(normalizedCurrent)) return undefined;
    return this.normalizeContextValue(normalizedCurrent[key]);
  }

  private normalizeContextValue(value: unknown): unknown {
    if (this.isCollectionLike(value)) {
      return this.isInitializedCollectionLike(value) ? value.toArray() : [];
    }
    if (!value || typeof value !== 'object') return value;

    if (
      'unwrap' in value &&
      typeof (value as { unwrap?: unknown }).unwrap === 'function'
    ) {
      const unwrapped = (value as { unwrap: () => unknown }).unwrap();
      return unwrapped === value
        ? value
        : this.normalizeContextValue(unwrapped);
    }

    if (
      'getEntity' in value &&
      typeof (value as { getEntity?: unknown }).getEntity === 'function'
    ) {
      const entity = (value as { getEntity: () => unknown }).getEntity();
      return entity === value ? value : this.normalizeContextValue(entity);
    }
    return value;
  }

  private parsePlaceholderExpression(
    expression: string,
  ): ParsedPlaceholderExpression | null {
    const segments = expression
      .split('|')
      .map((segment) => segment.trim())
      .filter(Boolean);
    const path = segments.shift();
    if (!path) return null;

    return {
      path,
      formatters: segments
        .map((segment) => this.parsePlaceholderFormatter(segment))
        .filter((formatter): formatter is PlaceholderFormatter =>
          Boolean(formatter),
        ),
    };
  }

  private parsePlaceholderFormatter(
    value: string,
  ): PlaceholderFormatter | null {
    const match = value.match(/^([a-zA-Z][\w-]*)(?:\((.*)\))?$/);
    if (!match) return null;
    return {
      name: match[1],
      args: (match[2] ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    };
  }

  private stringifyPlaceholderValue(
    value: unknown,
    formatters: PlaceholderFormatter[],
    renderOptions: MessageTemplateRenderOptions,
    fieldType?: string,
  ): string {
    return this.flattenPlaceholderValues(value)
      .map((entry) =>
        this.stringifySinglePlaceholderValue(
          entry,
          formatters,
          renderOptions,
          fieldType,
        ),
      )
      .filter(Boolean)
      .join(', ');
  }

  private stringifySinglePlaceholderValue(
    value: unknown,
    formatters: PlaceholderFormatter[],
    renderOptions: MessageTemplateRenderOptions,
    fieldType?: string,
  ): string {
    const normalizedOptions = this.normalizeRenderOptions(renderOptions);
    if (formatters.length === 0) {
      return this.stringifyDefaultPlaceholderValue(
        value,
        normalizedOptions,
        fieldType,
      );
    }

    let formattedValue = value;
    for (const formatter of formatters) {
      formattedValue = this.applyPlaceholderFormatter(
        formattedValue,
        formatter,
        normalizedOptions,
      );
    }
    return this.stringifyPrimitivePlaceholderValue(formattedValue);
  }

  private stringifyDefaultPlaceholderValue(
    value: unknown,
    renderOptions: MessageTemplateRenderOptions,
    fieldType?: string,
  ): string {
    if (fieldType === 'date' || fieldType === 'datetime') {
      const formatted = this.formatTemporalValue(
        value,
        fieldType,
        renderOptions,
      );
      if (typeof formatted === 'string') return formatted;
    }
    if (value instanceof Date) return value.toISOString();
    return this.stringifyPrimitivePlaceholderValue(value);
  }

  private applyPlaceholderFormatter(
    value: unknown,
    formatter: PlaceholderFormatter,
    renderOptions: MessageTemplateRenderOptions,
  ): unknown {
    const formatHandler = this.placeholderFormatters.get(formatter.name);
    if (!formatHandler) {
      return value;
    }
    return formatHandler(value, formatter, renderOptions);
  }

  private formatTemporalValue(
    value: unknown,
    mode: 'date' | 'datetime',
    renderOptions: MessageTemplateRenderOptions,
  ): string | undefined {
    const dateValue = this.coerceDateValue(value);
    if (!dateValue) return undefined;

    const timeZone =
      mode === 'date' ? 'UTC' : this.normalizeTimeZone(renderOptions.timeZone);
    return new Intl.DateTimeFormat(renderOptions.locale, {
      dateStyle: 'medium',
      ...(mode === 'datetime' ? { timeStyle: 'short' } : {}),
      ...(timeZone ? { timeZone } : {}),
    }).format(dateValue);
  }

  private coerceDateValue(value: unknown): Date | null {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const dateValue = new Date(value);
      return Number.isNaN(dateValue.getTime()) ? null : dateValue;
    }
    return null;
  }

  private normalizeRenderOptions(
    renderOptions: MessageTemplateRenderOptions,
  ): MessageTemplateRenderOptions {
    return {
      ...renderOptions,
      locale: this.normalizeLocale(
        renderOptions.locale,
        renderOptions.currentUser,
      ),
      timeZone: this.normalizeTimeZone(renderOptions.timeZone),
    };
  }

  private normalizeLocale(
    locale: string | undefined,
    currentUser?: PersonItem,
  ): string | undefined {
    const candidates = [
      locale,
      this.extractCurrentUserLocale(currentUser),
    ].filter((entry): entry is string => typeof entry === 'string');
    for (const candidate of candidates) {
      const normalized = candidate.trim();
      if (!normalized) continue;
      try {
        return Intl.getCanonicalLocales(normalized)[0];
      } catch {
        continue;
      }
    }
    return undefined;
  }

  private normalizeTimeZone(timeZone: string | undefined): string | undefined {
    const normalized = timeZone?.trim();
    if (!normalized) return undefined;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: normalized });
      return normalized;
    } catch {
      return undefined;
    }
  }

  private extractCurrentUserLocale(
    currentUser?: PersonItem,
  ): string | undefined {
    const language = currentUser?.language;
    if (typeof language === 'string') return language;
    if (
      language &&
      typeof language === 'object' &&
      'handle' in language &&
      typeof language.handle === 'string'
    ) {
      return language.handle;
    }
    return undefined;
  }

  private flattenPlaceholderValues(value: unknown): unknown[] {
    if (value === null || value === undefined) return [];
    if (Array.isArray(value)) {
      return value.flatMap((entry) => this.flattenPlaceholderValues(entry));
    }
    return [value];
  }

  private stringifyPrimitivePlaceholderValue(value: unknown): string {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return String(value);
    }
    if (value instanceof Date) return value.toISOString();
    return '';
  }

  private isCollectionLike(value: unknown): value is {
    toArray: () => unknown[];
    isInitialized?: () => boolean;
  } {
    return (
      typeof value === 'object' &&
      value !== null &&
      'toArray' in value &&
      typeof (value as { toArray?: unknown }).toArray === 'function'
    );
  }

  private isInitializedCollectionLike(value: {
    isInitialized?: () => boolean;
  }): boolean {
    return typeof value.isInitialized !== 'function' || value.isInitialized();
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}
