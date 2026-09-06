/**
 * Debug logging, silent unless DEBUG is set (SPEC §4 N5).
 * Enable with `DEBUG=1 npm run dev` or `DEBUG=books`.
 */
const enabled = (() => {
  const v = process.env.DEBUG;
  return !!v && v !== '0' && v !== 'false';
})();

export function debug(scope: string, message: string, data?: unknown): void {
  if (!enabled) return;
  if (data === undefined) console.error(`[${scope}] ${message}`);
  else console.error(`[${scope}] ${message}`, data);
}
