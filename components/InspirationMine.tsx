'use client';

import { useSyncExternalStore } from 'react';
import { wasMade } from './inspirationMemory';

/**
 * One of two things, depending on whether this reader just made the board
 * (ROADMAP 5.18b): its maker is offered "Change it" and told "the editions
 * you chose"; everyone else is offered "Make your own". On the server and
 * after a reload everyone is a visitor (`inspirationMemory.ts`).
 */
export default function InspirationMine({ query, maker, visitor }: { query: string; maker: React.ReactNode; visitor: React.ReactNode }) {
  const mine = useSyncExternalStore(() => () => {}, () => wasMade(query), () => false);
  return <>{mine ? maker : visitor}</>;
}
