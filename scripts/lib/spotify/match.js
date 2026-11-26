import { norm } from '../normalize.js';

/** Aggressive simplification for matching search results to export names. */
export function simplify(s) {
  return norm(s)
    .replace(/\s*[([](feat\.?|ft\.?|with|prod\.?)\s[^)\]]*[)\]]/g, '')
    .replace(/\s+-\s+.*\b(remaster(ed)?|version|edit|mix|live|mono|stereo|acoustic|from)\b.*$/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 0..1 similarity: the better of edit-distance ratio and token overlap (Dice). */
export function similarity(x, y) {
  const a = simplify(x);
  const b = simplify(y);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const lev = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  const ta = new Set(a.split(' '));
  const tb = new Set(b.split(' '));
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const dice = (2 * inter) / (ta.size + tb.size);
  return Math.max(lev, dice);
}

/** Pick the best search hit for an export row, or null if nothing is close enough. */
export function bestTrackMatch(results, { track, artist }) {
  let best = null;
  for (const r of results ?? []) {
    if (!r?.name) continue;
    const t = similarity(track, r.name);
    const a = Math.max(0, ...(r.artists ?? []).map((x) => similarity(artist, x.name)));
    if (t < 0.6 || a < 0.6) continue;
    const score = 0.6 * t + 0.4 * a;
    if (score >= 0.75 && (!best || score > best.score)) best = { score, item: r };
  }
  return best?.item ?? null;
}

/** Best hit by name (artists, shows), optionally checking an owner name (album artist). */
export function bestNameMatch(results, name, { owner, ownerOf, min = 0.8 } = {}) {
  let best = null;
  for (const r of results ?? []) {
    if (!r?.name) continue;
    const n = similarity(name, r.name);
    if (n < min) continue;
    let score = n;
    if (owner && ownerOf) {
      const o = Math.max(0, ...ownerOf(r).map((x) => similarity(owner, x)));
      if (o < 0.6) continue;
      score = 0.6 * n + 0.4 * o;
    }
    if (!best || score > best.score) best = { score, item: r };
  }
  return best?.item ?? null;
}
