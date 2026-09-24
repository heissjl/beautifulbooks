'use client';

import HeroFan from './HeroFan';
import { useIsDesktop } from './useIsDesktop';

/**
 * The ring's place beside the headline (ROADMAP 1.9), split off the home page
 * when that page became a server component (ROADMAP 6.49).
 *
 * `useIsDesktop(false)` answers "not desktop" on the server on purpose, so the
 * ring is never server-rendered: its seven covers carry preload links, and a
 * phone fetched all seven for a picture it never showed. The empty place of
 * the ring's size stays in the page from the first paint, so nothing moves
 * when the ring arrives.
 */
export default function HeroSlot() {
  const isDesktop = useIsDesktop(false);
  return isDesktop ? <HeroFan /> : null;
}
