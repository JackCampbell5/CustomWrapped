import { createContext, useCallback, useContext, useState } from 'react';
import { T } from './theme.js';

export function Section({ id, title, subtitle, children, action }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-28">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={`${id}-h`} className="text-2xl font-bold tracking-tight text-[#efefef]">
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-sm text-[#9c9c9c]">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Card({ title, subtitle, children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-[#191919] p-5 ${className}`}>
      {title && <h3 className="text-base font-semibold text-[#efefef]">{title}</h3>}
      {subtitle && <p className="mt-0.5 text-sm text-[#9c9c9c]">{subtitle}</p>}
      <div className={title || subtitle ? 'mt-4' : ''}>{children}</div>
    </div>
  );
}

/** label · value · optional note (sentence case, no trailing colon) */
export function StatTile({ label, value, note }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#191919] p-4">
      <p className="text-sm text-[#9c9c9c]">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-[#efefef]">{value}</p>
      {note && <p className="mt-1 text-xs text-[#9c9c9c]">{note}</p>}
    </div>
  );
}

export function Segmented({ label, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-white/10 bg-[#191919] p-1">
      {options.map(([v, text]) => (
        <button
          key={v}
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${value === v ? 'bg-[#efefef] text-black' : 'text-[#9c9c9c] hover:text-[#efefef]'}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function Empty({ children }) {
  return <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-[#9c9c9c]">{children}</p>;
}

export function TableView({ caption, columns, rows }) {
  return (
    <details className="mt-3 text-sm text-[#9c9c9c]">
      <summary className="cursor-pointer select-none hover:text-[#efefef]">Show as table</summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-white/10">
        <table className="w-full text-left tabular-nums">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-[#191919]">
            <tr>
              {columns.map((c) => (
                <th key={c} scope="col" className="px-3 py-2 font-semibold text-[#efefef]">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-white/5">
                {r.map((c, j) => (
                  <td key={j} className="px-3 py-1.5">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------- shared hover tooltip for custom SVG/HTML marks
const TipCtx = createContext(() => {});
export function TipLayer({ children }) {
  const [tip, setTip] = useState(null);
  const show = useCallback((t) => setTip(t), []);
  return (
    <TipCtx.Provider value={show}>
      {children}
      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg border border-white/10 bg-[#0b0b0b]/95 px-3 py-2 text-sm shadow-xl"
          style={{ left: tip.x, top: tip.y }}
        >
          <p className="font-semibold tabular-nums text-[#efefef]">{tip.value}</p>
          <p className="text-xs text-[#9c9c9c]">{tip.label}</p>
        </div>
      )}
    </TipCtx.Provider>
  );
}

/** Props to spread on a mark so hover and keyboard focus both show its tooltip. */
export function useTip() {
  const show = useContext(TipCtx);
  return (value, label) => ({
    onMouseEnter: (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      show({ x: r.left + r.width / 2, y: r.top, value, label });
    },
    onMouseLeave: () => show(null),
    onFocus: (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      show({ x: r.left + r.width / 2, y: r.top, value, label });
    },
    onBlur: () => show(null),
  });
}

/** Recharts tooltip in the same style: value leads, label follows, line keys. */
export function ChartTip({ active, payload, label, formatLabel, formatValue = (v) => v }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#0b0b0b]/95 px-3 py-2 text-sm shadow-xl">
      <p className="mb-1 text-xs text-[#9c9c9c]">{formatLabel ? formatLabel(label) : label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-3 rounded" style={{ background: p.color ?? p.fill }} />
          <span className="font-semibold tabular-nums text-[#efefef]">{formatValue(p.value)}</span>
          <span className="text-xs text-[#9c9c9c]">{p.name}</span>
        </p>
      ))}
    </div>
  );
}

export const axisProps = {
  tick: { fill: T.text2, fontSize: 12 },
  axisLine: { stroke: T.axis },
  tickLine: false,
};
