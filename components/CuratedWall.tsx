import CoverWall from './CoverWall';
import { WALL_WORKS } from '@/lib/curated';

/** Empty-state cover wall on the home page (SPEC §8.1). */
export default function CuratedWall() {
  return (
    <section aria-labelledby="curated-heading">
      <div className="mb-5">
        <h2 id="curated-heading" className="text-2xl text-ink">Start with a classic</h2>
      </div>
      <CoverWall works={WALL_WORKS} />
    </section>
  );
}
