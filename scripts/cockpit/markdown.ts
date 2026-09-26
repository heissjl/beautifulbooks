/**
 * The roadmap's markdown habits, rendered to HTML (moved from the old
 * scripts/kanban.ts). A reader for one document's habits, not a markdown
 * engine: bold, italics, code, links, bullets with one level of nesting,
 * numbered steps and the small tables the roadmap uses for measurements.
 */

export const REPO_BLOB = 'https://github.com/heissjl/beautifulbooks/blob/main/';

const ITEM_LINE = /^- \[([ x])\] \*\*(\d+)\.(\d+)([a-z]?)\s+([^*]+?)\*\*/;
const LIST_LINE = /^(\s*)(?:[-*]|\d+\.)\s+(.*)$/;

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Cut to a word boundary, never mid-word. A card that ends "…kalte Detai"
 * reads as a rendering bug rather than as a shortened sentence.
 */
export function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  const space = text.lastIndexOf(' ', max);
  return text.slice(0, space > max * 0.5 ? space : max).replace(/[\s,;:–—-]+$/, '') + '…';
}

/** Markdown reduced to plain text: no emphasis, links as their text. */
export function plain(md: string): string {
  return md
    .replace(/\*\*/g, '')
    .replace(/[`*_]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

/** Inline markdown: bold, italics, code, links. Escapes first. */
export function inline(md: string): string {
  let s = esc(md);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?![\w*])/g, '$1<em>$2</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, href: string) => {
    const url = /^https?:\/\//.test(href)
      ? href
      : href.startsWith('#')
        ? REPO_BLOB + 'ROADMAP.md' + href
        : REPO_BLOB + href.replace(/^\.\//, '');
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });
  return s;
}

/** An item's whole block (its first line is the item line) as HTML. */
export function renderBody(body: string[]): string {
  const out: string[] = [];
  const first = body[0].replace(ITEM_LINE, '').replace(/^[\s.:—-]+/, '');
  if (first.trim()) out.push(`<p>${inline(first)}</p>`);

  let i = 1;
  while (i < body.length) {
    const t = body[i].trim();
    if (t === '') { i++; continue; }

    if (t.startsWith('|')) {
      const rows: string[] = [];
      while (i < body.length && body[i].trim().startsWith('|')) { rows.push(body[i].trim()); i++; }
      const cells = (r: string) => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = cells(rows[0]);
      const data = rows.slice(1).filter(r => !/^\|\s*:?-{2,}/.test(r));
      out.push('<table><thead><tr>' + head.map(h => `<th>${inline(h)}</th>`).join('') + '</tr></thead><tbody>'
        + data.map(r => '<tr>' + cells(r).map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('')
        + '</tbody></table>');
      continue;
    }

    const li = LIST_LINE.exec(body[i]);
    if (li) {
      const indent = li[1].length;
      const tag = /^\s*\d+\./.test(body[i]) ? 'ol' : 'ul';
      out.push(`<${tag}>`);
      while (i < body.length) {
        const m = LIST_LINE.exec(body[i]);
        if (m && m[1].length === indent) {
          let text = m[2].replace(/^\[ \]\s*/, '☐ ');
          i++;
          const nested: string[] = [];
          while (i < body.length && body[i].trim() !== '') {
            const n = LIST_LINE.exec(body[i]);
            if (n && n[1].length === indent) break;
            if (n && n[1].length > indent) { nested.push(body[i].slice(indent + 2)); i++; continue; }
            if (nested.length) { nested.push(body[i].slice(indent + 2)); i++; continue; }
            if (body[i].trim().startsWith('|')) break;
            text += ' ' + body[i].trim(); i++;
          }
          const sub = nested.length ? renderBody(['- [ ] **0.0 x** ', ...nested]).replace(/^<p>[^]*?<\/p>\n?/, '') : '';
          out.push(`<li>${inline(text)}${sub}</li>`);
        } else if (body[i].trim() === '') {
          let k = i + 1;
          while (k < body.length && body[k].trim() === '') k++;
          const n = k < body.length ? LIST_LINE.exec(body[k]) : null;
          if (n && n[1].length === indent) { i = k; continue; }
          break;
        } else break;
      }
      out.push(`</${tag}>`);
      continue;
    }

    let text = t;
    i++;
    while (i < body.length && body[i].trim() !== '' && !body[i].trim().startsWith('|') && !LIST_LINE.test(body[i])) {
      text += ' ' + body[i].trim(); i++;
    }
    out.push(`<p>${inline(text)}</p>`);
  }
  return out.join('\n');
}
