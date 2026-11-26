import { useEffect, useMemo, useRef, useState } from 'react';
import { norm } from '../../scripts/lib/normalize.js';
import { monthsBetween } from '../../scripts/lib/time.js';
import { Art } from '../components/Art.jsx';
import { loadJson } from '../data/load.js';
import { dateMed, int } from '../lib/format.js';
import { HistoryChart } from './charts.jsx';
import { MUSIC, PODCAST } from './theme.js';
import { Card, Empty } from './ui.jsx';

const KIND_LABEL = { artists: 'Artist', tracks: 'Song', shows: 'Podcast' };

/** Search any artist / song / show and see its full personal history (from lookup.json). */
export default function Search({ picked, onPicked }) {
  const [lookup, setLookup] = useState(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const inputRef = useRef(null);
  const ensure = () => {
    if (!lookup) loadJson('lookup').then(setLookup);
  };

  // A row clicked elsewhere (top lists) opens here.
  useEffect(() => {
    if (!picked) return;
    ensure();
    loadJson('lookup').then((lk) => {
      if (!lk) return;
      const list = lk[picked.kind] ?? [];
      const hit = list.find((x) => x.k === picked.key) ?? list.find((x) => norm(x.n) === norm(picked.name));
      if (hit) setSel({ kind: picked.kind, item: hit });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);

  const results = useMemo(() => {
    const nq = norm(q);
    if (!lookup || nq.length < 2) return [];
    const out = [];
    for (const kind of ['artists', 'tracks', 'shows']) {
      let n = 0;
      for (const x of lookup[kind]) {
        if (norm(x.n).includes(nq) || (kind === 'tracks' && norm(x.a).includes(nq) && norm(`${x.n} ${x.a}`).includes(nq))) {
          out.push({ kind, item: x });
          if (++n >= 6) break;
        }
      }
    }
    return out;
  }, [lookup, q]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <div>
        <label htmlFor="search" className="sr-only">
          Search artists, songs, podcasts
        </label>
        <input
          id="search"
          ref={inputRef}
          type="search"
          value={q}
          onFocus={ensure}
          onChange={(e) => {
            ensure();
            setQ(e.target.value);
          }}
          placeholder="Search any artist, song or podcast…"
          className="w-full rounded-xl border border-white/10 bg-[#191919] px-4 py-3 text-[#efefef] placeholder:text-[#9c9c9c] focus:border-[#338ced] focus:outline-none"
        />
        <ul className="mt-2 flex max-h-96 flex-col gap-1 overflow-auto" aria-label="Search results">
          {q.length >= 2 && lookup && !results.length && <li className="px-2 py-3 text-sm text-[#9c9c9c]">Nothing found for “{q}”.</li>}
          {results.map(({ kind, item }) => (
            <li key={`${kind}-${item.k}`}>
              <button
                onClick={() => {
                  setSel({ kind, item });
                  onPicked?.();
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/5 ${sel?.item === item ? 'bg-white/10' : ''}`}
              >
                <Art kind={kind} item={{ k: item.k, name: item.n, artist: item.a }} small round={kind === 'artists'} className="h-9 w-9 shrink-0 rounded-md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[#efefef]">{item.n}</span>
                  <span className="block truncate text-xs text-[#9c9c9c]">
                    {KIND_LABEL[kind]}
                    {item.a ? ` · ${item.a}` : ''} · {int(item.p)} plays
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {sel ? <Detail sel={sel} lookup={lookup} onPick={(s) => setSel(s)} /> : <Empty>Search for something, or click a row in the top lists, to see its history.</Empty>}
    </div>
  );
}

function Detail({ sel, lookup, onPick }) {
  const { kind, item } = sel;
  const months = monthsBetween(item.f, item.l);
  const rows = months.map((m) => ({ month: m, plays: item.mo[m]?.[0] ?? 0, minutes: item.mo[m]?.[1] ?? 0 }));
  const peak = rows.reduce((a, r) => (r.plays > a.plays ? r : a), rows[0]);
  const theirTracks = kind === 'artists' && lookup ? lookup.tracks.filter((t) => norm(t.a) === norm(item.n)).slice(0, 10) : [];
  return (
    <Card>
      <div className="flex items-center gap-4">
        <Art kind={kind} item={{ k: item.k, name: item.n, artist: item.a }} round={kind === 'artists'} className="h-20 w-20 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#9c9c9c]">{KIND_LABEL[kind]} · all-time history</p>
          <p className="truncate text-2xl font-bold text-[#efefef]">{item.n}</p>
          {item.a && <p className="truncate text-[#9c9c9c]">{item.a}</p>}
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {[
          ['Plays', int(item.p)],
          ['Minutes', int(item.m)],
          ['First played', dateMed(item.f)],
          ['Last played', dateMed(item.l)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-white/[0.04] p-3">
            <dt className="text-[#9c9c9c]">{k}</dt>
            <dd className="mt-0.5 font-semibold text-[#efefef]">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-sm text-[#9c9c9c]">
        Plays per month{peak?.plays ? ` · peak ${int(peak.plays)} in ${new Date(`${peak.month}-15`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` : ''}
      </p>
      <HistoryChart rows={rows} color={kind === 'shows' ? PODCAST : MUSIC} />
      {theirTracks.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm text-[#9c9c9c]">Your most-played {item.n} songs</p>
          <ol className="grid gap-1 sm:grid-cols-2">
            {theirTracks.map((t, i) => (
              <li key={t.k}>
                <button onClick={() => onPick({ kind: 'tracks', item: t })} className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-white/5">
                  <span className="w-5 text-right text-[#9c9c9c] tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[#efefef]">{t.n}</span>
                  <span className="tabular-nums text-[#9c9c9c]">{int(t.p)}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}
