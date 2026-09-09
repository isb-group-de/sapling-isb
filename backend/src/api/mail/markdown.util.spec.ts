import { describe, expect, it } from '@jest/globals';
import { renderMarkdownBlocks } from './markdown.util';

describe('mail markdown tables', () => {
  it('renders email-safe table styling and Markdown column alignment inline', () => {
    const html = renderMarkdownBlocks(
      [
        '| Name | Amount | State |',
        '|---|---:|:---:|',
        '| Hosting | 32 GB | Ready |',
      ].join('\n'),
    );

    expect(html).toContain(
      '<table cellpadding="0" cellspacing="0" style="border-collapse: collapse; border-spacing: 0; width: 100%; margin: 0 0 16px;">',
    );
    expect(html).toContain(
      '<th align="left" style="padding: 8px 10px; border: 1px solid #d1d5db;',
    );
    expect(html).toContain(
      'background-color: #f3f4f6; font-weight: 600; text-align: right;">Amount</th>',
    );
    expect(html).toContain(
      '<td align="center" style="padding: 8px 10px; border: 1px solid #d1d5db; vertical-align: top; overflow-wrap: break-word; word-break: normal; text-align: center;">Ready</td>',
    );
  });

  it('keeps table content HTML-escaped', () => {
    const html = renderMarkdownBlocks(
      '| Value |\n|---|\n| <script>alert(1)</script> |',
    );

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });
});
