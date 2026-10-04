/**
 * Bluesky's proof that the account @buyitscovers.com belongs to this domain
 * (docs/domain-recherche.md §22). Bluesky asks for this file when the handle
 * is set to the domain and keeps asking now and then, so it must stay. The
 * value is the account's DID, which is public; it changes only if the account
 * is deleted and made again.
 */
const BLUESKY_DID = 'did:plc:5kqatm7r3zvyoxykuorrabia';

export const dynamic = 'force-static';

export function GET() {
  return new Response(BLUESKY_DID, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
