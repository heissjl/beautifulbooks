/**
 * The word list behind the typo correction (ROADMAP 6.60, `lib/spelling.ts`).
 *
 * **Server-side only.** It reads `data/collections.json` (over 600 KB) and
 * the index list; a client component that imported it would ship both to
 * every browser. Same trap as `lib/coverindex.ts` and `lib/collections.ts`.
 *
 * Titles and author names from the works this site already knows: the index
 * (`data/index-works.json`, 500 works), the curated wall and every
 * collection, drafts included — a draft's titles are real books whatever
 * becomes of the draft. Built once per server instance, on first use.
 */
import collectionsFile from '@/data/collections.json';
import curatedFile from '@/data/curated.json';
import indexWorks from '@/data/index-works.json';
import { buildVocabulary, type Vocabulary } from './spelling';

interface Named {
  title?: string;
  author?: string;
}

interface CollectionLike {
  title?: string;
  authors?: Array<{ name?: string }>;
  works?: Named[];
}

/** Every title and author name the lexicon is built from. */
export function lexiconPhrases(): string[] {
  const out: string[] = [];
  const add = (w: Named) => {
    if (w.title) out.push(w.title);
    if (w.author) out.push(w.author);
  };
  (indexWorks.works as Named[]).forEach(add);
  (curatedFile.works as Named[]).forEach(add);
  for (const c of collectionsFile.collections as CollectionLike[]) {
    (c.works ?? []).forEach(add);
    for (const a of c.authors ?? []) if (a.name) out.push(a.name);
  }
  return out;
}

let cached: Vocabulary | undefined;

export function searchVocabulary(): Vocabulary {
  cached ??= buildVocabulary(lexiconPhrases());
  return cached;
}
