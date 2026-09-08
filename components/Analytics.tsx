import Script from 'next/script';

/**
 * Vercel Web Analytics, loaded as the platform's own script rather than the
 * `@vercel/analytics` package: the package's optional SvelteKit peer drags
 * in a Vite that conflicts with vitest's, and the script is all the package
 * would inject anyway. Cookieless; visitors are a hash of the request that
 * is dropped after 24 hours (docs/recht-hobbyseite.md §4).
 *
 * Rendered only where the script exists, on Vercel — locally it would 404.
 *
 * `beforeSend` redacts the search query before a page view leaves the
 * browser. A title is rarely personal, but "my own name" typed into the box
 * would be, and the analytics need to know that a search happened, not for
 * what.
 */
export default function Analytics() {
  if (!process.env.VERCEL) return null;
  // The queue shim is a plain inline script so it runs during parsing, before
  // the deferred insights script; next/script's beforeInteractive is reserved
  // for pages/_document and the linter says so.
  const shim = `window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
window.va('beforeSend', function (event) {
  try {
    var url = new URL(event.url);
    if (url.searchParams.has('q')) { url.searchParams.set('q', 'redacted'); return Object.assign({}, event, { url: url.toString() }); }
  } catch (e) {}
  return event;
});`;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: shim }} />
      <Script src="/_vercel/insights/script.js" strategy="afterInteractive" />
    </>
  );
}
