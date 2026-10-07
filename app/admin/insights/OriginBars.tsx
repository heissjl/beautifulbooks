'use client';

import { useState } from 'react';
import { SOCIAL_NAME } from './names';

const nf = new Intl.NumberFormat('de-DE');
const pf = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 1 });

type Bar = { label: string; value: number };

function Line({ bar, max, total, few, indent = false }: { bar: Bar; max: number; total: number; few: boolean; indent?: boolean }) {
  return (
    <>
      <span className="h-2.5">
        <span className={`block h-2.5 rounded-r ${indent ? 'bg-accent/60' : 'bg-accent'}`} style={{ width: `${(bar.value / max) * 100}%`, opacity: few ? 0.45 : 1 }} title={`${bar.label}: ${nf.format(bar.value)}`} />
      </span>
      <span className={`text-right tabular-nums ${few ? 'text-ink-3' : 'text-ink'}`}>{total > 0 ? pf.format(bar.value / total) : '—'}</span>
    </>
  );
}

/**
 * Where book visits came from, with the social networks as one bar that a
 * click opens into its platforms (2026-10-06). The bar stands even at 0 %:
 * left out, it looked as if the networks were not measured at all (Julian:
 * „ich sehe jetzt nur das hier").
 */
export default function OriginBars({ rows, social, total, few }: { rows: Bar[]; social: { value: number; members: Bar[] }; total: number; few: boolean }) {
  const [open, setOpen] = useState(false);
  const all = [...rows, { label: SOCIAL_NAME, value: social.value, isSocial: true }].sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...all.map(r => r.value));
  const grid = 'grid grid-cols-[7.5rem_1fr_4.5rem] items-center gap-2 text-sm sm:grid-cols-[9rem_1fr_5rem]';
  const counted = social.members.filter(m => m.value > 0);
  return (
    <div className="space-y-2">
      {all.map(r =>
        'isSocial' in r ? (
          <div key="social">
            <div className={grid}>
              <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} className="flex min-w-0 items-center gap-1 text-left text-ink-2 hover:text-accent">
                <span aria-hidden="true" className={`inline-block text-accent transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
                <span className="truncate">{r.label}</span>
              </button>
              <Line bar={r} max={max} total={total} few={few} />
            </div>
            {open && (
              <div className="mt-2 space-y-2">
                {counted.length === 0 ? (
                  <p className="pl-4 text-xs text-ink-3">Noch kein Besuch aus einem sozialen Netzwerk im Zeitraum.</p>
                ) : (
                  counted.map(m => (
                    <div key={m.label} className={grid}>
                      <span className="truncate pl-4 text-ink-3">{m.label}</span>
                      <Line bar={m} max={max} total={total} few={few} indent />
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          <div key={r.label} className={grid}>
            <span className="truncate text-ink-2">{r.label}</span>
            <Line bar={r} max={max} total={total} few={few} />
          </div>
        ),
      )}
    </div>
  );
}
