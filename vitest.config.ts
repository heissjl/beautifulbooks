import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    /*
      A worktree under `.claude/worktrees/` carries a second copy of this
      repository, tests and node_modules included. Without this line vitest
      collects both: on 2026-09-09 a run reported 50 files and 587 tests where
      there were 25 and 276, half of them an older copy of the same code. A
      suite that runs code from another branch can go green for the wrong
      reason, and red for a reason not in the working tree.
    */
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.claude/worktrees/**'],
    /*
      Tests that walk the committed data (the cover index, the hero rings,
      a board route that imports half the app) finish in two or three seconds
      alone, but when the stop hook runs the whole suite while an agent, a
      dev server and another session share the machine, a different one of
      them crossed the 5 s default on each of four evenings (2026-11-01 to
      11-04). The limit is for a hung test, not for a slow machine.
    */
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
