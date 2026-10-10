/**
 * The security headers (ROADMAP 2.12, lib/securityheaders.ts) and what of a
 * CSP report reaches the log (lib/cspreport.ts).
 */
import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, securityHeaders } from '../securityheaders';
import { cspReportLine, hostOf, pathOf } from '../cspreport';

describe('securityHeaders', () => {
  const byKey = Object.fromEntries(securityHeaders().map(h => [h.key, h.value]));

  it('sends the five headers and the report-only policy', () => {
    expect(byKey['X-Content-Type-Options']).toBe('nosniff');
    expect(byKey['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(byKey['X-Frame-Options']).toBe('DENY');
    expect(byKey['Permissions-Policy']).toContain('camera=()');
    expect(byKey['Content-Security-Policy-Report-Only']).toContain("frame-ancestors 'none'");
    // Report-only until a week of reports has been read: never the enforcing header yet.
    expect(byKey['Content-Security-Policy']).toBeUndefined();
  });

  it('lets the browser load covers from the two catalogues and nothing else foreign', () => {
    const img = contentSecurityPolicy().split('; ').find(d => d.startsWith('img-src'))!;
    expect(img).toContain('https://covers.openlibrary.org');
    expect(img).toContain('https://*.archive.org');
    expect(img).toContain('https://books.google.com');
    expect(contentSecurityPolicy()).toContain("frame-src 'none'");
    expect(contentSecurityPolicy()).toContain('report-uri /api/csp');
  });

  it("allows eval only in development, where Turbopack needs it", () => {
    expect(contentSecurityPolicy()).not.toContain('unsafe-eval');
    expect(contentSecurityPolicy({ dev: true })).toContain('unsafe-eval');
  });
});

describe('cspReportLine', () => {
  it('keeps directive, blocked host and page path from a report-uri report, never the query', () => {
    const line = cspReportLine(JSON.stringify({
      'csp-report': {
        'document-uri': 'https://buyitscovers.com/?q=secret+search',
        'effective-directive': 'img-src',
        'blocked-uri': 'https://evil.example/pixel.gif?u=123',
        'source-file': 'https://buyitscovers.com/_next/static/x.js',
        'line-number': 12,
      },
    }));
    expect(JSON.parse(line!)).toEqual({ directive: 'img-src', blocked: 'evil.example', path: '/' });
    expect(line).not.toContain('secret');
    expect(line).not.toContain('123');
  });

  it('reads the Reporting API shape too', () => {
    const line = cspReportLine(JSON.stringify([{
      type: 'csp-violation',
      body: { documentURL: 'https://buyitscovers.com/book/OL1W', effectiveDirective: 'script-src', blockedURL: 'inline' },
    }]));
    expect(JSON.parse(line!)).toEqual({ directive: 'script-src', blocked: 'inline', path: '/book/OL1W' });
  });

  it('answers nothing for junk', () => {
    expect(cspReportLine('not json')).toBeNull();
    expect(cspReportLine('{"x":1}')).toBeNull();
    expect(hostOf('')).toBe('');
    expect(pathOf('nope')).toBe('');
  });
});
