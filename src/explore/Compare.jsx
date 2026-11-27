import { useMemo, useState } from 'react';
import { compareYears } from '../../scripts/lib/compare.js';
import { Art } from '../components/Art.jsx';
import { useJson } from '../data/load.js';
import * as f from '../lib/format.js';
import { PERSONAS } from '../story/slides.jsx';
import { Card, Empty, StatTile } from './ui.jsx';

const signed = (n, unit = '') => (n == null ? '–' : `${n > 0 ? '+' : n < 0 ? '−' : '±'}${f.int(Math.abs(n))}${unit}`);

function Move({ row }) {
  const map = {
    up: ['▲', `up ${row.change}`, 'text-[#53c556]'],
    down: ['▼', `down ${-row.change}`, 'text-[#eb6263]'],
    same: ['=', 'same rank', 'text-[#9c9c9c]'],
    new: ['NEW', 'new entry', 'text-[#338ced]'],
  };
  const [icon, label, cls] = map[row.status];
  return (
    <span className={`inline-flex w-14 shrink-0 items-center justify-end gap-1 text-xs font-bold tabular-nums ${cls}`} aria-label={label}>
      <span aria-hidden="true">{icon}</span>
      {row.status === 'up' || row.status === 'down' ? Math.abs(row.change) : ''}
    </span>
  );
}

function RankColumn({ title, data, kind }) {
  return (
    <Card title={title}>
      <ol className="flex flex-col gap-1.5">
        {data.rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3 text-sm">
            <span className="w-6 text-right tabular-nums text-[#9c9c9c]">{r.rank}</span>
            <Art kind={kind} item={r} small round={kind === 'artists'} className="h-8 w-8 shrink-0 rounded" />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{r.name}</span>
              {r.artist && <span className="block truncate text-xs text-[#9c9c9c]">{r.artist}</span>}
            </span>
            <span className="hidden text-xs tabular-nums text-[#9c9c9c] sm:inline">{r.prevRank ? `was #${r.prevRank}` : ''}</span>
            <Move row={r} />
          </li>
        ))}
      </ol>
      {data.dropped.length > 0 && (
        <p className="mt-4 text-sm text-[#9c9c9c]">
          <span className="font-semibold text-[#efefef]">Dropped out:</span> {data.dropped.map((d) => `${d.name} (was #${d.prevRank})`).join(', ')}
        </p>
      )}
    </Card>
  );
}

function shiftSentences(c) {
  const out = [];
  const h = c.habits;
  if (h.centerHourShift && Math.abs(h.centerHourShift) >= 0.3) {
    const hrs = Math.abs(h.centerHourShift);
    const amt = hrs >= 1 ? `${f.one(hrs)} hours` : `${Math.round(hrs * 60)} minutes`;
    out.push(`Your listening day moved ${amt} ${h.centerHourShift > 0 ? 'later' : 'earlier'}.`);
  }
  if (h.persona[0] && h.persona[1] && h.persona[0] !== h.persona[1]) out.push(`You went from ${PERSONAS[h.persona[0]].name} to ${PERSONAS[h.persona[1]].name}.`);
  if (h.nightShareShift && Math.abs(h.nightShareShift) >= 2) out.push(`Night listening ${h.nightShareShift > 0 ? 'rose' : 'fell'} ${f.one(Math.abs(h.nightShareShift))} points.`);
  if (h.skipRateShift && Math.abs(h.skipRateShift) >= 2) out.push(`You skipped ${h.skipRateShift > 0 ? 'more' : 'less'}: ${f.one(Math.abs(h.skipRateShift))} points ${h.skipRateShift > 0 ? 'higher' : 'lower'} skip rate.`);
  if (h.avgSessionShift && Math.abs(h.avgSessionShift) >= 5) out.push(`Sessions got ${h.avgSessionShift > 0 ? 'longer' : 'shorter'} by ${f.int(Math.abs(h.avgSessionShift))} minutes on average.`);
  if (c.topArtist[0] && c.topArtist[1]) out.push(c.topArtist[0] === c.topArtist[1] ? `${c.topArtist[1]} held the #1 spot both years.` : `Your #1 went from ${c.topArtist[0]} to ${c.topArtist[1]}.`);
  return out;
}

export default function Compare({ index }) {
  const years = index.scopes.filter((s) => s.id !== 'all').map((s) => s.id);
  const [a, setA] = useState(years.at(-2) ?? null);
  const [b, setB] = useState(years.at(-1) ?? null);
  const { data: sa } = useJson(years.length >= 2 && a ? `stats-${a}` : null);
  const { data: sb } = useJson(years.length >= 2 && b ? `stats-${b}` : null);
  const c = useMemo(() => (sa && sb && a !== b ? compareYears(sa, sb) : null), [sa, sb, a, b]);

  // Explore only renders this when index.canCompare (two or more years with 6+ months of data).
  if (years.length < 2) return null;

  const select = (value, set, label) => (
    <label className="flex items-center gap-2 text-sm text-[#9c9c9c]">
      {label}
      <select value={value} onChange={(e) => set(e.target.value)} className="rounded-lg border border-white/10 bg-[#191919] px-3 py-1.5 text-[#efefef]">
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        {select(a, setA, 'Compare')}
        {select(b, setB, 'with')}
      </div>
      {a === b ? (
        <Empty>Pick two different years.</Empty>
      ) : !c ? (
        <p className="text-[#9c9c9c]">Loading…</p>
      ) : (
        <>
          {c.partial && (
            <p className="text-sm text-[#d28e05]">
              Heads up: {c.coverage.map((cv, i) => (cv?.partial ? `${c.years[i]} only covers ${f.dateShort(cv.first)} – ${f.dateShort(cv.last)}` : null)).filter(Boolean).join('; ')}. Totals aren't
              apples to apples, so check minutes per day.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Minutes" value={signed(c.minutes.delta)} note={`${f.int(c.minutes.before)} → ${f.int(c.minutes.after)}`} />
            <StatTile label="Minutes per day" value={c.minutesPerDay.pct == null ? '–' : `${c.minutesPerDay.pct > 0 ? '+' : ''}${f.one(c.minutesPerDay.pct)}%`} note={`${f.one(c.minutesPerDay.before)} → ${f.one(c.minutesPerDay.after)} per covered day`} />
            <StatTile label="Different artists" value={signed(c.uniqueArtists.delta)} note={`${f.int(c.uniqueArtists.before)} → ${f.int(c.uniqueArtists.after)}`} />
            <StatTile label="Podcast minutes" value={signed(c.podcastMinutes.delta)} note={`${f.int(c.podcastMinutes.before)} → ${f.int(c.podcastMinutes.after)}`} />
          </div>
          <Card title="What changed">
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {shiftSentences(c).map((t) => (
                <li key={t}>{t}</li>
              ))}
              {c.stayedTop10.length > 0 && <li>In your top 10 both years: {c.stayedTop10.map((x) => x.name).join(', ')}.</li>}
            </ul>
          </Card>
          <div className="grid gap-3 lg:grid-cols-2">
            <RankColumn title={`Top artists ${b} vs ${a}`} data={c.artists} kind="artists" />
            <RankColumn title={`Top songs ${b} vs ${a}`} data={c.tracks} kind="tracks" />
          </div>
        </>
      )}
    </div>
  );
}
