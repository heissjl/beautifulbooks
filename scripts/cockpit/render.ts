/**
 * The Cockpit page: one HTML file, no dependency outside itself (ROADMAP
 * 6.54). The data goes in as JSON inside a `<script type="application/json">`
 * and the page script (client.js) renders the views from it.
 *
 * The file never holds the server's token or a secret value: the server
 * replaces SERVER_SLOT per response (server.ts), and the data carries names
 * only (collect.ts).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { CockpitData } from './collect';

export const SERVER_SLOT = '<!--cockpit-server-->';

/** JSON that cannot end its script element early. */
export function embedJson(value: unknown): string {
  const ls = String.fromCharCode(0x2028), ps = String.fromCharCode(0x2029);
  return JSON.stringify(value).replace(/</g, '\\u003c').split(ls).join('\\u2028').split(ps).join('\\u2029');
}

const HERE = import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname);

export function renderPage(data: CockpitData, assets = { css: readFileSync(path.join(HERE, 'client.css'), 'utf8'), js: readFileSync(path.join(HERE, 'client.js'), 'utf8') }): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Beautiful Books Cockpit</title>
<style>${assets.css}</style>
</head>
<body>
<div class="app">
  <nav class="side" aria-label="Ansichten">
    <div class="brand">Beautiful Books<small>Cockpit · erzeugt, nie von Hand</small></div>
    <button data-v="home">Übersicht</button>
    <button data-v="board">Brett <span class="count" id="c-board"></span></button>
    <button data-v="sync">Sammlungen &amp; Sync <span class="count" id="c-sync"></span></button>
    <button data-v="tools">Werkzeuge <span class="count" id="c-tools"></span></button>
    <button data-v="services">Dienste &amp; Einstellungen</button>
    <button data-v="features">Funktionen <span class="count" id="c-feat"></span></button>
    <button data-v="site">Website-Karte <span class="count" id="c-site"></span></button>
    <button data-v="lab">Lab <span class="count" id="c-lab"></span></button>
    <button data-v="artefacts">Artefakte</button>
    <button data-v="hints">Hinweise <span class="count">${data.hints.length}</span></button>
    <div class="side-foot">
      <div>Darstellung: <button id="theme" type="button">hell/dunkel</button></div>
      <p>Jede Zahl ist aus Dateien und git abgeleitet. Ändern heißt: die Quelle ändern, neu erzeugen (<code>npm run cockpit</code>).</p>
    </div>
  </nav>
  <main id="main"></main>
</div>
<div class="scrim" id="scrim"></div>
<aside class="drawer" id="drawer" aria-live="polite"></aside>
<div class="toast" id="toast" role="status"></div>
<script id="cockpit-data" type="application/json">${embedJson(data)}</script>
${SERVER_SLOT}
<script>${assets.js}</script>
</body>
</html>
`;
}
