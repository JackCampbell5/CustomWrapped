// Small single-series charts for story slides. Marks use the slide's ink color;
// no legend (one series, the slide title names it); hover/focus titles carry exact values.
import { motion } from 'framer-motion';
import { DAYS, hourLabel, int, monthName, monthYear } from '../lib/format.js';

/** Monthly minutes as columns: <= 24px wide, 4px rounded tops, peak labeled. */
export function MonthBars({ rows, ink }) {
  const max = Math.max(1, ...rows.map((r) => r.musicMinutes));
  const peak = rows.reduce((a, r) => (r.musicMinutes > a.musicMinutes ? r : a), rows[0]);
  const many = rows.length > 14;
  return (
    <figure className="w-full">
      <div className="flex h-[46cqw] items-end justify-between gap-[2px]" role="img" aria-label={`Minutes per month. Peak: ${monthYear(peak.month)}, ${int(peak.musicMinutes)} minutes.`}>
        {rows.map((r, i) => {
          const h = (r.musicMinutes / max) * 100;
          const isPeak = r === peak;
          return (
            <div key={r.month} className="relative flex h-full flex-1 flex-col items-center justify-end" title={`${monthYear(r.month)}: ${int(r.musicMinutes)} min`}>
              {isPeak && <span className="absolute -top-[5cqw] whitespace-nowrap text-[3.2cqw] font-extrabold tabular-nums">{int(r.musicMinutes)}</span>}
              <motion.div
                className="w-full max-w-[24px] rounded-t-[4px]"
                style={{ height: `${Math.max(h, r.musicMinutes ? 1.5 : 0)}%`, background: ink, opacity: isPeak ? 1 : 0.42, transformOrigin: 'bottom' }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.35 + i * (many ? 0.015 : 0.05), type: 'spring', stiffness: 160, damping: 20 }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-[1.6cqw] h-px w-full" style={{ background: ink, opacity: 0.35 }} />
      <div className="mt-[1.4cqw] flex justify-between text-[3cqw] font-bold opacity-75" aria-hidden="true">
        {many
          ? [rows[0], rows[Math.floor(rows.length / 2)], rows[rows.length - 1]].map((r) => <span key={r.month}>{monthYear(r.month)}</span>)
          : rows.map((r) => (
              <span key={r.month} className="flex-1 text-center">
                {monthName(r.month, 'letter')}
              </span>
            ))}
      </div>
    </figure>
  );
}

/** Day-of-week x hour heatmap; one hue (the ink) with opacity carrying magnitude. */
export function Heatmap({ grid, ink }) {
  const max = Math.max(1, ...grid.flat());
  let peak = { d: 0, h: 0, v: -1 };
  grid.forEach((row, d) => row.forEach((v, h) => v > peak.v && (peak = { d, h, v })));
  return (
    <figure className="w-full">
      <div role="img" aria-label={`Listening by day and hour. Busiest: ${DAYS[peak.d]} around ${hourLabel(peak.h)}.`} className="grid gap-[2px]" style={{ gridTemplateColumns: `5cqw repeat(24, 1fr)` }}>
        {grid.map((row, d) => (
          <div key={d} className="contents">
            <span className="self-center text-[2.8cqw] font-bold opacity-75" aria-hidden="true">
              {DAYS[d][0]}
            </span>
            {row.map((v, h) => (
              <motion.span
                key={h}
                title={`${DAYS[d]} ${hourLabel(h)}: ${int(v)} min`}
                className="aspect-square rounded-[2px]"
                style={{ background: ink }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.07 + 0.93 * Math.pow(v / max, 0.75) }}
                transition={{ delay: 0.3 + (d * 24 + h) * 0.004, duration: 0.4 }}
              />
            ))}
          </div>
        ))}
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="text-center text-[2.4cqw] font-bold opacity-70" aria-hidden="true">
            {h % 6 === 0 ? hourLabel(h).replace('am', 'a').replace('pm', 'p') : ''}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** Horizontal share bars (single series), value at the bar tip. */
export function ShareBars({ items, ink }) {
  const max = Math.max(1, ...items.map((x) => x.pct));
  return (
    <ul className="flex w-full flex-col gap-[2.4cqw]">
      {items.map((x, i) => (
        <li key={x.label} className="flex items-center gap-[3cqw]">
          <span className="w-[24cqw] shrink-0 text-[3.6cqw] font-bold">{x.label}</span>
          <div className="flex flex-1 items-center gap-[2cqw]">
            <motion.div
              className="h-[3.4cqw] max-h-[24px] rounded-r-[4px]"
              style={{ background: ink, opacity: x.highlight ? 1 : 0.5, width: `${(x.pct / max) * 78}%`, transformOrigin: 'left' }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.4 + i * 0.08, type: 'spring', stiffness: 150, damping: 20 }}
            />
            <span className="text-[3.4cqw] font-extrabold tabular-nums">{x.display ?? `${x.pct}%`}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
