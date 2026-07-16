function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/\n/g, ' ');
}

function tokenizeTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableSeparatorLine(line: string): boolean {
  const cells = tokenizeTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isHorizontalRuleLine(line: string): boolean {
  return /^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line);
}

function renderInlineMarkdown(value: string): string {
  const placeholders: string[] = [];
  const protect = (html: string): string =>
    `@@SAPLINGPLACEHOLDER${placeholders.push(html) - 1}@@`;

  let rendered = escapeHtml(value);
  rendered = rendered.replace(/`([^`]+)`/g, (_match, code: string) =>
    protect(`<code>${escapeHtml(code)}</code>`),
  );
  rendered = rendered.replace(
    /!\[([^\]]*)\]\(([^)\s]+(?:\s+"[^"]*")?)\)/g,
    (_match, alt: string, url: string) =>
      protect(
        `<img src="${escapeAttribute(url.trim())}" alt="${escapeAttribute(alt)}" />`,
      ),
  );
  rendered = rendered.replace(
    /\[([^\]]+)\]\(([^)\s]+(?:\s+"[^"]*")?)\)/g,
    (_match, label: string, url: string) =>
      protect(
        `<a href="${escapeAttribute(url.trim())}" target="_blank" rel="noopener noreferrer">${renderInlineMarkdown(label)}</a>`,
      ),
  );
  rendered = rendered.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  rendered = rendered.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  rendered = rendered.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  rendered = rendered.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');

  return rendered.replace(
    /@@SAPLINGPLACEHOLDER(\d+)@@/g,
    (_match, index: string) => placeholders[Number(index)] ?? '',
  );
}

export function renderMessageMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const html: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const currentLine = lines[index] ?? '';
    const trimmedLine = currentLine.trim();
    if (!trimmedLine) {
      index += 1;
      continue;
    }

    const fenceMatch = currentLine.match(/^```([\w-]+)?\s*$/);
    if (fenceMatch) {
      const language = fenceMatch[1]?.trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index] ?? '')) {
        codeLines.push(lines[index] ?? '');
        index += 1;
      }
      if (index < lines.length) index += 1;
      const className = language
        ? ` class="language-${escapeAttribute(language)}"`
        : '';
      html.push(
        `<pre><code${className}>${escapeHtml(codeLines.join('\n'))}</code></pre>`,
      );
      continue;
    }

    const headingMatch = currentLine.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      html.push(
        `<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`,
      );
      index += 1;
      continue;
    }

    if (isHorizontalRuleLine(currentLine)) {
      html.push('<hr>');
      index += 1;
      continue;
    }

    if (/^>\s?/.test(currentLine)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index] ?? '')) {
        quoteLines.push((lines[index] ?? '').replace(/^>\s?/, ''));
        index += 1;
      }
      html.push(
        `<blockquote>${renderMessageMarkdown(quoteLines.join('\n'))}</blockquote>`,
      );
      continue;
    }

    const nextLine = lines[index + 1] ?? '';
    if (currentLine.includes('|') && isTableSeparatorLine(nextLine)) {
      const headerCells = tokenizeTableRow(currentLine);
      const bodyRows: string[][] = [];
      index += 2;
      while (index < lines.length && (lines[index] ?? '').includes('|')) {
        bodyRows.push(tokenizeTableRow(lines[index] ?? ''));
        index += 1;
      }
      const head = `<thead><tr>${headerCells
        .map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`)
        .join('')}</tr></thead>`;
      const body = bodyRows.length
        ? `<tbody>${bodyRows
            .map(
              (row) =>
                `<tr>${row.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join('')}</tr>`,
            )
            .join('')}</tbody>`
        : '';
      html.push(`<table>${head}${body}</table>`);
      continue;
    }

    if (/^- \[[ xX]\]\s+/.test(currentLine)) {
      const items: string[] = [];
      while (
        index < lines.length &&
        /^- \[[ xX]\]\s+/.test(lines[index] ?? '')
      ) {
        const match = (lines[index] ?? '').match(/^- \[([ xX])\]\s+(.*)$/);
        const checked = (match?.[1] ?? ' ').toLowerCase() === 'x';
        items.push(
          `<li class="task-list-item"><input type="checkbox" disabled${checked ? ' checked' : ''}> ${renderInlineMarkdown(match?.[2] ?? '')}</li>`,
        );
        index += 1;
      }
      html.push(`<ul class="contains-task-list">${items.join('')}</ul>`);
      continue;
    }

    if (/^-\s+/.test(currentLine)) {
      const items: string[] = [];
      while (index < lines.length && /^-\s+/.test(lines[index] ?? '')) {
        items.push(
          `<li>${renderInlineMarkdown((lines[index] ?? '').replace(/^-\s+/, ''))}</li>`,
        );
        index += 1;
      }
      html.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(currentLine)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index] ?? '')) {
        items.push(
          `<li>${renderInlineMarkdown((lines[index] ?? '').replace(/^\d+\.\s+/, ''))}</li>`,
        );
        index += 1;
      }
      html.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const paragraphLine = lines[index] ?? '';
      if (!paragraphLine.trim()) break;
      if (
        /^```([\w-]+)?\s*$/.test(paragraphLine) ||
        /^(#{1,6})\s+/.test(paragraphLine) ||
        /^>\s?/.test(paragraphLine) ||
        isHorizontalRuleLine(paragraphLine) ||
        /^- \[[ xX]\]\s+/.test(paragraphLine) ||
        /^-\s+/.test(paragraphLine) ||
        /^\d+\.\s+/.test(paragraphLine) ||
        (paragraphLine.includes('|') &&
          isTableSeparatorLine(lines[index + 1] ?? ''))
      ) {
        break;
      }
      paragraphLines.push(paragraphLine);
      index += 1;
    }
    html.push(
      `<p>${paragraphLines.map((line) => renderInlineMarkdown(line)).join('<br>')}</p>`,
    );
  }

  return html.join('');
}

export function messageHtmlToPlainText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '- ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|blockquote|pre|tr)>/gi, '\n')
      .replace(/<\/(ul|ol|table|thead|tbody)>/gi, '\n')
      .replace(/<t[dh][^>]*>/gi, '')
      .replace(/<\/t[dh]>/gi, '\t')
      .replace(/<[^>]+>/g, '')
      .replace(/\t\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n'),
  ).trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
