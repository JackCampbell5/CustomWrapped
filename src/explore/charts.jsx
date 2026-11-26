import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { compact, DAYS, hourLabel, int, monthName, monthYear } from '../lib/format.js';
import { MUSIC, PODCAST, seqScale, T } from './theme.js';
import { axisProps, ChartTip, TableView, useTip } from './ui.jsx';

const yTick = (v) => (v >= 10_000 ? compact(v) : int(v));

/** Monthly minutes. mode: 'music' | 'podcasts' | 'both' (stacked, 2 series + legend). */
export function MonthlyChart({ rows, mode = 'both', many = rows.length > 14 }) {
  const series =
    mode === 'music'
      ? [['musicMinutes', 'Music', MUSIC]]
      : mode === 'podcasts'
        ? [['podcastMinutes', 'Podcasts', PODCAST]]
        : [
            ['musicMinutes', 'Music', MUSIC],
            ['podcastMinutes', 'Podcasts', PODCAST],
          ];
  const label = (m) => (many ? monthYear(m) : monthName(m, 'short'));
  return (
    <>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={T.grid} />
            <XAxis dataKey="month" tickFormatter={label} {...axisProps} interval={many ? 'preserveStartEnd' : 0} minTickGap={12} />
            <YAxis tickFormatter={yTick} {...axisProps} axisLine={false} width={48} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<ChartTip formatLabel={monthYear} formatValue={(v) => `${int(v)} min`} />} />
            {series.length > 1 && <Legend iconType="rect" iconSize={10} wrapperStyle={{ color: T.text2, fontSize: 12, paddingTop: 8 }} />}
            {series.map(([key, name, color], i) => (
              <Bar
                key={key}
                dataKey={key}
                name={name}
                stackId="m"
                fill={color}
                maxBarSize={24}
                stroke={T.surface}
                strokeWidth={series.length > 1 ? 2 : 0}
                radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableView
        caption="Minutes per month"
        columns={['Month', ...series.map((s) => s[1])]}
        rows={rows.map((r) => [monthYear(r.month), ...series.map(([k]) => int(r[k]))])}
      />
    </>
  );
}

/** Simple horizontal bar list (single series): value at the tip. */
export function HBarList({ items, color = MUSIC, format = (v) => int(v) }) {
  const max = Math.max(1, ...items.map((x) => x.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((x) => (
        <li key={x.label} className="grid grid-cols-[minmax(6rem,10rem)_1fr] items-center gap-3 text-sm">
          <span className="truncate text-[#efefef]">{x.label}</span>
          <span className="flex items-center gap-2">
            <span className="h-3 max-h-6 rounded-r-[4px]" style={{ width: `${(x.value / max) * 85}%`, minWidth: x.value ? 2 : 0, background: color }} />
            <span className="tabular-nums text-[#9c9c9c]">{format(x.value)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Day-of-week x hour heatmap (sequential blue). */
export function HourHeatmap({ grid }) {
  const tip = useTip();
  const color = seqScale(grid.flat());
  return (
    <>
      <div className="overflow-x-auto">
        <div className="grid min-w-[560px] gap-[2px]" style={{ gridTemplateColumns: '2.5rem repeat(24, minmax(0,1fr))' }} role="img" aria-label="Minutes listened by day of week and hour">
          {grid.map((row, d) => (
            <div key={d} className="contents">
              <span className="self-center text-xs text-[#9c9c9c]">{DAYS[d].slice(0, 3)}</span>
              {row.map((v, h) => (
                <span key={h} className="aspect-square rounded-[3px] outline-none hover:brightness-125 focus:brightness-125" style={{ background: color(v) }} {...tip(`${int(v)} min`, `${DAYS[d]}, ${hourLabel(h)}`)} />
              ))}
            </div>
          ))}
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="text-center text-[10px] text-[#9c9c9c]">
              {h % 3 === 0 ? hourLabel(h) : ''}
            </span>
          ))}
        </div>
      </div>
      <SeqLegend />
      <TableView caption="Minutes by day and hour" columns={['Day', ...Array.from({ length: 24 }, (_, h) => hourLabel(h))]} rows={grid.map((r, d) => [DAYS[d].slice(0, 3), ...r.map((v) => int(v))])} />
    </>
  );
}

export function SeqLegend({ less = 'Less', more = 'More' }) {
  return (
    <div className="mt-3 flex items-center gap-1.5 text-xs text-[#9c9c9c]" aria-hidden="true">
      {less}
      {[T.empty, ...T.seq].map((c) => (
        <span key={c} className="h-3 w-3 rounded-[3px]" style={{ background: c }} />
      ))}
      {more}
    </div>
  );
}

/** GitHub-style calendar of daily minutes for one year. calendar: { 'YYYY-MM-DD': [music, podcast] } */
export function CalendarHeatmap({ year, calendar, mode = 'music' }) {
  const tip = useTip();
  const pick = (d) => {
    const c = calendar[d];
    if (!c) return 0;
    return mode === 'music' ? c[0] : mode === 'podcasts' ? c[1] : c[0] + c[1];
  };
  const start = new Date(Date.UTC(year, 0, 1));
  const days = [];
  for (let t = start.getTime(); new Date(t).getUTCFullYear() === year; t += 86_400_000) days.push(new Date(t).toISOString().slice(0, 10));
  const offset = start.getUTCDay();
  const values = days.map(pick);
  const color = seqScale(values);
  const weeks = Math.ceil((days.length + offset) / 7);
  const cell = 11;
  const gap = 2;
  const monthStarts = days.map((d, i) => [d, i]).filter(([d]) => d.endsWith('-01'));
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${30 + weeks * (cell + gap)} ${18 + 7 * (cell + gap)}`} className="w-full min-w-[640px]" role="img" aria-label={`Daily ${mode} minutes in ${year}`}>
        {monthStarts.map(([d, i]) => (
          <text key={d} x={30 + Math.floor((i + offset) / 7) * (cell + gap)} y={10} fontSize="9" fill={T.text2}>
            {monthName(d.slice(0, 7), 'short')}
          </text>
        ))}
        {[1, 3, 5].map((dw) => (
          <text key={dw} x={0} y={18 + dw * (cell + gap) + 9} fontSize="9" fill={T.text2}>
            {DAYS[dw].slice(0, 3)}
          </text>
        ))}
        {days.map((d, i) => {
          const pos = i + offset;
          const v = values[i];
          return (
            <rect
              key={d}
              x={30 + Math.floor(pos / 7) * (cell + gap)}
              y={18 + (pos % 7) * (cell + gap)}
              width={cell}
              height={cell}
              rx="2.5"
              fill={color(v)}
              className="outline-none hover:brightness-125"
              {...tip(`${int(v)} min`, new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }))}
            />
          );
        })}
      </svg>
    </div>
  );
}

/** Per-item monthly history (plays) for the search detail panel. */
export function HistoryChart({ rows, color = MUSIC }) {
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={T.grid} />
          <XAxis dataKey="month" tickFormatter={monthYear} {...axisProps} minTickGap={16} />
          <YAxis allowDecimals={false} {...axisProps} axisLine={false} width={36} />
          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<ChartTip formatLabel={monthYear} formatValue={(v) => `${int(v)} plays`} />} />
          <Bar dataKey="plays" name="Plays" fill={color} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
