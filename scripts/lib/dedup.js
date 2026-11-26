import { DEDUP_WINDOW_MS } from './config.js';

const byTs = (a, b) => a.tsUtc - b.tsUtc;

/** Index of the first element >= x in a sorted number array. */
function lowerBound(arr, x) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * 1. Drop exact repeats (same source, end time, item, msPlayed), which happen when the
 *    same export, or two overlapping exports, are both in data/raw.
 * 2. Drop account rows that an extended row already covers (same item, end time within
 *    the window). Extended rows win because they carry more fields.
 * @param {import('./adapters.js').Play[]} plays
 */
export function dedupPlays(plays) {
  const seen = new Set();
  const unique = [];
  let exact = 0;
  for (const p of plays) {
    const k = `${p.source}|${p.tsUtc}|${p.kind}|${p.trackKey}|${p.msPlayed}`;
    if (seen.has(k)) {
      exact++;
      continue;
    }
    seen.add(k);
    unique.push(p);
  }

  const ext = unique.filter((p) => p.source === 'extended');
  let overlap = 0;
  let result = unique;
  if (ext.length && ext.length !== unique.length) {
    const idx = new Map();
    for (const p of ext) {
      const k = `${p.kind}|${p.trackKey}`;
      if (!idx.has(k)) idx.set(k, []);
      idx.get(k).push(p.tsUtc);
    }
    for (const list of idx.values()) list.sort((a, b) => a - b);

    result = unique.filter((p) => {
      if (p.source !== 'account') return true;
      const list = idx.get(`${p.kind}|${p.trackKey}`);
      if (!list) return true;
      const mid = p.tsUtc + 30_000; // account minute -> true end lies in [ts, ts+60s)
      const i = lowerBound(list, mid - DEDUP_WINDOW_MS);
      if (i < list.length && list[i] <= mid + DEDUP_WINDOW_MS) {
        overlap++;
        return false;
      }
      return true;
    });
  }

  return { plays: [...result].sort(byTs), exactDuplicates: exact, overlapDuplicates: overlap };
}
