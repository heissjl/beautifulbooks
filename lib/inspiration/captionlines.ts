/**
 * A title as the lines a caption under a cover holds (ROADMAP 5.18b; Julian,
 * 2026-10-06: „schaffen wir es ganze titel draufzuhaben?"). Pure, so it can be
 * tested: the picture generator wraps on its own, and a third line would run
 * into the next row of covers.
 *
 * Broken between words; a word longer than a line is cut. An ellipsis appears
 * only when the title does not fit in `lines` lines, at the end of the last.
 * `maxChars` comes from the caption's width at half an em a letter, the
 * measure `clip` in the poster route was set by.
 */
export function captionLines(text: string, maxChars: number, lines = 2): string[] {
  const max = Math.max(4, maxChars);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = '';
  let i = 0;
  while (i < words.length && out.length < lines) {
    const word = words[i];
    const next = line ? `${line} ${word}` : word;
    if (next.length <= max) {
      line = next;
      i++;
    } else if (!line) {
      // One word longer than a line: cut it, the rest goes on.
      out.push(word.slice(0, max));
      words[i] = word.slice(max);
    } else {
      out.push(line);
      line = '';
    }
  }
  if (line && out.length < lines) out.push(line);
  if (i < words.length) {
    const last = out[out.length - 1] ?? '';
    out[out.length - 1] = `${last.slice(0, max - 1).trimEnd()}…`;
  }
  return out;
}
