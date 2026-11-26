import { useMemo, useState } from 'react';
import { Art } from '../components/Art.jsx';
import { dateShortYear, int } from '../lib/format.js';
import { Segmented } from './ui.jsx';

const KINDS = [
  ['artists', 'Artists'],
  ['tracks', 'Songs'],
  ['albums', 'Albums'],
];

/**
 * Top-50 lists: pick the list (by minutes / by plays), then sort columns within it.
 * @param {{ top: any, shows?: any[], mode: 'music'|'podcasts', onPick?: (x: any, kind: string) => void }} p
 */
export default function TopTable({ top, shows, mode, onPick }) {
  const [kind, setKind] = useState('artists');
  const [by, setBy] = useState('byMinutes');
  const [sort, setSort] = useState({ col: 'rank', dir: 1 });

  const k = mode === 'podcasts' ? 'shows' : kind;
  const list = mode === 'podcasts' ? shows ?? [] : (top[kind]?.[by] ?? []);
  const rows = useMemo(() => {
    const withRank = list.map((x, i) => ({ ...x, rank: i + 1 }));
    const { col, dir } = sort;
    const val = (x) => (col === 'name' ? x.name.toLowerCase() : x[col] ?? 0);
    return [...withRank].sort((a, b) => (val(a) < val(b) ? -dir : val(a) > val(b) ? dir : 0));
  }, [list, sort]);

  const header = (col, label, align = 'text-left') => {
    const active = sort.col === col;
    return (
      <th scope="col" className={`px-3 py-2 font-semibold ${align}`} aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
        <button className={`inline-flex items-center gap-1 hover:text-[#efefef] ${active ? 'text-[#efefef]' : ''}`} onClick={() => setSort((s) => ({ col, dir: s.col === col ? -s.dir : col === 'name' || col === 'rank' ? 1 : -1 }))}>
          {label}
          <span aria-hidden="true" className="text-[10px]">
            {active ? (sort.dir === 1 ? '▲' : '▼') : ''}
          </span>
        </button>
      </th>
    );
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {mode === 'music' && <Segmented label="List" options={KINDS.filter(([v]) => top[v])} value={kind} onChange={setKind} />}
        {mode === 'music' && (
          <Segmented
            label="Rank by"
            options={[
              ['byMinutes', 'Minutes'],
              ['byPlays', 'Plays'],
            ]}
            value={by}
            onChange={setBy}
          />
        )}
      </div>
      <div className="max-h-[34rem] overflow-auto rounded-xl border border-white/10">
        <table className="w-full text-sm tabular-nums">
          <caption className="sr-only">Top {k} ranked by {by === 'byMinutes' ? 'minutes' : 'plays'}</caption>
          <thead className="sticky top-0 z-10 bg-[#191919] text-[#9c9c9c]">
            <tr>
              {header('rank', '#', 'w-12 text-left')}
              {header('name', k === 'artists' ? 'Artist' : k === 'tracks' ? 'Song' : k === 'albums' ? 'Album' : 'Show')}
              {header('minutes', 'Minutes', 'text-right')}
              {header('plays', 'Plays', 'text-right')}
              <th scope="col" className="hidden px-3 py-2 text-right font-semibold md:table-cell">
                First · last
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.key} className="border-t border-white/5 hover:bg-white/[0.03]">
                <td className="px-3 py-1.5 text-[#9c9c9c]">{x.rank}</td>
                <td className="px-3 py-1.5">
                  <button className="flex min-w-0 items-center gap-3 text-left" onClick={() => onPick?.(x, k)} disabled={!onPick}>
                    <Art kind={k} item={x} small round={k === 'artists'} className="h-9 w-9 shrink-0 rounded-md" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-[#efefef] hover:underline">{x.name}</span>
                      {x.artist && <span className="block truncate text-xs text-[#9c9c9c]">{x.artist}</span>}
                    </span>
                  </button>
                </td>
                <td className="px-3 py-1.5 text-right text-[#efefef]">{int(x.minutes)}</td>
                <td className="px-3 py-1.5 text-right text-[#efefef]">{int(x.plays)}</td>
                <td className="hidden px-3 py-1.5 text-right text-xs text-[#9c9c9c] md:table-cell">
                  {x.first ? `${dateShortYear(x.first)} · ${dateShortYear(x.last)}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
