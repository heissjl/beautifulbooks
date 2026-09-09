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
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
