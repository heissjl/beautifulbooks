/* The Cockpit's page script (ROADMAP 6.54). Renders the views from the data
   the generator embedded; talks to the local server only when the page was
   opened through it (window.COCKPIT_SERVER, injected per response, never
   written into docs/cockpit.html). */
(function () {
  'use strict';
  const D = JSON.parse(document.getElementById('cockpit-data').textContent);
  const S = window.COCKPIT_SERVER || null;
  const GH = 'https://github.com/heissjl/beautifulbooks/blob/main/';
  const LIVE = 'https://beautifulcovers.vercel.app';
  const DEV = 'http://localhost:3000';
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const BYNUM = Object.fromEntries(D.items.map(x => [x.num, x]));
  const stName = id => (D.statuses.find(s => s.id === id) || {}).name || id;
  const thName = id => (D.themes.find(t => t.id === id) || {}).name || id;
  const pill = st => `<span class="pill st-${st}">${esc(stName(st))}</span>`;
  const who = o => `<span class="who ${esc(o)}">${esc(o)}</span>`;
  const src = t => `<span class="src">${esc(t)}</span>`;
  const gh = (p, line) => GH + p + (line ? `?plain=1#L${line}` : '');
  const local = p => 'file://' + D.root + '/' + p;
  const fileA = (p, line) => `<a href="${esc(gh(p, line))}" target="_blank" rel="noopener"><code>${esc(p)}</code></a> <a class="small muted" href="${esc(local(p))}">lokal</a>`;
  const itemA = n => BYNUM[n] ? `<a href="#item/${esc(n)}" class="num" title="${esc(BYNUM[n].title)}">${esc(n)}</a>` : `<span class="num">${esc(n)}</span>`;
  const sortNum = (a, b) => a.num.localeCompare(b.num, undefined, { numeric: true });

  let view = 'home', boardMode = 'theme', boardOwner = 'alle', showDone = false, q = '';
  const toolState = {}; // id -> {running, output, exit}
  let ports = Object.assign({}, D.ports);
  let generation = null;

  /** Up, and it is this tool that listens (two lab servers share :4322): true, false, or null when another server holds the port. */
  function upState(t) {
    if (!t.port) return null;
    const l = D.listeners[t.port];
    const other = l && l.script && t.file && t.file !== 'package.json' && !l.script.includes(t.file);
    return ports[t.port] && other ? null : ports[t.port];
  }
  function matches(text) { return !q || String(text).toLowerCase().includes(q); }
  function itemMatches(x) { return matches([x.num, x.title, x.gist, x.files.join(' '), thName(x.theme)].join(' ')); }
  function topbar(title, stamp, search = true) {
    return `<div class="topbar"><div><h1>${title}</h1><div class="stamp">${stamp}</div></div>${search ? `<input class="search" id="q" placeholder="Filtern: Nummer, Titel, Datei …" value="${esc(q)}" aria-label="Filtern">` : ''}</div>`;
  }
  const when = iso => iso ? new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : '';

  /* ---------------------------------------------------------------- Übersicht */
  function hintRow(h) {
    const link = h.item ? ` <a href="#item/${esc(h.item)}">${esc(h.item)} öffnen</a>` : h.view ? ` <a href="#${esc(h.view)}">ansehen</a>` : '';
    return `<div class="hint"><span class="ico ${h.level === 'act' ? '' : 'info'}">${h.level === 'act' ? '!' : 'i'}</span><div><b>${esc(h.title)}.</b> ${esc(h.text)}${link}</div></div>`;
  }
  function vHome() {
    const cnt = s => D.items.filter(x => x.status === s).length;
    const tiles = D.statuses.map(s => `<a class="tile" href="#board/${s.id}" style="text-decoration:none;color:inherit"><div class="n">${cnt(s.id)}</div><div class="l">${esc(s.name)}</div></a>`).join('');
    const quick = ['dev', 'lab-collections-serve', 'lab-curate-serve', 'curate-online'].map(id => D.tools.find(t => t.id === id)).filter(Boolean).map(t => {
      const up = upState(t);
      return `<span class="tag" style="padding:.2rem .5rem;font-size:.8rem"><span class="dot ${t.kind === 'online' ? 'na' : up ? 'up' : ''}" style="margin-right:.3rem"></span>${esc(t.name)} ${t.url && (up || t.kind === 'online') ? `<a href="${esc(t.url)}" target="_blank" rel="noopener">öffnen</a>` : `<a href="#tools">starten</a>`}</span>`;
    }).join('');
    const next = D.nextSteps.map(s => `<tr class="click" ${s.items[0] ? `data-item="${esc(s.items[0])}"` : ''}><td class="num">${esc(s.rank)}</td><td>${esc(s.what.replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'))}</td><td class="small">${esc(s.who)}</td><td class="muted small">${esc(s.effort)}</td></tr>`).join('');
    const jul = D.items.filter(x => x.status === 'julian').sort(sortNum);
    const julRows = jul.slice(0, 10).map(x => `<tr class="click" data-item="${esc(x.num)}"><td class="num">${esc(x.num)}</td><td>${esc(x.title)}</td><td class="muted small">${esc(x.assessment ? x.assessment.verdictRaw : '')}</td></tr>`).join('');
    const act = D.hints.filter(h => h.level === 'act');
    const info = D.hints.filter(h => h.level !== 'act');
    const hints = act.concat(info).slice(0, 9).map(hintRow).join('') || '<p class="muted small">Keine Widersprüche gefunden.</p>';
    const br = D.branches.filter(b => b.name !== 'main').map(b => `<tr><td class="mono small">${esc(b.name)}${b.worktree ? `<div class="muted">${esc(b.worktree)}</div>` : ''}</td><td class="small">+${b.ahead} / −${b.behind}${b.dirty ? ` · <span class="lvl-act">${b.dirty} ungespeichert</span>` : ''}<div class="muted">${esc(b.lastDate)}</div></td><td>${b.items.map(itemA).join(' ') || '<span class="muted small">—</span>'}</td></tr>`).join('');
    const themes = D.themes.map(th => {
      const xs = D.items.filter(x => x.theme === th.id);
      if (!xs.length) return '';
      const seg = D.statuses.map(s => { const k = xs.filter(x => x.status === s.id).length; return k ? `<span style="width:${k / xs.length * 100}%;background:var(--s-${s.id})" title="${esc(s.name)}: ${k}"></span>` : ''; }).join('');
      const active = xs.filter(x => x.status !== 'done' && x.status !== 'deferred').length;
      return `<a class="tile" href="#theme/${th.id}" style="text-decoration:none;color:inherit"><div style="display:flex;justify-content:space-between;gap:.5rem"><b style="font-family:ui-serif,Georgia,serif">${esc(th.name)}</b><span class="muted small">${active} aktiv · ${xs.length}</span></div><div class="themebar">${seg}</div></a>`;
    }).join('');
    const hist = D.history.slice(-6).reverse().map(h => `<tr><td class="muted small" style="white-space:nowrap">${esc(h.date)}</td><td><a href="${esc(gh('docs/history.md', h.line))}" target="_blank" rel="noopener">${esc(h.title.replace(/\*/g, ''))}</a></td><td>${h.items.map(itemA).join(' ')}</td></tr>`).join('');
    const syncAct = D.sync.rows.filter(r => r.verdicts.some(v => v.level === 'act')).length;
    return topbar('Übersicht', `erzeugt ${esc(when(D.generatedAt))} aus ROADMAP.md, docs/, lab/, app/ und git · Produktion ${esc(D.production.ref)} = <span class="mono">${esc(D.production.head)}</span>`, false) +
      (D.stand[0] ? `<p class="lede">${esc(D.stand[D.stand.length - 1].replace(/\*\*/g, ''))} ${src('ROADMAP.md › Stand')}</p>` : '') +
      `<div class="tiles">${tiles}<a class="tile" href="#sync" style="text-decoration:none;color:inherit"><div class="n ${syncAct ? 'lvl-act' : ''}">${syncAct}</div><div class="l">Sammlungen mit offener Synchronisation</div></a></div>
      <div class="box" style="margin-top:1rem;display:flex;gap:.6rem;align-items:center;flex-wrap:wrap"><b>Schnellstart</b>${quick}<a href="#tools" class="small">alle Werkzeuge</a></div>
      <div class="grid2" style="margin-top:1.2rem"><div>
        <div class="box scroll"><h2>Nächste Schritte ${src('ROADMAP.md › Nächste Schritte')}</h2><table><tr><th></th><th>Was</th><th>Wer</th><th>Aufwand</th></tr>${next}</table></div>
        <div class="box scroll" style="margin-top:1rem"><h2>Wartet auf dich ${src('Status „Wartet auf Julian“')}</h2><table>${julRows || '<tr><td class="muted">nichts</td></tr>'}</table><div class="small" style="margin-top:.4rem"><a href="#board/julian">alle ${jul.length} im Brett</a></div></div>
      </div><div>
        <div class="box"><h2>Hinweise ${src('Widersprüche zwischen den Quellen')}</h2>${hints}${D.hints.length > 9 ? `<div class="small" style="margin-top:.4rem"><a href="#hints">alle ${D.hints.length} Hinweise</a></div>` : ''}</div>
        <div class="box scroll" style="margin-top:1rem"><h2>Läuft gerade ${src('git: Branches und Worktrees')}</h2><table>${br || '<tr><td class="muted">kein Branch vor Produktion</td></tr>'}</table></div>
      </div></div>
      <h2>Themen ${src('Regeln im Skript, korrigierbar mit „Thema:“ im Punkt')}</h2><div class="tiles" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">${themes}</div>
      <h2>Zuletzt ${src('docs/history.md')}</h2><div class="box scroll"><table>${hist}</table></div>`;
  }
  function vHints() {
    return topbar('Hinweise', 'Prüfungen über die Quellen hinweg — nur angezeigt, sie halten keinen Commit auf (Julian, 2026-09-25)', false) +
      `<div class="box">${D.hints.map(hintRow).join('') || '<p class="muted">Keine.</p>'}</div>`;
  }

  /* -------------------------------------------------------------------- Brett */
  function cardH(x, withTheme) {
    const a = x.assessment;
    return `<div class="card c-${x.status}" data-item="${esc(x.num)}"><span class="num">${esc(x.num)}</span> ${esc(x.title)}
      <div class="meta">${who(x.owner)}${a && a.effort ? `<span class="tag">${esc(a.effort)}</span>` : ''}${x.openWaits.map(w => `<span class="tag" title="aus dem Mermaid-Graphen">wartet auf ${esc(w)}</span>`).join('')}${x.work.length ? '<span class="tag">⎇ Branch</span>' : ''}${!x.done && !a ? '<span class="tag warn">unbewertet</span>' : ''}${withTheme ? `<span class="tag">${esc(thName(x.theme))}</span>` : ''}</div></div>`;
  }
  function vBoard() {
    const filt = x => itemMatches(x) && (boardOwner === 'alle' || x.owner === boardOwner || (boardOwner === 'Julian' && x.owner === 'beide'));
    const items = D.items.filter(filt).sort(sortNum);
    let body = '';
    if (boardMode === 'theme') {
      body = `<div class="board-wrap"><div class="board"><div class="hd">Thema</div>${D.statuses.map(s => `<div class="hd">${esc(s.name)}<div class="muted" style="font-weight:400">${esc(s.sub)}</div></div>`).join('')}`;
      for (const th of D.themes) {
        const xs = items.filter(x => x.theme === th.id);
        if (!xs.length) continue;
        body += `<div class="rowh" id="th-${th.id}"><b>${esc(th.name)}</b><span class="muted small">${esc(th.hint)}</span></div>`;
        for (const s of D.statuses) {
          const cs = xs.filter(x => x.status === s.id);
          if (s.id === 'done' && !showDone) body += `<div class="cell">${cs.length ? `<div class="collapsed" data-showdone>${cs.length} erledigt ▸</div>` : ''}</div>`;
          else body += `<div class="cell">${cs.map(x => cardH(x, false)).join('')}</div>`;
        }
      }
      body += '</div></div>';
    } else {
      const cols = D.statuses.filter(s => showDone || s.id !== 'done');
      body = `<div class="board-wrap"><div class="board flat" style="grid-template-columns:repeat(${cols.length},minmax(180px,1fr))">${cols.map(s => `<div class="hd">${esc(s.name)} · ${items.filter(x => x.status === s.id).length}</div>`).join('')}` +
        cols.map(s => `<div class="cell">${items.filter(x => x.status === s.id).map(x => cardH(x, true)).join('')}</div>`).join('') + '</div></div>';
    }
    const seg = (k, vals) => `<div class="seg" data-seg="${k}">${vals.map(([v, l, on]) => `<button data-val="${v}" class="${on ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    return topbar('Brett', 'Zeilen: Thema · Spalten: Status · eine Ansicht von ROADMAP.md, kein zweiter Ort — eine Karte bewegt sich, wenn der Punkt dort geändert wird') +
      `<div class="toolbar">${seg('mode', [['theme', 'nach Thema', boardMode === 'theme'], ['flat', 'nur Spalten', boardMode === 'flat']])}
      ${seg('owner', [['alle', 'alle', boardOwner === 'alle'], ['Julian', 'Julian', boardOwner === 'Julian'], ['Claude', 'Claude', boardOwner === 'Claude']])}
      ${seg('done', [['1', 'Erledigte zeigen', showDone]])}
      <span class="muted small">Status: Branch mit Arbeit &gt; Bewertung „zurückstellen“ &gt; „entscheiden/streichen/erledigt?“ &gt; Besitzer Julian &gt; offen. „wartet auf“ aus dem Mermaid-Graphen.</span></div>${body}`;
  }

  /* ------------------------------------------------ Sammlungen & Synchronisation */
  function diffText(d) {
    if (!d) return '—';
    const p = [];
    if (d.coverChanged) p.push(`${d.coverChanged} Cover`);
    if (d.added) p.push(`+${d.added}`);
    if (d.removed) p.push(`−${d.removed}`);
    if (d.reordered) p.push('Reihenfolge');
    if (d.meta) p.push('Text');
    return p.length ? p.join(' · ') : 'gleich';
  }
  function vSync() {
    const s = D.sync, r = s.remote;
    const remoteState = r.publishRoute === 'skipped' ? `<span class="tag warn">nicht gefragt</span>` : r.drafts === null ? `<span class="tag warn">Entwürfe unbekannt</span>` : `<span class="tag ok">${r.drafts} Entwürfe gelesen</span>`;
    const pubState = r.publishRoute === 'ok' ? `<span class="tag ok">${r.content} veröffentlichte Entwürfe, ${r.switches} Schalter</span>` : r.publishRoute === 'missing' ? '<span class="tag warn">Lese-Route fehlt in Produktion</span>' : '<span class="tag warn">Schalter unbekannt</span>';
    const copies = s.copies.map(c => `<tr><td class="small">${esc(c.checkout)}${c.chosen ? ' <span class="tag ok">Arbeitsdatei</span>' : ''}</td><td class="small muted">${esc(c.mtime)}</td><td class="small">${c.sameAsProduction ? '<span class="tag ok">= Produktion</span>' : '<span class="tag warn">weicht ab</span>'}${c.dirty ? ' <span class="tag warn">nicht committet</span>' : ''}${c.unpushed ? ` <span class="tag warn">${c.unpushed} Commit(s) nicht in Produktion</span>` : ''}</td></tr>`).join('');
    const rows = s.rows.filter(x => matches(x.slug + ' ' + x.title)).map(x => {
      const drafts = x.drafts.map(d => `<div class="small"><b>${d.count}</b> · ${esc(d.by || 'ohne Namen')} · ${esc((d.updatedAt || '').slice(0, 10))}${d.importedOn ? ` · übernommen ${esc(d.importedOn)}` : ''}${d.publishedOn ? ' · veröffentlicht' : ''}<div class="muted">zur Datei: ${esc(diffText(d.vsFile))}</div></div>`).join('') || '<span class="muted small">—</span>';
      const content = x.content === 'unknown' ? '<span class="muted small">?</span>' : x.content ? `<b>${x.content.count}</b><div class="muted small">zu Prod: ${esc(diffText(x.content.vsProduction))}</div>` : '<span class="muted small">—</span>';
      const sw = x.switchValue === 'unknown' ? '<span class="muted small">?</span>' : x.switchValue === null ? '<span class="muted small">—</span>' : `<span class="tag warn">${x.switchValue ? 'an' : 'aus'}</span>`;
      const live = x.live ? `${x.live.published ? '<span class="tag ok">sichtbar</span>' : '<span class="tag">Entwurf</span>'} ${x.live.count}<div class="muted small">aus ${esc(x.live.from)}</div>` : '<span class="muted small">?</span>';
      const verdicts = x.verdicts.map(v => `<div class="hint"><span class="ico ${v.level === 'act' ? '' : v.level}">${v.level === 'act' ? '!' : v.level === 'ok' ? '✓' : 'i'}</span><div class="small">${esc(v.text)}</div></div>`).join('');
      return `<tr><td><b class="mono small">/${esc(x.slug)}</b><div class="small">${esc(x.title)}</div></td>
        <td class="small">${x.production ? `${x.production.count} · ${x.production.published ? 'veröff.' : 'Entwurf'}` : '<span class="muted">—</span>'}</td>
        <td class="small">${x.local ? `${x.local.count} · ${x.local.published ? 'veröff.' : 'Entwurf'}<div class="muted">zu Prod: ${esc(diffText(x.local.vsProduction))}</div>` : '<span class="muted">—</span>'}</td>
        <td class="d">${drafts}</td><td>${content}</td><td>${sw}</td><td>${live}</td><td class="v">${verdicts}</td></tr>`;
    }).join('');
    const lists = s.lists.map(l => `<tr><td class="small">${fileA(l.file)}</td><td class="small">${l.slug ? '/' + esc(l.slug) : '—'}<div class="muted">${esc(l.slugSource)}</div></td><td class="small">${l.entries}</td><td class="small">${l.skipped}</td></tr>`).join('');
    return topbar('Sammlungen &amp; Synchronisation', 'Vier Ebenen je Sammlung: Datei in Produktion und auf dieser Maschine, Online-Entwürfe, veröffentlichte Entwürfe und Schalter im Redis, Reihenlisten. Unbekanntes heißt „?“, nie „leer“.') +
      `<div class="grid2" style="margin-top:.6rem"><div class="box scroll"><h3>Datei <code>data/collections.json</code> ${src('git + Dateisystem')}</h3>
        <div class="small">Produktion (${esc(D.production.ref)}): ${s.productionFile.count ?? '?'} Sammlungen · zuletzt geändert ${esc(s.productionFile.lastChange || '?')}</div>
        <table style="margin-top:.4rem"><tr><th>Kopie</th><th>geändert</th><th>Stand</th></tr>${copies}</table>
        <div class="small muted" style="margin-top:.4rem">Die Arbeitsdatei ist die zuletzt geschriebene Kopie: die Sammlungs-App und die Skripte schreiben in den Ordner, aus dem sie gestartet wurden.</div></div>
      <div class="box"><h3>Produktion ${src('GET /api/curate/drafts, GET /api/curate/publish')}</h3>
        <div class="small">gelesen ${esc(when(r.at))} von ${esc(r.origin)} ${remoteState} ${pubState}</div>
        ${r.notes.map(n => `<div class="hint"><span class="ico info">i</span><div class="small">${esc(n)}</div></div>`).join('')}
        <div class="small muted" style="margin-top:.4rem">Einmal je Erzeugung, nie in einer Schleife (Bot-Schutz von Vercel). ${S ? '' : 'Neu lesen geht nur über <code>npm run cockpit</code>.'}</div>
        ${S ? '<div class="btnrow" style="margin-top:.5rem"><button class="btn" data-refresh-remote>Produktion neu lesen</button></div>' : ''}</div></div>
      <h2>Je Sammlung</h2>
      <div class="box scroll sync"><table><tr><th>Sammlung</th><th>Datei Prod</th><th>Datei lokal</th><th>Online-Entwürfe</th><th>veröff. Entwurf</th><th>Schalter</th><th>auf der Seite</th><th>Urteil</th></tr>${rows}</table></div>
      <h2>Reihenlisten ${src('lab/collections/lists/*.json')}</h2>
      <div class="box scroll"><table><tr><th>Liste</th><th>speist</th><th>Einträge</th><th>skip</th></tr>${lists}</table>
      <div class="small muted" style="margin-top:.4rem">Ein Neubau mit <code>from-isbns.ts</code> schreibt die Werke der Sammlung neu und behält nur Einleitung und „published“ — Handänderungen und übernommene Entwürfe gehen dabei verloren.</div></div>`;
  }

  /* --------------------------------------------------------------- Werkzeuge */
  function toolCard(t) {
    const st = toolState[t.id] || {};
    const l = t.port ? D.listeners[t.port] : null;
    const other = l && l.script && t.file && t.file !== 'package.json' && !l.script.includes(t.file);
    const up = upState(t);
    const conflict = D.portConflicts.find(c => c.port === t.port && t.kind === 'server');
    const dot = t.kind === 'online' ? '<span class="dot na" title="online, nicht geprüft"></span>' : t.kind === 'oneshot' ? '' : `<span class="dot ${up ? 'up' : up === null ? 'na' : ''}"></span>`;
    const stText = t.kind === 'online' ? 'online · Passwort der Freunde' : t.kind === 'oneshot' ? (st.running ? 'läuft …' : st.exit != null ? `beendet (Code ${st.exit})` : 'läuft einmal und endet') : up ? `läuft auf :${t.port}${st.running ? ' (vom Cockpit gestartet)' : l ? ` aus ${l.checkout}` : ''}` : other ? `:${t.port} belegt von ${l.script} (${l.checkout})` : up === null ? `:${t.port} — Status unbekannt` : `aus · :${t.port}`;
    const canRun = S && t.argv;
    const buttons = [
      canRun && t.kind === 'server' && !up && !st.running ? `<button class="btn primary" data-start="${esc(t.id)}">Starten</button>` : '',
      canRun && t.kind === 'oneshot' && !st.running ? `<button class="btn primary" data-start="${esc(t.id)}">Ausführen</button>` : '',
      S && st.running ? `<button class="btn" data-stop="${esc(t.id)}">Beenden</button>` : '',
      t.url ? `<a class="btn" href="${esc(t.url)}" target="_blank" rel="noopener">Öffnen ↗</a>` : '',
      t.display ? `<button class="btn" data-copy="${esc(t.display)}">Kopieren</button>` : '',
    ].join('');
    return `<div class="tool"><h3>${dot}${esc(t.name)}</h3><div class="small muted">${esc(stText)}</div>
      <div class="small">${esc(t.why)}</div>
      ${t.display ? `<div class="cmd"><code>${esc(t.display)}</code></div>` : ''}
      <div class="btnrow">${buttons}${t.items.map(itemA).join(' ')}${t.warn ? `<span class="tag warn">${esc(t.warn)}</span>` : ''}${conflict ? `<span class="tag warn">Port ${conflict.port} doppelt</span>` : ''}${t.copyOnly && !t.warn ? `<span class="tag">${esc(t.copyOnly)}</span>` : ''}${t.envFromLocal ? `<span class="tag" title="aus der .env.local des Hauptordners in den Prozess, nie in die Seite">${esc(t.envFromLocal.join(', '))} aus .env.local</span>` : ''}</div>
      ${t.file ? `<div class="small">${fileA(t.file)}</div>` : ''}
      ${st.output ? `<pre class="out" data-out="${esc(t.id)}">${esc(st.output)}</pre>` : ''}</div>`;
  }
  function vTools() {
    const groups = [...new Set(D.tools.map(t => t.group))];
    const running = D.tools.filter(t => upState(t) && !t.id.endsWith('-remote'));
    return topbar('Werkzeuge', 'aus package.json und der Usage-Zeile jedes Skripts · Status: Port-Abfrage' + (S ? ', alle paar Sekunden' : ' beim Erzeugen')) +
      `<div class="box" style="margin:.6rem 0 1rem"><b>Läuft gerade:</b> ${running.map(t => `<span class="tag"><span class="dot up" style="margin-right:.3rem"></span>${esc(t.name)} :${t.port}</span>`).join(' ') || 'nichts'}
      <div class="small muted" style="margin-top:.4rem">${S ? 'Das Cockpit läuft als lokaler Server (nur 127.0.0.1, mit Token): „Starten“ und „Ausführen“ starten nur Befehle aus diesem Katalog, „Beenden“ nur, was das Cockpit selbst gestartet hat.' : 'Als Datei geöffnet: nur Kopieren und Öffnen. Mit <code>npm run cockpit</code> kommen Starten, Beenden und die Ausgabe dazu.'}</div></div>` +
      groups.map(g => {
        const rows = D.tools.filter(t => t.group === g && matches(t.name + ' ' + t.why + ' ' + t.display));
        return rows.length ? `<h2>${esc(g)}</h2><div class="toolgrid">${rows.map(toolCard).join('')}</div>` : '';
      }).join('');
  }

  /* ------------------------------------------------- Dienste & Einstellungen */
  function vServices() {
    const yes = v => v === true ? '<span class="pill st-done">gesetzt</span>' : v === false ? '<span class="muted small">—</span>' : '<span class="pill st-julian">?</span>';
    const svc = D.services.filter(x => matches(x.name + x.use)).map(x => `<tr><td><b>${esc(x.name)}</b><div class="small muted">${esc(x.kind)}</div></td><td class="small">${esc(x.use)}</td><td class="small">${esc(x.limits)}</td><td class="small">${x.code.map(c => fileA(c)).join('<br>')}<div>${x.items.map(itemA).join(' ')}</div><div class="muted">${esc(x.src)}</div></td></tr>`).join('');
    const set = D.settings.filter(r => matches(r.name + ' ' + r.what)).map(r => `<tr><td class="mono small"><b>${esc(r.name)}</b></td><td class="small">${esc(r.what)}</td>
      <td class="small">${r.secret ? (r.local ? (S ? `<span class="mono" data-secret-out="${esc(r.name)}">•••••••</span> <button class="btn" data-reveal="${esc(r.name)}">zeigen</button>` : '<span class="mono">•••••••</span> <span class="muted">nur über npm run cockpit</span>') : '<span class="muted">—</span>') : (r.local ? (S ? `<span class="mono" data-secret-out="${esc(r.name)}"></span> <button class="btn" data-reveal="${esc(r.name)}">zeigen</button>` : '<span class="muted">in .env.local</span>') : '<span class="muted">—</span>')}</td>
      <td>${yes(r.local)}</td><td>${yes(r.production)}</td><td>${yes(r.preview)}</td><td class="small">${r.readIn.map(p => fileA(p)).join('<br>')}</td></tr>`).join('');
    const checks = D.envChecks.map(c => `<div class="hint"><span class="ico ${c.level === 'act' ? '' : c.level}">${c.level === 'act' ? '!' : c.level === 'ok' ? '✓' : 'i'}</span><div class="small">${esc(c.text)}</div></div>`).join('');
    return topbar('Dienste &amp; Einstellungen', 'Variablen aus .env.example, env.X im Code, der .env.local des Hauptordners (nur Namen) und <code>vercel env ls</code> (nur Namen und Umgebungen, nie Werte)') +
      `<div class="box" style="margin:.6rem 0 1rem;border-color:var(--warn)"><b>Geheimnisse.</b> Kein Wert steht in dieser Datei. „zeigen“ holt ihn beim lokalen Server (nur 127.0.0.1, mit Token) aus der <code>.env.local</code> des Hauptordners. Werte aus Vercel werden nie gelesen.</div>
      <h2>Dienste ${src('scripts/cockpit/services.ts, belegt in CLAUDE.md und SPEC')}</h2><div class="box scroll"><table><tr><th>Dienst</th><th>wofür</th><th>Grenzen</th><th>Code · Punkte · Quelle</th></tr>${svc}</table></div>
      <h2>Variablen und Schalter</h2><div class="box scroll"><table><tr><th>Name</th><th>was es tut (.env.example)</th><th>Wert</th><th>lokal</th><th>Prod</th><th>Preview</th><th>gelesen in</th></tr>${set}</table>
      <div class="small muted" style="margin-top:.4rem">„?“ heißt: nicht feststellbar (${D.vercelKnown ? '' : 'vercel env ls lief nicht; '}keine .env.local?) — nie geraten.</div></div>
      <h2>Prüfungen ohne Wert</h2><div class="box">${checks}</div>`;
  }

  /* --------------------------------------------------------------- Funktionen */
  function vFeatures() {
    return topbar('Funktionen', `aus docs/features.md (Stand-Zeile ${esc(D.features.stand || '?')}, jüngste Zeile ${esc(D.features.latest || '?')})`) +
      D.features.sections.map(sec => {
        const rows = sec.rows.filter(r => matches([r.feature, r.roadmap, r.code.join(' ')].join(' ')));
        if (!rows.length) return '';
        return `<h2>${esc(sec.title)}</h2><div class="box scroll"><table><tr><th>Funktion</th><th>seit</th><th>Spec</th><th>Roadmap</th><th>Code</th></tr>` +
          rows.map(r => `<tr><td class="small">${esc(r.feature.replace(/\*\*/g, ''))}</td><td class="muted small">${esc(r.since)}</td><td class="small">${esc(r.spec)}</td><td class="small">${(r.roadmap.match(/\d+\.\d+[a-z]?/g) || []).map(itemA).join(' ') || esc(r.roadmap)}</td><td class="small">${r.code.map(c => { const p = c.replace(/ .*/, ''); return /\//.test(p) ? fileA(p) : `<code>${esc(c)}</code>`; }).join('<br>')}</td></tr>`).join('') + '</table></div>';
      }).join('');
  }

  /* ------------------------------------------------------------ Website-Karte */
  function vSite() {
    const kinds = [['page', 'Seiten'], ['route', 'Weitere Routen'], ['api', 'Schnittstellen']];
    return topbar('Website-Karte', 'aus app/**/page.tsx und route.ts: Zustände aus loading.tsx, notFound(), Statuscodes; Komponenten aus den Imports; APIs aus den Aufrufen') +
      kinds.map(([k, label]) => {
        const rs = D.site.filter(r => r.kind === k && matches(r.route + ' ' + r.what + ' ' + r.components.join(' ')));
        if (!rs.length) return '';
        return `<h2>${label}</h2><div class="box scroll"><table><tr><th>Route</th><th>was</th><th>Zustände</th><th>fragt</th></tr>` +
          rs.map(r => `<tr class="click" data-route="${esc(r.route)}"><td class="mono small"><b>${esc(r.route)}</b>${r.methods.length ? `<div class="muted">${esc(r.methods.join(' '))}</div>` : ''}</td><td class="small">${esc(r.what)}</td><td class="small">${r.states.map(s => `<span class="tag">${esc(s)}</span>`).join('')}</td><td class="small mono">${esc(r.apis.join(' '))}</td></tr>`).join('') + '</table></div>';
      }).join('');
  }

  /* -------------------------------------------------------------------- Lab */
  function vLab() {
    const cards = D.lab.filter(l => matches(l.name + l.gist + l.status)).map(l => `<div class="labcard" data-lab="${esc(l.name)}"><h3>lab/${esc(l.name)}/</h3><div class="small">${esc(l.gist.slice(0, 260))}</div>
      <div class="meta" style="margin-top:.45rem;display:flex;gap:.3rem;flex-wrap:wrap">${l.status ? `<span class="tag">${esc(l.status.replace(/\*\*/g, '').slice(0, 60))}</span>` : ''}${l.items.map(itemA).join(' ')}${l.port ? `<span class="tag mono">:${l.port}</span>` : ''}${l.hasReadme ? '' : '<span class="tag warn">kein README</span>'}${l.inTable ? '' : '<span class="tag warn">nicht in lab/README.md</span>'}</div></div>`).join('');
    const planned = D.labTableOnly.map(r => `<tr><td class="mono small">lab/${esc(r.folder)}/</td><td class="small">${esc(r.question)}</td><td class="small">${r.items.map(itemA).join(' ')}</td><td class="small muted">${esc(r.status)}</td></tr>`).join('');
    const ideas = D.ideas.map(i => `<tr><td class="small">${esc(i.idea.replace(/\*\*/g, ''))}</td><td class="small muted">${esc(i.uses.replace(/`/g, ''))}</td></tr>`).join('');
    return topbar('Lab', 'aus lab/*/ (Ordner, README, serve.ts-Port) und der Tabelle in lab/README.md') +
      `<h2 style="margin-top:.6rem">Experimente</h2><div class="cardgrid">${cards}</div>` +
      (planned ? `<h2>Gelistet, Ordner noch nicht angelegt</h2><div class="box scroll"><table>${planned}</table></div>` : '') +
      (ideas ? `<h2>Ideen, unbewertet ${src('ROADMAP.md › Ideen')}</h2><div class="box scroll"><table><tr><th>Idee</th><th>nutzt</th></tr>${ideas}</table></div>` : '');
  }

  /* ---------------------------------------------------------------- Artefakte */
  function vArtefacts() {
    const plans = D.plans.map(p => `<li><span>${fileA('docs/plans/' + p.file)}</span><span class="muted small" style="text-align:right">${p.open ? '<span class="tag warn">offen</span> ' : ''}${esc(p.state.replace(/\*\*/g, '').slice(0, 120))}</span></li>`).join('');
    return topbar('Artefakte', 'Steuerung, Pläne, Recherchen, Testberichte, Daten und erzeugte Ansichten — aus dem Dateisystem') +
      `<h2>Pläne ${src('docs/plans/README.md')}</h2><div class="box"><ul class="linklist">${plans}</ul></div>` +
      D.artefacts.map(g => {
        const rows = g.rows.filter(r => matches(r.name + ' ' + r.note));
        return rows.length ? `<h2>${esc(g.group)}</h2><div class="box"><ul class="linklist">${rows.map(r => `<li><span>${r.local ? `<a href="${esc(local(r.path))}"><code>${esc(r.name)}</code></a> <span class="localonly">nur lokal</span>` : fileA(r.path)}</span><span class="muted small" style="text-align:right">${esc(r.note)}</span></li>`).join('')}</ul></div>` : '';
      }).join('');
  }

  /* ------------------------------------------------------------------ Drawers */
  function openDrawer(html) {
    $('#drawer').innerHTML = '<button class="close" id="close">Schließen ✕</button>' + html;
    $('#drawer').classList.add('on'); $('#scrim').classList.add('on'); $('#drawer').scrollTop = 0;
  }
  function closeDrawer() { $('#drawer').classList.remove('on'); $('#scrim').classList.remove('on'); }

  function itemDrawer(n) {
    const x = BYNUM[n];
    if (!x) return;
    const a = x.assessment;
    const blocks = D.items.filter(y => y.waitsOn.includes(n));
    const hints = D.hints.filter(h => h.item === n);
    openDrawer(`<div class="crumbs">Brett › ${esc(thName(x.theme))} › ${esc(stName(x.status))}</div>
      <h1><span class="num" style="font-size:1rem">${esc(x.num)}</span> ${esc(x.title)}</h1>
      <div style="margin:.4rem 0">${pill(x.status)} ${who(x.owner)}</div>
      ${hints.map(hintRow).join('')}
      <dl class="facts">
        <dt>Phase</dt><dd>${esc(x.phase)}${x.group ? ' · ' + esc(x.group) : ''}</dd>
        <dt>Thema</dt><dd>${esc(thName(x.theme))} ${src(x.themeSource)}</dd>
        <dt>Wer</dt><dd>${esc(x.owner)} ${src(x.ownerSource)}</dd>
        <dt>Urteil</dt><dd>${esc(a ? a.verdictRaw : '—')} ${src('Bewertung')}</dd>
        <dt>Aufwand</dt><dd>${esc(a && a.effort ? a.effort : '—')}</dd>
        <dt>Warum</dt><dd>${esc(a ? a.why.replace(/\*\*/g, '') : '—')}</dd>
        <dt>Wartet auf</dt><dd>${x.waitsOn.map(w => BYNUM[w] ? `<a href="#item/${esc(w)}">${esc(w)} ${esc(BYNUM[w].title)}</a> ${pill(BYNUM[w].status)}` : esc(w)).join('<br>') || '—'} ${x.waitsOn.length ? src('Mermaid-Graph') : ''}</dd>
        <dt>Hält auf</dt><dd>${blocks.map(y => `<a href="#item/${esc(y.num)}">${esc(y.num)} ${esc(y.title)}</a>`).join('<br>') || '—'}</dd>
      </dl>
      ${x.work.map(w => `<h3>Branch ${src('git log origin/main..branch')}</h3><div class="mono small">${esc(w.branch)}</div><ul class="linklist">${w.commits.map(c => `<li><span class="small">${esc(c.subject)}</span><span class="muted small mono">${esc(c.hash)} ${esc(c.date)}</span></li>`).join('')}</ul>`).join('')}
      <h3>Dateien ${src('Pfade in Backticks im Punkt')}</h3><ul class="linklist">${x.files.map(f => `<li>${fileA(f)}</li>`).join('') || '<li class="muted">keine genannt</li>'}</ul>
      <h3>Historie ${src('docs/history.md')}</h3><ul class="linklist">${x.history.map(h => `<li><a href="${esc(gh('docs/history.md', h.line))}" target="_blank" rel="noopener">${esc(h.date)} · ${esc(h.title.replace(/\*/g, ''))}</a></li>`).join('') || '<li class="muted">noch kein Eintrag</li>'}</ul>
      ${x.plans.length ? `<h3>Plan</h3><ul class="linklist">${x.plans.map(p => `<li>${fileA('docs/plans/' + p)}</li>`).join('')}</ul>` : ''}
      <h3>Voller Text ${src('ROADMAP.md')}</h3><div class="body small">${x.bodyHtml}</div>
      <ul class="linklist"><li><a href="${esc(gh('ROADMAP.md', x.line))}" target="_blank" rel="noopener">ROADMAP.md, Zeile ${x.line}</a><span class="muted small">bearbeiten = Karte bewegen</span></li></ul>`);
  }

  function routeDrawer(route) {
    const r = D.site.find(y => y.route === route);
    if (!r) return;
    const ex = r.example;
    openDrawer(`<div class="crumbs">Website-Karte › ${esc(r.kind)}</div><h1 class="mono" style="font-size:1.2rem">${esc(r.route)}</h1>
      <p>${esc(r.what)}</p>
      <dl class="facts">
        <dt>Datei</dt><dd>${fileA(r.file)}</dd>
        <dt>Öffnen</dt><dd>${ex ? `<a href="${DEV}${esc(ex)}" target="_blank" rel="noopener">localhost:3000${esc(ex)}</a> · <a href="${LIVE}${esc(ex)}" target="_blank" rel="noopener">live</a> <span class="muted small">(live nur einmal nach einem Deploy)</span>` : '<span class="muted">braucht einen Parameter</span>'}</dd>
        <dt>Zustände</dt><dd>${r.states.map(s => `<span class="tag">${esc(s)}</span>`).join('') || '—'}</dd>
        <dt>Komponenten</dt><dd>${r.components.map(c => `<code>${esc(c)}</code>`).join(' ') || '—'}</dd>
        <dt>Fragt</dt><dd class="small mono">${esc(r.apis.join(' ')) || '—'}</dd>
        ${r.methods.length ? `<dt>Methoden</dt><dd>${esc(r.methods.join(', '))}</dd>` : ''}
      </dl>
      ${r.kind === 'page' ? `<h3>Bildschirmfoto ${src('auf Anfrage, vom Dev-Server')}</h3>${!r.shot ? '<p class="small muted">Nie automatisch: eine kalte Werkseite kostet eine Google-Anfrage aus dem Betriebskontingent, solange 0.2 offen ist.</p>' : !ex ? '<p class="small muted">Die Route braucht einen Parameter; öffne eine Beispielseite von Hand.</p>' : S ? `<div class="btnrow"><button class="btn" data-shot="${esc(ex)}" data-width="1280">1280 × 800</button><button class="btn" data-shot="${esc(ex)}" data-width="500">Telefon (500 × 900)</button></div><div class="small muted">Der Dev-Server muss auf :3000 laufen. Headless-Chrome rendert nicht schmaler als 500 px. Bilder liegen git-ignoriert unter docs/cockpit/shots/.</div><div data-shot-out></div>` : '<p class="small muted">Nur über npm run cockpit.</p>'}` : ''}`);
  }

  function labDrawer(name) {
    const l = D.lab.find(x => x.name === name);
    if (!l) return;
    const tools = D.tools.filter(t => t.file && t.file.startsWith(`lab/${name}/`));
    openDrawer(`<div class="crumbs">Lab</div><h1 class="mono">lab/${esc(name)}/</h1><p>${esc(l.gist)}</p>
      <dl class="facts"><dt>Stand</dt><dd>${esc(l.status.replace(/\*\*/g, '') || '—')} ${src('lab/README.md')}</dd>
      <dt>README</dt><dd>${l.hasReadme ? fileA(`lab/${name}/README.md`) : '<span class="tag warn">fehlt</span>'}</dd>
      <dt>Roadmap</dt><dd>${l.items.map(n => BYNUM[n] ? `<a href="#item/${esc(n)}">${esc(n)} ${esc(BYNUM[n].title)}</a> ${pill(BYNUM[n].status)}` : esc(n)).join('<br>') || '—'}</dd></dl>
      ${tools.length ? `<h3>Werkzeuge</h3><div class="toolgrid">${tools.map(toolCard).join('')}</div>` : ''}`);
  }

  /* ------------------------------------------------------------------ Wiring */
  const VIEWS = { home: vHome, board: vBoard, sync: vSync, tools: vTools, services: vServices, features: vFeatures, site: vSite, lab: vLab, artefacts: vArtefacts, hints: vHints };
  function render() {
    $('#main').innerHTML = VIEWS[view]();
    document.querySelectorAll('nav.side button[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === view));
    const qi = $('#q');
    if (qi) qi.oninput = e => { q = e.target.value.toLowerCase().trim(); const pos = e.target.selectionStart; render(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
  }
  function counts() {
    $('#c-board').textContent = D.items.filter(x => !x.done).length;
    const act = D.sync.rows.filter(r => r.verdicts.some(v => v.level === 'act')).length;
    $('#c-sync').textContent = act || '';
    $('#c-sync').classList.toggle('warn', act > 0);
    $('#c-tools').textContent = D.tools.filter(t => upState(t) && !t.id.endsWith('-remote')).length + ' laufen';
    $('#c-site').textContent = D.site.filter(r => r.kind === 'page').length;
    $('#c-lab').textContent = D.lab.length;
    $('#c-feat').textContent = D.features.sections.reduce((a, s) => a + s.rows.length, 0);
  }
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 3200); }

  async function api(p, body) {
    const res = await fetch(p, { method: body ? 'POST' : 'GET', headers: { 'x-cockpit-token': S.token, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || String(res.status));
    return data;
  }

  document.addEventListener('click', async e => {
    const c = e.target.closest('[data-copy],[data-start],[data-stop],[data-reveal],[data-refresh-remote],[data-shot]');
    if (c) {
      e.preventDefault();
      try {
        if (c.dataset.copy) { await navigator.clipboard.writeText(c.dataset.copy).catch(() => {}); toast('Kopiert: ' + c.dataset.copy); }
        else if (c.dataset.start) { await api('/api/run', { id: c.dataset.start }); toolState[c.dataset.start] = { running: true, output: '' }; render(); }
        else if (c.dataset.stop) { await api('/api/stop', { id: c.dataset.stop }); }
        else if (c.dataset.reveal) {
          const out = document.querySelector(`[data-secret-out="${CSS.escape(c.dataset.reveal)}"]`);
          if (c.dataset.shown) { out.textContent = '•••••••'; delete c.dataset.shown; c.textContent = 'zeigen'; return; }
          const r = await api('/api/secret?name=' + encodeURIComponent(c.dataset.reveal));
          out.textContent = r.value; c.dataset.shown = '1'; c.textContent = 'verbergen';
        } else if (c.hasAttribute('data-refresh-remote')) { c.disabled = true; toast('Frage Produktion …'); await api('/api/refresh-remote', {}); }
        else if (c.dataset.shot) {
          const box = document.querySelector('[data-shot-out]');
          box.innerHTML = '<p class="small muted">Bild wird gemacht …</p>';
          const r = await api('/api/shot', { path: c.dataset.shot, width: Number(c.dataset.width) });
          box.innerHTML = `<img class="shot" src="${esc(r.url)}?t=${S.token}" alt="Bildschirmfoto ${esc(c.dataset.shot)}"><div class="small muted">${esc(r.file)}</div>`;
        }
      } catch (err) { toast('Nicht gegangen: ' + err.message); }
      return;
    }
    const t = e.target.closest('[data-item],[data-route],[data-lab],[data-v],[data-seg] button,[data-showdone],#close,#scrim,#theme');
    if (!t) return;
    if (t.id === 'close' || t.id === 'scrim') { closeDrawer(); if (/^#(item|route|lab)\//.test(location.hash)) history.replaceState(null, '', '#' + view); return; }
    if (t.id === 'theme') { const r = document.documentElement; const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; r.dataset.theme = dark ? 'light' : 'dark'; try { localStorage.setItem('cockpit-theme', r.dataset.theme); } catch { /* private mode */ } return; }
    e.preventDefault();
    if (t.dataset.item) { location.hash = 'item/' + t.dataset.item; return; }
    if (t.dataset.route) { location.hash = 'route/' + t.dataset.route; return; }
    if (t.dataset.lab) { location.hash = 'lab/' + t.dataset.lab; return; }
    if (t.hasAttribute('data-showdone')) { showDone = true; render(); return; }
    if (t.dataset.v) { location.hash = t.dataset.v; return; }
    if (t.parentElement && t.parentElement.dataset.seg) {
      const k = t.parentElement.dataset.seg, v = t.dataset.val;
      if (k === 'mode') boardMode = v; if (k === 'owner') boardOwner = v; if (k === 'done') showDone = !showDone;
      render();
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

  /* Deep links: #board, #board/julian, #theme/samml, #item/6.23, #route//collections, #lab/isfdb, #sync … */
  function fromHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    const [k, ...rest] = h.split('/');
    const arg = rest.join('/');
    if (VIEWS[k]) {
      view = k; q = ''; closeDrawer();
      if (k === 'board' && arg) { boardMode = 'flat'; showDone = arg === 'done'; }
      render();
      if (k === 'board' && arg) window.scrollTo(0, 0);
      return;
    }
    if (k === 'theme') { view = 'board'; boardMode = 'theme'; render(); const el = document.getElementById('th-' + arg); if (el) el.scrollIntoView({ block: 'start' }); return; }
    if (!$('#main').innerHTML) render();
    if (k === 'item') itemDrawer(arg);
    else if (k === 'route') { if (view !== 'site') { view = 'site'; render(); } routeDrawer(arg); }
    else if (k === 'lab') { if (view !== 'lab') { view = 'lab'; render(); } labDrawer(arg); }
    else render();
  }
  window.addEventListener('hashchange', fromHash);
  try { const th = localStorage.getItem('cockpit-theme'); if (th) document.documentElement.dataset.theme = th; } catch { /* private mode */ }
  counts();
  fromHash();

  /* With the server: ports, tool output, and a reload when the files changed. */
  if (S) {
    const tick = async () => {
      try {
        const st = await api('/api/status');
        if (generation !== null && st.generation !== generation) { location.reload(); return; }
        generation = st.generation;
        const before = JSON.stringify([ports, toolState]);
        ports = st.ports;
        for (const [id, p] of Object.entries(st.processes)) toolState[id] = p;
        for (const id of Object.keys(toolState)) if (!st.processes[id]) delete toolState[id].running;
        if (JSON.stringify([ports, toolState]) !== before) {
          counts();
          if (view === 'tools' && !$('#drawer').classList.contains('on') && !document.activeElement.matches('#q')) render();
        }
      } catch (err) {
        // 403: the server was restarted with a new token. Stop asking; the page stays as generated.
        if (/Token|403/.test(err.message)) { clearInterval(timer); toast('Das Cockpit wurde neu gestartet — den neuen Link aus dem Terminal öffnen.'); }
      }
    };
    const timer = setInterval(tick, 3000);
    tick();
  }
})();
