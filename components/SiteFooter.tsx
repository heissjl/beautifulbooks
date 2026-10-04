import SiteFooterView from '@/components/SiteFooterView';
import { wallsEnabled } from '@/lib/walls/switch';

/**
 * The same footer under every page (SPEC F6). The words are in
 * `SiteFooterView`; this wrapper only reads the walls switch, which lives in
 * server variables.
 *
 * `walls` must be passed by a client component (the book page): in the
 * browser the switch cannot read its variables and would say "on".
 */
export default function SiteFooter({ walls }: { walls?: boolean } = {}) {
  return <SiteFooterView walls={walls ?? wallsEnabled()} />;
}
