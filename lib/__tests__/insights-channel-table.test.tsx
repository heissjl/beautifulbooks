// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ChannelTable from '@/app/admin/insights/ChannelTable';
import { groupSocial } from '../insights/visits';

describe('the channel table on /admin/insights', () => {
  it('shows the social networks as one closed row with their sum, members only after a click', () => {
    const rows = [
      { entry: 'engine' as const, entries: 40, opened: 20, bookVisits: 30, bought: 10 },
      { entry: 'linkedin' as const, entries: 7, opened: 3, bookVisits: 6, bought: 2 },
      { entry: 'x' as const, entries: 12, opened: 6, bookVisits: 9, bought: 3 },
    ];
    const html = renderToStaticMarkup(<ChannelTable lines={groupSocial(rows)} />);
    expect(html).toContain('Soziale Netzwerke');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('>19<'); // 7 + 12 entries in the summed row
    expect(html).not.toContain('LinkedIn');
    expect(html).toContain('Suchmaschine');
  });
});
