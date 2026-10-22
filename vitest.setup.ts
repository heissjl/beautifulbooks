/**
 * Per-instance state that one test must not leave to the next: a test that
 * mocks a 403 from Open Library opens the catalogue's pause, which would turn
 * every later catalogue call in the file into "busy" (ROADMAP 2.18e).
 */
import { beforeEach } from 'vitest';
import { resetCatalogueGate } from './lib/sources/olgate';

beforeEach(() => {
  resetCatalogueGate();
});
