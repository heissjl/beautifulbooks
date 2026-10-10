/**
 * What of a browser's CSP violation report is worth a log line (ROADMAP 2.12).
 * Pure; the route at `/api/csp` calls it.
 *
 * A report names the page, the directive, what was blocked and where in the
 * code — and the browser sends it, not the reader. Kept: the directive, the
 * blocked address reduced to its host (or the keyword the browser uses for
 * inline code, `inline` / `eval`), and the page's path without its query, so
 * a search term or a board never lands in a log. Dropped: everything else.
 * Two shapes exist: the old `csp-report` object (`report-uri`) and the
 * newer Reporting API list (`report-to`); both are read.
 */
export const MAX_REPORT_BYTES = 4096;

interface Picked {
  directive: string;
  blocked: string;
  path: string;
}

export function cspReportLine(text: string): string | null {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  const picked = pick(body);
  return picked ? JSON.stringify(picked) : null;
}

function pick(body: unknown): Picked | null {
  if (Array.isArray(body)) return pick(body[0]);
  if (!body || typeof body !== 'object') return null;
  const r = body as Record<string, unknown>;
  // report-uri wraps it; report-to puts it under `body` with the type beside it.
  const report = (r['csp-report'] ?? r.body ?? r) as Record<string, unknown>;
  const directive = str(report['effective-directive'] ?? report.effectiveDirective ?? report['violated-directive'] ?? report.violatedDirective);
  const blocked = str(report['blocked-uri'] ?? report.blockedURL);
  const page = str(report['document-uri'] ?? report.documentURL);
  if (!directive) return null;
  return { directive: directive.slice(0, 40), blocked: hostOf(blocked), path: pathOf(page) };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** The host of a blocked address; the browser's keywords (`inline`, `eval`, `data`) stay as they are. */
export function hostOf(uri: string): string {
  if (!uri) return '';
  try {
    return new URL(uri).host.slice(0, 80);
  } catch {
    return uri.replace(/[^a-z0-9:.-]/gi, '').slice(0, 20);
  }
}

/** The page's path, never its query. */
export function pathOf(uri: string): string {
  if (!uri) return '';
  try {
    return new URL(uri).pathname.slice(0, 120);
  } catch {
    return '';
  }
}
