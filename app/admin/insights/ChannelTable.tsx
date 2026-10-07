'use client';

import { useState } from 'react';
import type { ChannelLine, ChannelRow } from '@/lib/insights/visits';
import { ORIGIN_NAMES, SOCIAL_NAME } from './names';

const nf = new Intl.NumberFormat('de-DE');
const pf = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 1 });

type Numbers = Omit<ChannelRow, 'entry'>;

function Cells({ r }: { r: Numbers }) {
  return (
    <>
      <td className="py-1.5 pr-2 text-right tabular-nums text-ink-2">{nf.format(r.entries)}</td>
      <td className="py-1.5 pr-2 text-right tabular-nums text-ink-2">{r.entries > 0 ? pf.format(r.opened / r.entries) : '–'}</td>
      <td className="py-1.5 pr-2 text-right tabular-nums text-ink-2">{nf.format(r.bookVisits)}</td>
      <td className="py-1.5 text-right tabular-nums text-ink-2">{r.bookVisits > 0 ? pf.format(r.bought / r.bookVisits) : '–'}</td>
    </>
  );
}

/**
 * The channels of K16 with the social networks summed into one row that a
 * click opens into its platforms (Julian, 2026-10-06: „kannst du hier alle als
 * eigene machen und per klick aufsummieren lassen?"). The sum comes from
 * `groupSocial`, so the row and its members always add up.
 */
export default function ChannelTable({ lines }: { lines: ChannelLine[] }) {
  const [open, setOpen] = useState(false);
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs text-ink-3">
          <th className="py-1.5 pr-2 font-normal">Kanal</th>
          <th className="py-1.5 pr-2 text-right font-normal">Einstiege</th>
          <th className="py-1.5 pr-2 text-right font-normal" title="Anteil der Einstiege, die ein Buch öffneten">→ Buch</th>
          <th className="py-1.5 pr-2 text-right font-normal">Buch&shy;besuche</th>
          <th className="py-1.5 text-right font-normal" title="Anteil der Buchbesuche mit Klick zum Händler">→ Händler</th>
        </tr>
      </thead>
      <tbody>
        {lines.map(line =>
          line.kind === 'row' ? (
            <tr key={line.row.entry} className="border-b border-line">
              <td className="py-1.5 pr-2 text-ink">{ORIGIN_NAMES[line.row.entry] ?? line.row.entry}</td>
              <Cells r={line.row} />
            </tr>
          ) : (
            [
              <tr key="social" className="border-b border-line">
                <td className="py-1.5 pr-2 text-ink">
                  <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} className="inline-flex items-center gap-1.5 hover:text-accent">
                    <span aria-hidden="true" className={`inline-block text-accent transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
                    {SOCIAL_NAME}
                    <span className="text-xs text-ink-3">({line.members.length})</span>
                  </button>
                </td>
                <Cells r={line.sum} />
              </tr>,
              ...(open
                ? line.members.map(m => (
                    <tr key={`social-${m.entry}`} className="border-b border-line bg-surface-2/50">
                      <td className="py-1 pl-6 pr-2 text-ink-2">{ORIGIN_NAMES[m.entry] ?? m.entry}</td>
                      <Cells r={m} />
                    </tr>
                  ))
                : []),
            ]
          ),
        )}
      </tbody>
    </table>
  );
}
