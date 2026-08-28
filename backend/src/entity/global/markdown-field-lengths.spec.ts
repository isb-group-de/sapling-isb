import { describe, expect, it } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MINIMUM_BOUNDED_MARKDOWN_LENGTH = 2048;

interface BoundedMarkdownField {
  file: string;
  property: string;
  length: number;
}

function getBoundedMarkdownFields(): BoundedMarkdownField[] {
  const entityDirectory = join(__dirname, '..');

  return readdirSync(entityDirectory)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .flatMap((file) => {
      const source = readFileSync(join(entityDirectory, file), 'utf8');

      return [
        ...source.matchAll(
          /@Sapling\(\[[^\]]*['"]isMarkdown['"][^\]]*\]\)[\s\S]*?@Property\(\{(?<config>[\s\S]*?)\}\)\s+(?<property>[A-Za-z0-9_]+)/g,
        ),
      ].flatMap((match) => {
        const lengthMatch = match.groups?.config.match(/\blength:\s*(\d+)/);
        if (!lengthMatch || !match.groups?.property) {
          return [];
        }

        return [
          {
            file,
            property: match.groups.property,
            length: Number(lengthMatch[1]),
          },
        ];
      });
    });
}

describe('Markdown field lengths', () => {
  it('keeps every bounded Markdown field at 2,048 characters or more', () => {
    const insufficientFields = getBoundedMarkdownFields().filter(
      (field) => field.length < MINIMUM_BOUNDED_MARKDOWN_LENGTH,
    );

    expect(insufficientFields).toEqual([]);
  });
});
