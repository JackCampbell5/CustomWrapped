import { TIME_ZONE } from './config.js';

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
});
const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const pad = (n) => String(n).padStart(2, '0');

/**
 * Convert a UTC epoch (ms) to wall-clock parts in TIME_ZONE.
 * @param {number} utcMs
 */
export function localParts(utcMs) {
  const p = {};
  for (const { type, value } of fmt.formatToParts(utcMs)) p[type] = value;
  const year = +p.year;
  const month = +p.month;
  const day = +p.day;
  const hour = +p.hour % 24;
  const minute = +p.minute;
  const second = +p.second;
  const wallMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetMin = Math.round((wallMs - Math.floor(utcMs / 1000) * 1000) / 60_000);
  const sign = offsetMin < 0 ? '-' : '+';
  const abs = Math.abs(offsetMin);
  const date = `${p.year}-${p.month}-${p.day}`;
  return {
    year,
    month,
    day,
    hour,
    minute,
    dow: DOW[p.weekday],
    date,
    iso: `${date}T${pad(hour)}:${pad(minute)}:${pad(second)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`,
  };
}

/** Account export format: "YYYY-MM-DD HH:mm" (UTC), seconds optional. */
export function parseAccountTime(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(s ?? ''));
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
}

/** ISO UTC, tolerating Spotify's "...Z[UTC]" suffix. */
export function parseIsoUtc(s) {
  if (!s) return NaN;
  return Date.parse(String(s).replace(/\[UTC\]$/, ''));
}

// ---- Calendar-date helpers (operate on "YYYY-MM-DD" strings, zone-free) ----
const DAY = 86_400_000;
export const dayNum = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY;
export const fromDayNum = (n) => new Date(n * DAY).toISOString().slice(0, 10);
export const addDays = (d, n) => fromDayNum(dayNum(d) + n);
export const daysBetween = (a, b) => dayNum(b) - dayNum(a);
export const dowOfDate = (d) => new Date(dayNum(d) * DAY).getUTCDay();
export const daysInYear = (y) => ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365);

/** Inclusive list of "YYYY-MM" between two "YYYY-MM" (or longer) strings. */
export function monthsBetween(a, b) {
  let y = +a.slice(0, 4);
  let m = +a.slice(5, 7);
  const ey = +b.slice(0, 4);
  const em = +b.slice(5, 7);
  const out = [];
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${pad(m)}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** "HH:MM" from an ISO-with-offset local timestamp. */
export const clockOf = (iso) => iso.slice(11, 16);
