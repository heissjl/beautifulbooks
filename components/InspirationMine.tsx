'use client';

import { useSyncExternalStore } from 'react';
import { wasMade, watchMade } from './inspirationMemory';

/**
 * One of two things, depending on whether this reader just made the board
 * (ROADMAP 5.18b): its maker is offered "Change it", the ways to share and
 * "the editions you chose"; everyone else is offered a board of their own.
 * On the server everyone is a visitor; the browser knows the maker by the
 * module's memory or by `#mine` in the address (`inspirationMemory.ts`).
 */
export default function InspirationMine({ query, maker, visitor }: { query: string; maker: React.ReactNode; visitor: React.ReactNode }) {
  const mine = useSyncExternalStore(watchMade, () => wasMade(query), () => false);
  return <>{mine ? maker : visitor}</>;
}
