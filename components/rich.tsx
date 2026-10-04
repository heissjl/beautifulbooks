import type { ReactNode } from 'react';

/**
 * A translated sentence with an element inside it (ROADMAP 6.85): the text
 * still carries `{name}` placeholders, and `rich` puts the given nodes in
 * their place, so the German may order them differently. No React hooks, so
 * it serves server pages and client components alike (components/i18n.tsx
 * re-exports it for the latter).
 */
export function rich(text: string, parts: Record<string, ReactNode>): ReactNode[] {
  return text.split(/(\{\w+\})/g).map((piece, i) => {
    const m = /^\{(\w+)\}$/.exec(piece);
    if (!m) return piece;
    const node = parts[m[1]];
    return node === undefined ? piece : <span key={i} className="contents">{node}</span>;
  });
}
