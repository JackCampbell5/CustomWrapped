const nf = new Intl.NumberFormat('en-US');
const cf = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export const int = (n) => nf.format(Math.round(n ?? 0));
export const compact = (n) => (Math.abs(n) < 10_000 ? int(n) : cf.format(n));
export const one = (n) => nf.format(Math.round((n ?? 0) * 10) / 10);
export const plural = (n, word, pl = `${word}s`) => `${int(n)} ${Math.round(n) === 1 ? word : pl}`;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = (ym, style = 'long') => {
  const m = MONTHS[+ym.slice(5, 7) - 1] ?? '';
  return style === 'short' ? m.slice(0, 3) : style === 'letter' ? m[0] : m;
};
export const monthYear = (ym) => `${monthName(ym, 'short')} ${ym.slice(0, 4)}`;

const asDate = (d) => new Date(`${d}T12:00:00Z`);
export const dateLong = (d) => asDate(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
export const dateMed = (d) => asDate(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export const dateShort = (d) => asDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
export const dateShortYear = (d) => asDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export const clock = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
export const hourLabel = (h) => (h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`);
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const scopeLabel = (id) => (id === 'all' ? 'All time' : String(id));

export function duration(minutes) {
  if (minutes < 90) return plural(minutes, 'minute');
  const h = minutes / 60;
  if (h < 48) return `${one(h)} hours`;
  return `${one(h / 24)} days`;
}

/** Human note for how much of a year the data covers. */
export function coverageNote(cov, id) {
  if (!cov) return '';
  if (id === 'all') return `${dateShortYear(cov.first)} – ${dateShortYear(cov.last)}`;
  if (cov.startsLate && cov.endsEarly) return `Partial year: ${dateShort(cov.first)} – ${dateShort(cov.last)}`;
  if (cov.startsLate) return `Partial year: data starts ${monthYear(cov.first.slice(0, 7))}`;
  if (cov.endsEarly) return `Data runs through ${dateShort(cov.last)}`;
  return 'Full year';
}
