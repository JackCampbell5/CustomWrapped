import { useEffect, useRef } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';
import { Art } from '../components/Art.jsx';

// ---------------------------------------------------------------- motion variants
const container = { hidden: {}, show: { transition: { staggerChildren: 0.11, delayChildren: 0.12 } } };
const VARIANTS = {
  rise: { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 210, damping: 22 } } },
  pop: { hidden: { opacity: 0, scale: 0.55, rotate: -6 }, show: { opacity: 1, scale: 1, rotate: 0, transition: { type: 'spring', stiffness: 260, damping: 16 } } },
  slide: { hidden: { opacity: 0, x: -36 }, show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 230, damping: 24 } } },
  fade: { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.6 } } },
};

export function Stagger({ children, className = '' }) {
  return (
    <motion.div className={className} variants={container} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

/** A staggered child. `as` picks the variant. */
export function M({ children, v = 'rise', className = '', style }) {
  return (
    <motion.div variants={VARIANTS[v]} className={className} style={style}>
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------- type
export const Kicker = ({ children, className = '' }) => (
  <p className={`text-[4cqw] font-extrabold uppercase tracking-[0.22em] opacity-80 ${className}`}>{children}</p>
);

/** Picks a font size (in container-width units) that fits a string on one or two lines. */
export function fitSize(text, max = 30, min = 9) {
  const len = String(text ?? '').length;
  const size = len <= 4 ? max : (max * 4.2) / Math.max(len, 1) + 3.5;
  return `${Math.max(min, Math.min(max, size))}cqw`;
}

export const Big = ({ children, size = '26cqw', className = '' }) => (
  <p className={`font-black leading-[0.86] tracking-[-0.045em] ${className}`} style={{ fontSize: size }}>
    {children}
  </p>
);

export const Title = ({ children, size = '10cqw', className = '' }) => (
  <h2 className={`font-black leading-[0.95] tracking-[-0.03em] text-balance ${className}`} style={{ fontSize: size }}>
    {children}
  </h2>
);

export const Sub = ({ children, className = '' }) => <p className={`text-[4.6cqw] font-semibold leading-snug opacity-90 ${className}`}>{children}</p>;

export const Footnote = ({ children }) => <p className="text-[3.1cqw] font-medium leading-snug opacity-70">{children}</p>;

export const Pill = ({ children }) => (
  <span className="inline-block rounded-full border-[0.5cqw] border-current px-[3.4cqw] py-[1.4cqw] text-[3.6cqw] font-bold">{children}</span>
);

// ---------------------------------------------------------------- numbers
const fmtNum = (v, decimals) =>
  Number(v).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** Counts up from 0 on mount; shows the final value immediately with reduced motion. */
export function CountUp({ value, decimals = 0, duration = 1.7, delay = 0.25, suffix = '' }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce || !ref.current) return undefined;
    const c = animate(0, value, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = fmtNum(v, decimals) + suffix;
      },
    });
    return () => c.stop();
  }, [value, decimals, duration, delay, reduce, suffix]);
  const final = fmtNum(value, decimals) + suffix;
  return (
    <>
      <span ref={ref} aria-hidden="true">
        {reduce ? final : fmtNum(0, decimals) + suffix}
      </span>
      <span className="sr-only">{final}</span>
    </>
  );
}

// ---------------------------------------------------------------- lists
/**
 * @param {{ items: any[], kind: 'tracks'|'artists'|'albums'|'shows', value: (x) => string, sub?: (x) => string, round?: boolean, start?: number }} p
 */
export function RankList({ items, kind, value, sub, round = false, start = 1 }) {
  return (
    <ol className="flex flex-col gap-[2.6cqw]">
      {items.map((x, i) => (
        <M key={x.key ?? `${x.name}-${i}`} v="slide">
          <li className="flex items-center gap-[3cqw]">
            <span className="w-[7cqw] shrink-0 text-right text-[6cqw] font-black tabular-nums opacity-80">{i + start}</span>
            {kind && <Art kind={kind} item={x} small round={round} className="h-[13cqw] w-[13cqw] shrink-0 rounded-[1.6cqw] shadow-lg" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[4.8cqw] font-extrabold leading-tight">{x.name}</p>
              {sub && <p className="truncate text-[3.5cqw] font-semibold opacity-75">{sub(x)}</p>}
            </div>
            {value && <span className="shrink-0 text-[3.6cqw] font-bold tabular-nums opacity-85">{value(x)}</span>}
          </li>
        </M>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------- background
function Deco({ kind, ink }) {
  const common = { stroke: ink, fill: 'none', opacity: 0.14 };
  if (kind === 'rings')
    return (
      <svg viewBox="0 0 100 100" className="absolute -right-[30%] -top-[12%] w-[110%]" aria-hidden="true">
        {[12, 22, 32, 42].map((r) => (
          <circle key={r} cx="50" cy="50" r={r} strokeWidth="1.4" {...common} />
        ))}
      </svg>
    );
  if (kind === 'stripes')
    return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <line key={i} x1={-20 + i * 16} y1="110" x2={20 + i * 16} y2="-10" strokeWidth="3" {...common} opacity={0.08} />
        ))}
      </svg>
    );
  if (kind === 'dots')
    return (
      <svg viewBox="0 0 100 100" className="absolute -bottom-[6%] -left-[8%] w-[70%]" aria-hidden="true">
        {Array.from({ length: 64 }, (_, i) => (
          <circle key={i} cx={6 + (i % 8) * 12} cy={6 + Math.floor(i / 8) * 12} r="1.6" fill={ink} opacity="0.18" />
        ))}
      </svg>
    );
  if (kind === 'stars')
    return (
      <svg viewBox="0 0 100 177" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {Array.from({ length: 40 }, (_, i) => (
          <circle key={i} cx={(i * 37) % 100} cy={(i * 61) % 177} r={0.3 + ((i * 7) % 5) / 6} fill={ink} opacity={0.15 + ((i * 3) % 5) / 12} />
        ))}
      </svg>
    );
  return null;
}

export function Shell({ palette, children }) {
  const reduce = useReducedMotion();
  const [a, b] = palette.blobs;
  const float = (dx, dy, d) => (reduce ? {} : { animate: { x: [0, dx, 0], y: [0, dy, 0], scale: [1, 1.12, 1] }, transition: { duration: d, repeat: Infinity, ease: 'easeInOut' } });
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ color: palette.ink, background: `linear-gradient(165deg, ${palette.stops[0]} 0%, ${palette.stops[1]} 55%, ${palette.stops[2]} 100%)` }}
    >
      <motion.div aria-hidden="true" className="absolute -left-[25%] -top-[15%] h-[85cqw] w-[85cqw] rounded-full opacity-60 blur-[14cqw]" style={{ background: a }} {...float(40, 60, 11)} />
      <motion.div aria-hidden="true" className="absolute -bottom-[20%] -right-[25%] h-[95cqw] w-[95cqw] rounded-full opacity-50 blur-[16cqw]" style={{ background: b }} {...float(-50, -40, 13)} />
      <Deco kind={palette.deco} ink={palette.ink} />
      <div aria-hidden="true" className="grain absolute inset-0 opacity-[.16] mix-blend-overlay" />
      <div className="relative flex h-full flex-col px-[8cqw] pb-[9cqw] pt-[15cqw]">{children}</div>
    </div>
  );
}
