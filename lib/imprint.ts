/**
 * The legal notice (Impressum) and the controller of the privacy notice
 * (docs/recht-hobbyseite.md §2.4, §3.3). Server only.
 *
 * Name, street, city and e-mail come from `IMPRINT_*` in the environment —
 * `.env.local` locally, the project settings on Vercel — and never from the
 * repository: the address is Julian's to publish, not the code's. § 18 Abs. 1
 * MStV asks for name and an address where post can be served; § 5 DDG adds
 * the e-mail. All four are required.
 *
 * Missing values are an error, not a blank: a legal notice with an empty
 * line is worse than a build that refuses. `npm run build` prerenders the
 * pages that read this, so a deployment without the variables fails there.
 */
export interface Imprint {
  name: string;
  street: string;
  city: string;
  email: string;
}

const KEYS = ['IMPRINT_NAME', 'IMPRINT_STREET', 'IMPRINT_CITY', 'IMPRINT_EMAIL'] as const;

export function readImprint(env: Record<string, string | undefined> = process.env): Imprint {
  const missing = KEYS.filter(k => !env[k]?.trim());
  if (missing.length > 0) {
    throw new Error(`Legal notice incomplete: set ${missing.join(', ')} (see .env.example)`);
  }
  return {
    name: env.IMPRINT_NAME!.trim(),
    street: env.IMPRINT_STREET!.trim(),
    city: env.IMPRINT_CITY!.trim(),
    email: env.IMPRINT_EMAIL!.trim(),
  };
}
